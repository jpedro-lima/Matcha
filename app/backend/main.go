package main

import (
	"log"
	"net/http"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	if err := config.InitDB(); err != nil {
		log.Fatal(err)
	}
	go handlers.CleanupUnconfirmedUsers()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes (no auth required)
	r.Post("/register", handlers.Register)
	r.Post("/login", handlers.Login)
	r.Post("/logout", handlers.Logout)
	r.Get("/confirm", handlers.ConfirmEmail)
	r.Post("/forgot-password", handlers.ForgotPassword)
	r.Post("/reset-password", handlers.ResetPassword)

	// Authenticated routes — UpdateLastActive stamps last_active on every call
	r.Group(func(r chi.Router) {
		r.Use(handlers.UpdateLastActive)

		// Profile
		r.Post("/profiles", handlers.CreateProfile)
		r.Get("/profiles/me", handlers.GetMyProfile)
		r.Get("/profiles/{id}", handlers.GetProfile)
		r.Put("/profiles/{id}", handlers.UpdateProfile)
		r.Delete("/profiles/{id}", handlers.DeleteProfile)
		r.Post("/profiles/photos", handlers.UploadProfilePhotos)
		r.Delete("/profiles/photos", handlers.DeleteProfilePhoto)
		r.Patch("/update_password", handlers.UpdatePassword)

		// Discovery & matching
		r.Get("/matches", handlers.GetSuggestedProfile)
		r.Get("/browse", handlers.BrowseProfiles)
		r.Get("/search", handlers.SearchProfiles)
		r.Get("/matches/list", handlers.ListMatches)
		r.Post("/swipe", handlers.SwipeLike)
		r.Post("/unmatch", handlers.Unmatch)

		// Social (visitors, likers)
		r.Get("/visitors", handlers.GetVisitors)
		r.Get("/likers", handlers.GetLikers)

		// Notifications
		r.Get("/notifications", handlers.GetNotifications)
		r.Post("/notifications/read", handlers.MarkNotificationsRead)

		// Moderation
		r.Post("/reports", handlers.ReportUser)
		r.Post("/blocks", handlers.BlockUser)

		// Chat
		r.Get("/ws", handlers.ChatHandler)
		r.Get("/messages", handlers.GetMessagesHandler)
	})

	// Static assets
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	log.Println("Server running on :8080")
	http.ListenAndServe(":8080", r)
}
