package main

import (
 //   "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
	"os"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/jmoiron/sqlx"
    _ "github.com/lib/pq"
    "github.com/go-playground/validator/v10"
)

type User struct {
    Username   string `json:"username" db:"username"`
    FirstName  string `json:"first_name" db:"first_name"`
    LastName   string `json:"last_name" db:"last_name"`
    Email      string `json:"email" db:"email"`
    Password   string `json:"password" db:"password"`
}

type RegisterRequest struct {
    Username        string `json:"username" validate:"required"`
    FirstName       string `json:"first_name" validate:"required"`
    LastName        string `json:"last_name" validate:"required"`
    Email           string `json:"email" validate:"required,email"`
    Password        string `json:"password" validate:"required,min=8"`
    ValidatePassword string `json:"validate_password" validate:"required,eqfield=Password"`
}

func main() {
    db, err := sqlx.Connect("postgres", fmt.Sprintf(
    "user=%s password=%s dbname=%s host=%s port=%s sslmode=disable",
    os.Getenv("DB_USER"),
    os.Getenv("DB_PASSWORD"),
    os.Getenv("DB_NAME"),
    os.Getenv("DB_HOST"),
    os.Getenv("DB_PORT"),
))
if err != nil {
    log.Fatal(err)
}

    validate := validator.New()

    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    r.Post("/register", func(w http.ResponseWriter, r *http.Request) {
        var registerRequest RegisterRequest
        err := json.NewDecoder(r.Body).Decode(&registerRequest)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }

        err = validate.Struct(registerRequest)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }

        if registerRequest.Password != registerRequest.ValidatePassword {
            http.Error(w, "Passwords do not match", http.StatusBadRequest)
            return
        }

        _, err = db.Exec("INSERT INTO users (username, first_name, last_name, email, password) VALUES ($1, $2, $3, $4, $5)",
            registerRequest.Username, registerRequest.FirstName, registerRequest.LastName, registerRequest.Email, registerRequest.Password)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }

        w.WriteHeader(http.StatusCreated)
    })

    fmt.Println("Server is running on port 8080")
    http.ListenAndServe(":8080", r)
}
