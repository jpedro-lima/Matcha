package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/models"
	"github.com/jpedro-lima/Matcha/utils"
)

// CreateNotification helper function
func CreateNotification(userID int, senderID *int, notifType string, content string) error {
	_, err := config.DB.Exec("INSERT INTO notifications (user_id, sender_id, type, content) VALUES ($1, $2, $3, $4)", userID, senderID, notifType, content)
	return err
}

func GetNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var notifications []models.Notification
	err = config.DB.Select(&notifications, "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", userID)
	if err != nil {
		log.Printf("Error fetching notifications: %v", err)
		notifications = []models.Notification{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}

func MarkNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	_, err = config.DB.Exec("UPDATE notifications SET read = TRUE WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
