package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/utils"
	"github.com/lib/pq"
)

type SuggestedProfile struct {
	ID             int            `json:"id" db:"id"`
	Bio            string         `json:"bio" db:"bio"`
	Gender         string         `json:"gender" db:"gender"`
	ProfilePhoto   string         `json:"profile_photos" db:"first_photo"`
	FameRating     int            `json:"fame_rating" db:"fame_rating"`
	Tags           pq.StringArray `json:"tags" db:"tags"`
	DistanceMeters float64        `json:"distance_meters" db:"distance_meters"`
	CommonTags     int            `json:"common_tags" db:"common_tags"`
}

func GetSuggestedProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

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
		FROM profiles WHERE user_id = $1
	`, userID)
	if err != nil {
		http.Error(w, "Profile not found. Please complete your profile first.", http.StatusNotFound)
		return
	}
	preferredGender := normalizedPreferredGender(userProfile.PreferredGender)

	minAge, maxAge := 18, 99
	today := time.Now()
	minBirth := today.AddDate(-maxAge, 0, 0)
	maxBirth := today.AddDate(-minAge, 0, 0)

	var suggestions []SuggestedProfile
	err = config.DB.Select(&suggestions, `
		SELECT p.id, p.bio, p.gender,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			p.fame_rating, p.tags,
			ST_Distance(p.location, ST_GeogFromText($6)) AS distance_meters,
			0 AS common_tags
		FROM profiles p
		WHERE p.user_id != $1
		  AND $2 = ANY(p.preferred_gender)
		  AND p.gender = ANY($3)
		  AND p.birth_date BETWEEN $4 AND $5
		  AND p.location IS NOT NULL
		  AND NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
			   OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM matches m
			WHERE (m.user1_id = LEAST($1, p.user_id) AND m.user2_id = GREATEST($1, p.user_id))
			  AND (
				m.status = 'accepted'
				OR (
					m.status = 'pending'
					AND NOT EXISTS (
						SELECT 1 FROM notifications n
						WHERE n.user_id = $1
						  AND n.sender_id = p.user_id
						  AND n.type = 'like'
					)
				)
			  )
		  )
		ORDER BY p.fame_rating DESC, p.last_active DESC
		LIMIT 20
	`, userID, userProfile.Gender, pq.Array(preferredGender),
		minBirth, maxBirth, userProfile.Location)
	if err != nil {
		http.Error(w, "Failed to retrieve suggestions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if len(suggestions) == 0 {
		http.Error(w, "No suitable profiles nearby", http.StatusNotFound)
		return
	}

	selected := suggestions[rand.Intn(len(suggestions))]
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(selected)
}

// BrowseProfiles returns a sorted/filtered list of profiles.
func BrowseProfiles(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var userProfile struct {
		Gender          string         `db:"gender"`
		PreferredGender pq.StringArray `db:"preferred_gender"`
		Location        string         `db:"location"`
		SearchRadius    int            `db:"search_radius"`
		Tags            pq.StringArray `db:"tags"`
	}
	if err := config.DB.Get(&userProfile, `
		SELECT gender, preferred_gender, ST_AsText(location) AS location, search_radius, tags
		FROM profiles WHERE user_id = $1
	`, userID); err != nil {
		http.Error(w, "Profile not found", http.StatusNotFound)
		return
	}
	preferredGender := normalizedPreferredGender(userProfile.PreferredGender)

	q := r.URL.Query()
	minAge, _ := strconv.Atoi(q.Get("min_age"))
	maxAge, _ := strconv.Atoi(q.Get("max_age"))
	minFame, _ := strconv.Atoi(q.Get("min_fame"))
	maxFame, _ := strconv.Atoi(q.Get("max_fame"))
	sortBy := q.Get("sort_by")   // age | fame | location | tags
	sortDir := q.Get("sort_dir") // asc | desc
	tagsParam := q.Get("tags")

	if minAge == 0 {
		minAge = 18
	}
	if maxAge == 0 {
		maxAge = 99
	}
	if maxFame == 0 {
		maxFame = 100
	}
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	today := time.Now()
	minBirth := today.AddDate(-maxAge, 0, 0)
	maxBirth := today.AddDate(-minAge, 0, 0)

	var filterTags pq.StringArray
	if tagsParam != "" {
		for _, t := range strings.Split(tagsParam, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				filterTags = append(filterTags, t)
			}
		}
	}
	var filterTagsParam interface{}
	if len(filterTags) > 0 {
		filterTagsParam = pq.Array(filterTags)
	}

	orderClause := buildOrderClause(sortBy, sortDir)

	query := fmt.Sprintf(`
		SELECT p.id, p.bio, p.gender,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			p.fame_rating, p.tags,
			ST_Distance(p.location, ST_GeogFromText($8)) AS distance_meters,
			(
				SELECT COUNT(*)
				FROM unnest(COALESCE(p.tags, '{}'::varchar[])) AS tag
				WHERE tag = ANY($9)
			) AS common_tags
		FROM profiles p
		WHERE p.user_id != $1
		  AND $2 = ANY(p.preferred_gender)
		  AND p.gender = ANY($3)
		  AND p.birth_date BETWEEN $4 AND $5
		  AND p.fame_rating BETWEEN $6 AND $7
		  AND p.location IS NOT NULL
		  AND ($10::varchar[] IS NULL OR p.tags && $10)
		  AND NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id)
			   OR (b.blocker_id=p.user_id AND b.blocked_id=$1)
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM matches m
			WHERE m.user1_id = LEAST($1, p.user_id)
			  AND m.user2_id = GREATEST($1, p.user_id)
			  AND (
				m.status = 'accepted'
				OR (
					m.status = 'pending'
					AND NOT EXISTS (
						SELECT 1 FROM notifications n
						WHERE n.user_id = $1
						  AND n.sender_id = p.user_id
						  AND n.type = 'like'
					)
				)
			  )
		  )
		%s
		LIMIT 50
	`, orderClause)

	var results []SuggestedProfile
	err = config.DB.Select(&results, query,
		userID, userProfile.Gender, pq.Array(preferredGender),
		minBirth, maxBirth, minFame, maxFame,
		userProfile.Location, pq.Array(userProfile.Tags), filterTagsParam,
	)
	if err != nil {
		http.Error(w, "Failed to browse profiles: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if results == nil {
		results = []SuggestedProfile{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// SearchProfiles performs an advanced search without location radius constraint.
func SearchProfiles(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var userProfile struct {
		Location string         `db:"location"`
		Tags     pq.StringArray `db:"tags"`
	}
	_ = config.DB.Get(&userProfile, `
		SELECT COALESCE(ST_AsText(location), '') AS location, COALESCE(tags, '{}'::varchar[]) AS tags
		FROM profiles WHERE user_id = $1
	`, userID)

	q := r.URL.Query()
	minAge, _ := strconv.Atoi(q.Get("min_age"))
	maxAge, _ := strconv.Atoi(q.Get("max_age"))
	minFame, _ := strconv.Atoi(q.Get("min_fame"))
	maxFame, _ := strconv.Atoi(q.Get("max_fame"))
	sortBy := q.Get("sort_by")
	sortDir := q.Get("sort_dir")
	tagsParam := q.Get("tags")

	if minAge == 0 {
		minAge = 18
	}
	if maxAge == 0 {
		maxAge = 99
	}
	if maxFame == 0 {
		maxFame = 100
	}
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	today := time.Now()
	minBirth := today.AddDate(-maxAge, 0, 0)
	maxBirth := today.AddDate(-minAge, 0, 0)

	var filterTags pq.StringArray
	if tagsParam != "" {
		for _, t := range strings.Split(tagsParam, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				filterTags = append(filterTags, t)
			}
		}
	}
	var filterTagsParam interface{}
	if len(filterTags) > 0 {
		filterTagsParam = pq.Array(filterTags)
	}

	orderClause := buildOrderClause(sortBy, sortDir)
	locationExpr := "0::float8"
	if userProfile.Location != "" {
		locationExpr = "ST_Distance(p.location, ST_GeogFromText($6))"
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.bio, p.gender,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			p.fame_rating, p.tags,
			%s AS distance_meters,
			(
				SELECT COUNT(*)
				FROM unnest(COALESCE(p.tags, '{}'::varchar[])) AS tag
				WHERE tag = ANY($7)
			) AS common_tags
		FROM profiles p
		WHERE p.user_id != $1
		  AND p.birth_date BETWEEN $2 AND $3
		  AND p.fame_rating BETWEEN $4 AND $5
		  AND ($8::varchar[] IS NULL OR p.tags && $8)
		  AND NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id)
			   OR (b.blocker_id=p.user_id AND b.blocked_id=$1)
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM matches m
			WHERE m.user1_id = LEAST($1, p.user_id)
			  AND m.user2_id = GREATEST($1, p.user_id)
			  AND (
				m.status = 'accepted'
				OR (
					m.status = 'pending'
					AND NOT EXISTS (
						SELECT 1 FROM notifications n
						WHERE n.user_id = $1
						  AND n.sender_id = p.user_id
						  AND n.type = 'like'
					)
				)
			  )
		  )
		%s
		LIMIT 50
	`, locationExpr, orderClause)

	var results []SuggestedProfile
	err = config.DB.Select(&results, query,
		userID, minBirth, maxBirth, minFame, maxFame,
		userProfile.Location, pq.Array(userProfile.Tags), filterTagsParam,
	)
	if err != nil {
		http.Error(w, "Search failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if results == nil {
		results = []SuggestedProfile{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func buildOrderClause(sortBy, sortDir string) string {
	dir := "DESC"
	if sortDir == "asc" {
		dir = "ASC"
	}
	switch sortBy {
	case "age":
		return fmt.Sprintf("ORDER BY p.birth_date %s", dir)
	case "fame":
		return fmt.Sprintf("ORDER BY p.fame_rating %s", dir)
	case "location":
		return fmt.Sprintf("ORDER BY distance_meters %s NULLS LAST", dir)
	case "tags":
		return fmt.Sprintf("ORDER BY common_tags %s, p.fame_rating DESC", dir)
	default:
		return "ORDER BY distance_meters ASC NULLS LAST, common_tags DESC, p.fame_rating DESC"
	}
}

func normalizedPreferredGender(preferred pq.StringArray) pq.StringArray {
	if len(preferred) == 0 {
		return pq.StringArray{"male", "female", "non-binary"}
	}
	return preferred
}

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

	var targetUserID int
	err = config.DB.Get(&targetUserID, `SELECT user_id FROM profiles WHERE id = $1`, body.TargetProfileID)
	if err != nil {
		http.Error(w, "Target profile not found", http.StatusNotFound)
		return
	}

	// Check current user has a profile photo (required to like)
	var photoCount int
	config.DB.QueryRow(`
		SELECT jsonb_array_length(profile_photos::jsonb) FROM profiles WHERE user_id=$1
	`, userID).Scan(&photoCount)
	if photoCount == 0 {
		http.Error(w, "You need a profile picture to like someone.", http.StatusBadRequest)
		return
	}

	user1, user2 := sortUsers(userID, targetUserID)

	var status string
	qErr := config.DB.Get(&status, `
		SELECT status FROM matches WHERE user1_id = $1 AND user2_id = $2
	`, user1, user2)

	if qErr == sql.ErrNoRows {
		_, insErr := config.DB.Exec(`
			INSERT INTO matches (user1_id, user2_id, matched_at, status)
			VALUES ($1, $2, $3, 'pending')
		`, user1, user2, time.Now())
		if insErr != nil {
			http.Error(w, "Failed to create match", http.StatusInternalServerError)
			return
		}
		CreateNotification(targetUserID, &userID, "like", "Someone liked your profile")
		utils.AdjustFame(targetUserID, 5)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"status":"match created"}`))
		return
	} else if qErr != nil {
		http.Error(w, "Match lookup failed", http.StatusInternalServerError)
		return
	}

	if status == "pending" {
		var likedBack bool
		err = config.DB.Get(&likedBack, `
			SELECT EXISTS (
				SELECT 1 FROM notifications
				WHERE user_id=$1 AND sender_id=$2 AND type='like'
			)
		`, userID, targetUserID)
		if err != nil {
			http.Error(w, "Match lookup failed", http.StatusInternalServerError)
			return
		}
		if !likedBack {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"already liked"}`))
			return
		}

		_, upErr := config.DB.Exec(`
			UPDATE matches SET status = 'accepted', matched_at = $1
			WHERE user1_id = $2 AND user2_id = $3
		`, time.Now(), user1, user2)
		if upErr != nil {
			http.Error(w, "Failed to confirm match", http.StatusInternalServerError)
			return
		}
		CreateNotification(targetUserID, &userID, "match", "You have a new match!")
		CreateNotification(userID, &targetUserID, "match", "You have a new match!")
		utils.AdjustFame(targetUserID, 10)
		utils.AdjustFame(userID, 10)

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"match updated to accepted"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"already accepted"}`))
}

func sortUsers(a, b int) (int, int) {
	if a < b {
		return a, b
	}
	return b, a
}

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

	CreateNotification(body.TargetUserID, &userID, "unlike", "Someone unliked you")
	utils.AdjustFame(body.TargetUserID, -5)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"unmatched"}`))
}

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
		Status      string `db:"status" json:"status"`
	}

	var items []MatchItem
	err = config.DB.Select(&items, `
		SELECT m.id,
			CASE WHEN m.user1_id=$1 THEN m.user2_id ELSE m.user1_id END AS other_user_id,
			p.id AS profile_id,
			(u.first_name || ' ' || u.last_name) AS name,
			COALESCE((p.profile_photos::jsonb ->> 0), '') AS first_photo,
			m.status
		FROM matches m
		JOIN users u ON u.id = CASE WHEN m.user1_id=$1 THEN m.user2_id ELSE m.user1_id END
		LEFT JOIN profiles p ON p.user_id = u.id
		WHERE (m.user1_id=$1 OR m.user2_id=$1)
		  AND m.status = 'accepted'
		  AND NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id=m.user1_id AND b.blocked_id=m.user2_id)
			   OR (b.blocker_id=m.user2_id AND b.blocked_id=m.user1_id)
		  )
		ORDER BY m.last_message_at DESC NULLS LAST, m.matched_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Failed to list matches: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []MatchItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}
