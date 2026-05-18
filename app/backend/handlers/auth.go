package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/models"
	"github.com/jpedro-lima/Matcha/utils"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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
	Username string `json:"username"`
	Email    string `json:"email"`
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
		http.Error(w, "Invalid request body", http.StatusBadRequest)
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
	if utils.IsWeakPassword(req.Password) {
		http.Error(w, "Password is too common. Choose a stronger password.", http.StatusBadRequest)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	token := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour)

	_, err = config.DB.Exec(
		`INSERT INTO users (username, first_name, last_name, email, password, confirmed, confirmation_token, confirmation_expires_at)
		 VALUES ($1, $2, $3, $4, $5, false, $6, $7)`,
		req.Username, req.FirstName, req.LastName, req.Email, string(hashed), token, expiresAt,
	)
	if err != nil {
		http.Error(w, "Username or email already taken", http.StatusConflict)
		return
	}

	confirmationLink := fmt.Sprintf("http://localhost:8080/confirm?token=%s", token)
	body := fmt.Sprintf(
		`<p>Welcome to Matcha, %s!</p><p>Click to verify your account: <a href="%s">Confirm Email</a></p><p>Link expires in 24 hours.</p>`,
		req.FirstName, confirmationLink,
	)
	if err := utils.SendEmail(req.Email, "Confirm your Matcha account", body); err != nil {
		log.Printf("Email send failed (registration still succeeded): %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Registration successful. Please check your email to confirm your account.",
	})
}

func ConfirmEmail(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Missing token", http.StatusBadRequest)
		return
	}
	res, err := config.DB.Exec(
		`UPDATE users SET confirmed=true, confirmation_token=NULL
		 WHERE confirmation_token=$1 AND confirmation_expires_at > NOW() AND confirmed=false`,
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
	// Redirect to sign-in with success message
	http.Redirect(w, r, "http://localhost:5173/sign-in?confirmed=1", http.StatusFound)
}

func CleanupUnconfirmedUsers() {
	for {
		time.Sleep(5 * time.Minute)
		config.DB.Exec(`DELETE FROM users WHERE confirmed=false AND confirmation_expires_at < NOW()`)
	}
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	identifier := strings.TrimSpace(req.Username)
	if identifier == "" {
		identifier = strings.TrimSpace(req.Email)
	}
	if identifier == "" || strings.TrimSpace(req.Password) == "" {
		http.Error(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	var user models.User
	err := config.DB.Get(&user, "SELECT * FROM users WHERE username=$1 OR email=$1", identifier)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		} else {
			log.Printf("DB error on login: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	if !user.Confirmed {
		http.Error(w, "Please confirm your email before logging in.", http.StatusForbidden)
		return
	}
	if user.Banned {
		http.Error(w, "Your account has been suspended.", http.StatusForbidden)
		return
	}

	token, err := utils.GenerateJWT(user.ID)
	if err != nil {
		http.Error(w, "Token generation failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func Logout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out"})
}

func ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}

	token := uuid.New().String()
	expires := time.Now().Add(15 * time.Minute)

	// Always succeed to avoid email enumeration — update only if user exists
	config.DB.Exec(
		`UPDATE users SET reset_token=$1, reset_expires_at=$2 WHERE email=$3 AND confirmed=true`,
		token, expires, req.Email,
	)

	link := fmt.Sprintf("http://localhost:5173/reset-password?token=%s", token)
	body := fmt.Sprintf(
		`<p>Reset your Matcha password: <a href="%s">Reset Password</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>`,
		link,
	)
	if err := utils.SendEmail(req.Email, "Matcha — Password Reset", body); err != nil {
		log.Printf("Failed to send reset email: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "If that email exists, a reset link was sent.",
	})
}

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Token == "" || len(req.NewPassword) < 8 {
		http.Error(w, "Token and password (min 8 chars) required", http.StatusBadRequest)
		return
	}
	if utils.IsWeakPassword(req.NewPassword) {
		http.Error(w, "Password is too common. Choose a stronger password.", http.StatusBadRequest)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	res, err := config.DB.Exec(
		`UPDATE users SET password=$1, reset_token=NULL, reset_expires_at=NULL
		 WHERE reset_token=$2 AND reset_expires_at > NOW()`,
		string(hashed), req.Token,
	)
	if err != nil {
		http.Error(w, "Reset failed", http.StatusInternalServerError)
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "Invalid or expired reset token", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password reset successfully. You can now log in."})
}

func UpdatePassword(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := validate.Struct(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if utils.IsWeakPassword(req.NewPassword) {
		http.Error(w, "New password is too common.", http.StatusBadRequest)
		return
	}

	var dbPassword string
	if err := config.DB.Get(&dbPassword, "SELECT password FROM users WHERE id=$1", userID); err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(req.OldPassword)); err != nil {
		http.Error(w, "Old password incorrect", http.StatusUnauthorized)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	if _, err = config.DB.Exec("UPDATE users SET password=$1 WHERE id=$2", string(hashed), userID); err != nil {
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password updated"})
}
