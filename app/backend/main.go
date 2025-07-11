package main

import (
    "log"
    "net/http"

    "github.com/jpedro-lima/Matcha/config"
    "github.com/jpedro-lima/Matcha/handlers"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func main() {
    if err := config.InitDB(); err != nil {
        log.Fatal(err)
    }

    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    r.Post("/register", handlers.Register)
    r.Post("/login", handlers.Login)

    log.Println("Server running on :8080")
    http.ListenAndServe(":8080", r)
}
