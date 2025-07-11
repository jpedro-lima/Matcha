package handlers

import (
    "encoding/json"
    "net/http"

    "github.com/jpedro-lima/Matcha/config"
    "github.com/jpedro-lima/Matcha/models"
    "github.com/jpedro-lima/Matcha/utils"
	
    "github.com/go-playground/validator/v10"
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

    _, err := config.DB.Exec(
        `INSERT INTO users (username, first_name, last_name, email, password) VALUES ($1, $2, $3, $4, $5)`,
        req.Username, req.FirstName, req.LastName, req.Email, req.Password,
    )

    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusCreated)
}

func Login(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    var user models.User
    err := config.DB.Get(&user, "SELECT * FROM users WHERE email=$1 AND password=$2", req.Email, req.Password)
    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    token, err := utils.GenerateJWT(user.ID)
    if err != nil {
        http.Error(w, "Token generation failed", http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{"token": token})
}
