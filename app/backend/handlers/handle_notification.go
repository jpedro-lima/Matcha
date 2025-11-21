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
	// Deduplication logic: check if a similar notification exists within the last 10 minutes
	var exists bool
	checkQuery := `
		SELECT EXISTS (
			SELECT 1 FROM notifications
			WHERE user_id = $1
			AND (sender_id = $2 OR ($2 IS NULL AND sender_id IS NULL))
			AND type = $3
			AND created_at > NOW() - INTERVAL '10 minutes'
		)
	`
	err := config.DB.Get(&exists, checkQuery, userID, senderID, notifType)
	if err != nil {
		log.Printf("Error checking for duplicate notification: %v", err)
		// Proceed to create if check fails, or return error? Let's proceed.
	}

	if exists {
		// Skip creating duplicate notification
		return nil
	}

	_, err = config.DB.Exec("INSERT INTO notifications (user_id, sender_id, type, content) VALUES ($1, $2, $3, $4)", userID, senderID, notifType, content)
	return err
}

func GetNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var notifications []models.Notification
	query := `
		SELECT n.*, (u.first_name || ' ' || u.last_name) as sender_name
		FROM notifications n
		LEFT JOIN users u ON n.sender_id = u.id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
	`
	err = config.DB.Select(&notifications, query, userID)
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
