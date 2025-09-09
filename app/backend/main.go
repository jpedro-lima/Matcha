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
	go handlers.CleanupUnconfirmedUsers()
    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    r.Post("/register", handlers.Register)
    r.Post("/login", handlers.Login)
	r.Patch("/logout", handlers.Logout)
	r.Post("/profiles", handlers.CreateProfile)
	r.Patch("/update_password", handlers.UpdatePassword)
    r.Put("/profiles/{id}", handlers.UpdateProfile)
    r.Delete("/profiles/{id}", handlers.DeleteProfile)
	r.Get("/confirm", handlers.ConfirmEmail)
	r.Get("/chat", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "chat.html")
})
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
    handlers.ChatHandler(w, r)
})
	r.Get("/matches", handlers.GetSuggestedProfile)
	r.Post("/swipe", handlers.SwipeLike)
	log.Println("Server running on :8080")
	http.ListenAndServe(":8080", r)
}
