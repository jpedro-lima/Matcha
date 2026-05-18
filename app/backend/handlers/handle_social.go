package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/utils"
)

type SocialUser struct {
	SenderID   int    `db:"sender_id"   json:"sender_id"`
	Name       string `db:"name"        json:"name"`
	FirstPhoto string `db:"first_photo" json:"first_photo"`
	EventAt    string `db:"event_at"    json:"event_at"`
}

// GET /visitors — users who viewed my profile (most recent per sender)
func GetVisitors(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	visitors := make([]SocialUser, 0)
	err = config.DB.Select(&visitors, `
		SELECT DISTINCT ON (n.sender_id)
			n.sender_id,
			(u.first_name || ' ' || u.last_name) AS name,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			n.created_at::text AS event_at
		FROM notifications n
		JOIN users u ON u.id = n.sender_id
		LEFT JOIN profiles p ON p.user_id = n.sender_id
		WHERE n.user_id = $1 AND n.type = 'view' AND n.sender_id IS NOT NULL
		ORDER BY n.sender_id, n.created_at DESC
	`, userID)
	if err != nil {
		visitors = []SocialUser{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(visitors)
}

// GET /likers — users who liked my profile (most recent per sender)
func GetLikers(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	likers := make([]SocialUser, 0)
	err = config.DB.Select(&likers, `
		SELECT DISTINCT ON (n.sender_id)
			n.sender_id,
			(u.first_name || ' ' || u.last_name) AS name,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			n.created_at::text AS event_at
		FROM notifications n
		JOIN users u ON u.id = n.sender_id
		LEFT JOIN profiles p ON p.user_id = n.sender_id
		WHERE n.user_id = $1 AND n.type = 'like' AND n.sender_id IS NOT NULL
		ORDER BY n.sender_id, n.created_at DESC
	`, userID)
	if err != nil {
		likers = []SocialUser{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(likers)
}
