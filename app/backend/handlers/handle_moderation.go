package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/utils"
)

// ReportUser allows an authenticated user to report another user for misconduct.
// Body: { "target_user_id": <int>, "reason": "string" }
func ReportUser(w http.ResponseWriter, r *http.Request) {
	reporterID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		TargetUserID int    `json:"target_user_id"`
		Reason       string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.TargetUserID == 0 || body.TargetUserID == reporterID {
		http.Error(w, "Invalid target user", http.StatusBadRequest)
		return
	}

	// Insert report, respecting unique constraint (one report per reporter/target)
	_, err = config.DB.Exec(`INSERT INTO reports (reporter_id, target_id, reason) VALUES ($1, $2, $3)`, reporterID, body.TargetUserID, body.Reason)
	if err != nil {
		http.Error(w, "You already reported this user or DB error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Count reports for target
	var count int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM reports WHERE target_id = $1`, body.TargetUserID).Scan(&count)

	// If 5 or more, ban the user
	banned := false
	if count >= 5 {
		_, _ = config.DB.Exec(`UPDATE users SET banned = TRUE WHERE id = $1`, body.TargetUserID)
		banned = true
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"reports": count, "banned": banned})
}

// BlockUser allows the authenticated user to block another user. This will also unmatch them if matched.
// Body: { "target_user_id": <int> }
func BlockUser(w http.ResponseWriter, r *http.Request) {
	blockerID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		TargetUserID int `json:"target_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.TargetUserID == 0 || body.TargetUserID == blockerID {
		http.Error(w, "Invalid target user", http.StatusBadRequest)
		return
	}

	// Insert block (unique constraint prevents duplicates)
	_, err = config.DB.Exec(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, blockerID, body.TargetUserID)
	if err != nil {
		http.Error(w, "Failed to block user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Remove any existing match between users
	user1, user2 := sortUsers(blockerID, body.TargetUserID)
	_, _ = config.DB.Exec(`DELETE FROM matches WHERE user1_id = $1 AND user2_id = $2`, user1, user2)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "blocked"})
}
