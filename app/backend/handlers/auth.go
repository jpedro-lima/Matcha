package handlers

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "time"
    "fmt"
    "os"
	"log"
    "github.com/jpedro-lima/Matcha/config"
    "github.com/jpedro-lima/Matcha/models"
    "github.com/jpedro-lima/Matcha/utils"

    "github.com/go-playground/validator/v10"
    "github.com/google/uuid"
)

type RegisterRequest struct {
    Username         string `json:"username" validate:"required"`
    FirstName        string `json:"first_name" validate:"required"`
    LastName         string `json:"last_name" validate:"required"`
    Email            string `json:"email" validate:"required,email"`
    Password         string `json:"password" validate:"required,min=8"`
    ValidatePassword string `json:"validate_password" validate:"required,eqfield=Password"`
}

type LoginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required"`
}

type UpdatePasswordRequest struct {
    OldPassword string `json:"old_password" validate:"required"`
    NewPassword string `json:"new_password" validate:"required,min=8"`
}

var validate = validator.New()

func Register(w http.ResponseWriter, r *http.Request) {
    var req RegisterRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    if err := validate.Struct(req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    if req.Password != req.ValidatePassword {
        http.Error(w, "Passwords do not match", http.StatusBadRequest)
        return
    }

    // Generate confirmation token
    token := uuid.New().String()
    expiresAt := time.Now().Add(1 * time.Minute)

    _, err := config.DB.Exec(
        `INSERT INTO users (username, first_name, last_name, email, password, confirmed, confirmation_token, confirmation_expires_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7)`,
        req.Username, req.FirstName, req.LastName, req.Email, req.Password, token, expiresAt,
    )

    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // Send confirmation email (dummy implementation)
    confirmationLink := fmt.Sprintf("http://localhost:8080/confirm?token=%s", token)
    // Replace this with your actual email sending logic
    fmt.Fprintf(os.Stdout, "Send confirmation email to %s with link: %s\n", req.Email, confirmationLink)

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"message": "Please confirm your email to complete registration."})
}

// Email confirmation handler
func ConfirmEmail(w http.ResponseWriter, r *http.Request) {
    token := r.URL.Query().Get("token")
    if token == "" {
        http.Error(w, "Missing token", http.StatusBadRequest)
        return
    }

    res, err := config.DB.Exec(
        `UPDATE users SET confirmed=true WHERE confirmation_token=$1 AND confirmation_expires_at > NOW() AND confirmed=false`,
        token,
    )
    if err != nil {
        http.Error(w, "Confirmation failed", http.StatusInternalServerError)
        return
    }
    rows, _ := res.RowsAffected()
    if rows == 0 {
        http.Error(w, "Invalid or expired token", http.StatusBadRequest)
        return
    }
    w.Write([]byte("Email confirmed! You can now log in."))
}

// Periodic cleanup function (should be run in a goroutine on startup)
func CleanupUnconfirmedUsers() {
    for {
        time.Sleep(1 * time.Minute)
        config.DB.Exec(`DELETE FROM users WHERE confirmed=false AND confirmation_expires_at < NOW()`)
    }
}

func Login(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

	var user models.User
	log.Printf("Querying database for email %s", req.Email)
	err := config.DB.Get(&user, "SELECT * FROM users WHERE email=$1 AND password=$2", req.Email, req.Password)
	log.Printf("Finished querying database, error: %v, user: %+v", err, user)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No user found with email %s and password %s", req.Email, req.Password)
		} else {
			log.Printf("Error querying database: %v", err)
		}
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

    if !user.Confirmed {
        http.Error(w, "Please confirm your email before logging in.", http.StatusForbidden)
        return
    }

    token, err := utils.GenerateJWT(user.ID)
    if err != nil {
        http.Error(w, "Token generation failed", http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// Logout handler (for JWT, client just deletes token, but endpoint for completeness)
func Logout(w http.ResponseWriter, r *http.Request) {
    // For stateless JWT, just instruct client to delete token
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Logged out"})
}

// Update password handler
func UpdatePassword(w http.ResponseWriter, r *http.Request) {
    userID, err := utils.GetUserIDFromRequest(r) // Implement this helper to extract user ID from JWT
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    var req UpdatePasswordRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    if err := validate.Struct(req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // Check old password
    var dbPassword string
    err = config.DB.Get(&dbPassword, "SELECT password FROM users WHERE id=$1", userID)
    if err != nil || dbPassword != req.OldPassword {
        http.Error(w, "Old password incorrect", http.StatusUnauthorized)
        return
    }

    _, err = config.DB.Exec("UPDATE users SET password=$1 WHERE id=$2", req.NewPassword, userID)
    if err != nil {
        http.Error(w, "Failed to update password", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Password updated"})
}
