package handlers

import (
	"database/sql"
	"encoding/json"
	"math/rand"
	"net/http"
	"time"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/utils"
	"github.com/lib/pq"
)

// SuggestedProfile represents the lightweight view returned to frontend
type SuggestedProfile struct {
	ID           int    `json:"id" db:"id"`
	Bio          string `json:"bio" db:"bio"`
	Gender       string `json:"gender" db:"gender"`
	ProfilePhoto string `json:"profile_photos" db:"first_photo"`
}

func GetSuggestedProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get current user's profile
	var userProfile struct {
		Gender          string         `db:"gender"`
		PreferredGender pq.StringArray `db:"preferred_gender"`
		BirthDate       time.Time      `db:"birth_date"`
		Location        string         `db:"location"`
		SearchRadius    int            `db:"search_radius"`
	}
	err = config.DB.Get(&userProfile, `
        SELECT gender, preferred_gender, birth_date,
               ST_AsText(location) AS location, search_radius
        FROM profiles
        WHERE user_id = $1
    `, userID)
	if err != nil {
		http.Error(w, "Profile not found", http.StatusNotFound)
		return
	}

	// Calculate acceptable age range (example: 25–35)
	minAge := 25
	maxAge := 135
	today := time.Now()
	minBirth := today.AddDate(-maxAge, 0, 0)
	maxBirth := today.AddDate(-minAge, 0, 0)

	// Select nearby profiles that match gender & age preferences
	var suggestions []SuggestedProfile
	err = config.DB.Select(&suggestions, `
        SELECT p.id, p.bio, p.gender,
               COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo
        FROM profiles p
        WHERE p.user_id != $1
          AND $2 = ANY(p.preferred_gender) -- user is preferred by candidate
          AND p.gender = ANY($3)           -- candidate's gender matches user's preference
          AND p.birth_date BETWEEN $4 AND $5
          AND ST_Distance(p.location, ST_GeogFromText($6)) <= $7 * 1000
        ORDER BY p.last_active DESC
        LIMIT 10
    `, userID, userProfile.Gender, pq.Array(userProfile.PreferredGender),
		minBirth, maxBirth, userProfile.Location, userProfile.SearchRadius)
	if err != nil {
		http.Error(w, "Failed to retrieve suggestions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if len(suggestions) == 0 {
		http.Error(w, "No suitable profiles nearby", http.StatusNotFound)
		return
	}

	// Pick one profile at random from matches
	selected := suggestions[rand.Intn(len(suggestions))]

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(selected)
}

// SwipeLike creates a match if mutual like is detected
func SwipeLike(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		TargetProfileID int `json:"target_profile_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get target user ID from profile
	var targetUserID int
	err = config.DB.Get(&targetUserID, `SELECT user_id FROM profiles WHERE id = $1`, body.TargetProfileID)
	if err != nil {
		http.Error(w, "Target profile not found", http.StatusNotFound)
		return
	}

	// Sort for unique (user1_id, user2_id)
	user1, user2 := sortUsers(userID, targetUserID)

	// Check if match already exists
	var status string
	qErr := config.DB.Get(&status, `
        SELECT status FROM matches
        WHERE user1_id = $1 AND user2_id = $2
    `, user1, user2)

	if qErr == sql.ErrNoRows {
		// No match yet — insert pending
		_, insErr := config.DB.Exec(`
            INSERT INTO matches (user1_id, user2_id, matched_at, status)
            VALUES ($1, $2, $3, 'pending')
        `, user1, user2, time.Now())
		if insErr != nil {
			http.Error(w, "Failed to create match", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"status":"match created"}`))
		return
	} else if qErr != nil {
		http.Error(w, "Match lookup failed", http.StatusInternalServerError)
		return
	}

	if status == "pending" {
		_, upErr := config.DB.Exec(`
            UPDATE matches
            SET status = 'accepted', matched_at = $1
            WHERE user1_id = $2 AND user2_id = $3
        `, time.Now(), user1, user2)
		if upErr != nil {
			http.Error(w, "Failed to update match to accepted", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"match updated to accepted"}`))
		return
	}

	// Already accepted (or different status): return idempotent response
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"already accepted or error"}`))
}

func sortUsers(a, b int) (int, int) {
	if a < b {
		return a, b
	}
	return b, a
}

// Unmatch allows a user to remove an existing match (pending or accepted)
func Unmatch(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		TargetUserID    int `json:"target_user_id"`
		TargetProfileID int `json:"target_profile_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if body.TargetUserID == 0 && body.TargetProfileID == 0 {
		http.Error(w, "Provide target_user_id or target_profile_id", http.StatusBadRequest)
		return
	}

	// Resolve user id from profile if needed
	if body.TargetUserID == 0 {
		err = config.DB.Get(&body.TargetUserID, `SELECT user_id FROM profiles WHERE id=$1`, body.TargetProfileID)
		if err != nil {
			http.Error(w, "Target profile not found", http.StatusNotFound)
			return
		}
	}

	user1, user2 := sortUsers(userID, body.TargetUserID)
	res, err := config.DB.Exec(`DELETE FROM matches WHERE user1_id=$1 AND user2_id=$2`, user1, user2)
	if err != nil {
		http.Error(w, "Failed to unmatch", http.StatusInternalServerError)
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "Match not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"unmatched"}`))
}

// ListMatches returns all matches for the authenticated user with lightweight profile info
func ListMatches(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type MatchItem struct {
		MatchID     int    `db:"id" json:"match_id"`
		OtherUserID int    `db:"other_user_id" json:"other_user_id"`
		ProfileID   int    `db:"profile_id" json:"profile_id"`
		Name        string `db:"name" json:"name"`
		FirstPhoto  string `db:"first_photo" json:"first_photo"`
	}

	var items []MatchItem
	// Return matched conversations for the user; determine the other user for each row
	err = config.DB.Select(&items, `
		SELECT m.id,
			   CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END AS other_user_id,
			   p.id AS profile_id,
			   (u.first_name || ' ' || u.last_name) AS name,
			   COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo
		FROM matches m
		JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
		LEFT JOIN profiles p ON p.user_id = u.id
		WHERE m.user1_id = $1 OR m.user2_id = $1
		ORDER BY m.last_message_at DESC NULLS LAST, m.matched_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Failed to list matches: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}
