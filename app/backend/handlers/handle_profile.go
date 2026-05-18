package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/models"
	"github.com/jpedro-lima/Matcha/utils"

	"github.com/lib/pq"
)

// UpdateLastActive is middleware that stamps last_active on every authenticated request.
func UpdateLastActive(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if userID, err := utils.GetUserIDFromRequest(r); err == nil {
			config.DB.Exec(`UPDATE profiles SET last_active = NOW() WHERE user_id = $1`, userID)
		}
		next.ServeHTTP(w, r)
	})
}

func CreateProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		log.Printf("Auth error: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var profile models.Profile
	if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	profile.UserID = userID

	if profile.Location == "" || profile.Location == "POINT(0 0)" {
		http.Error(w, "Location is required. Please allow GPS or enter your city.", http.StatusBadRequest)
		return
	}
	if len(profile.PreferredGender) == 0 {
		profile.PreferredGender = pq.StringArray{"male", "female", "non-binary"}
	}

	attributesJSON, _ := json.Marshal(profile.Attributes)
	lookingForJSON, _ := json.Marshal(profile.LookingFor)
	profilePhotosJSON, _ := json.Marshal(profile.ProfilePhotos)

	var existingID int
	if err := config.DB.QueryRow("SELECT id FROM profiles WHERE user_id = $1", userID).Scan(&existingID); err == nil {
		_, err := config.DB.Exec(`
			UPDATE profiles SET
				bio = $1, gender = $2, preferred_gender = $3, birth_date = $4,
				location = ST_GeogFromText($5), search_radius = $6, tags = $7,
				attributes = $8::jsonb, looking_for = $9::jsonb, profile_photos = $10::jsonb,
				updated_at = NOW()
			WHERE user_id = $11
		`,
			profile.Bio, profile.Gender, pq.Array(profile.PreferredGender),
			profile.BirthDate, profile.Location, profile.SearchRadius,
			pq.Array(profile.Tags), attributesJSON, lookingForJSON, profilePhotosJSON, userID,
		)
		if err != nil {
			http.Error(w, "Failed to update profile: "+err.Error(), http.StatusInternalServerError)
			return
		}
		profile.ID = existingID
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(profile)
		return
	}

	err = config.DB.QueryRow(`
		INSERT INTO profiles (user_id, bio, gender, preferred_gender, birth_date, location,
			search_radius, tags, attributes, looking_for, profile_photos)
		VALUES ($1, $2, $3, $4, $5, ST_GeogFromText($6), $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
		RETURNING id
	`,
		profile.UserID, profile.Bio, profile.Gender, pq.Array(profile.PreferredGender),
		profile.BirthDate, profile.Location, profile.SearchRadius,
		pq.Array(profile.Tags), attributesJSON, lookingForJSON, profilePhotosJSON,
	).Scan(&profile.ID)
	if err != nil {
		http.Error(w, "Failed to create profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(profile)
}

func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	profileID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid profile ID", http.StatusBadRequest)
		return
	}

	var updated models.Profile
	if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	var birthDate interface{} = updated.BirthDate
	if updated.BirthDate == "" {
		birthDate = nil
	}

	attributesJSON, _ := json.Marshal(updated.Attributes)
	lookingForJSON, _ := json.Marshal(updated.LookingFor)
	profilePhotosJSON, _ := json.Marshal(updated.ProfilePhotos)

	if string(attributesJSON) == "null" {
		attributesJSON = []byte("[]")
	}
	if string(lookingForJSON) == "null" {
		lookingForJSON = []byte("[]")
	}
	if string(profilePhotosJSON) == "null" {
		profilePhotosJSON = []byte("[]")
	}

	var locParam interface{}
	if updated.Location != "" {
		locParam = updated.Location
	}

	err = config.DB.QueryRow(`
		UPDATE profiles SET
			bio = COALESCE($1, bio), gender = COALESCE($2, gender),
			preferred_gender = COALESCE($3, preferred_gender),
			birth_date = COALESCE($4, birth_date),
			location = COALESCE(ST_GeogFromText($5), location),
			search_radius = COALESCE($6, search_radius), tags = COALESCE($7, tags),
			attributes = COALESCE($8::jsonb, attributes),
			looking_for = COALESCE($9::jsonb, looking_for),
			profile_photos = COALESCE($10::jsonb, profile_photos),
			updated_at = NOW()
		WHERE id = $11 AND user_id = $12
		RETURNING id
	`,
		updated.Bio, updated.Gender, pq.Array(updated.PreferredGender), birthDate,
		locParam, updated.SearchRadius, pq.Array(updated.Tags),
		attributesJSON, lookingForJSON, profilePhotosJSON, profileID, userID,
	).Scan(&updated.ID)
	if err != nil {
		http.Error(w, "Failed to update profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	updated.ID = profileID
	updated.UserID = userID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func DeleteProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	profileID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid profile ID", http.StatusBadRequest)
		return
	}

	res, err := config.DB.Exec("DELETE FROM profiles WHERE id = $1 AND user_id = $2", profileID, userID)
	if err != nil {
		http.Error(w, "Failed to delete profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	count, err := res.RowsAffected()
	if err != nil || count == 0 {
		http.Error(w, "Profile not found or not authorized", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func GetMyProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var p models.Profile
	var attributesBytes, lookingForBytes, profilePhotosBytes []byte
	var preferredGender pq.StringArray
	var tags pq.StringArray
	var firstName, lastName string
	var locationText sqlNullString
	var birthDate sqlNullString

	row := config.DB.QueryRow(`
		SELECT p.id, p.user_id, p.bio, p.gender, p.preferred_gender, p.birth_date,
			p.search_radius, p.tags, p.attributes::text, p.looking_for::text,
			p.profile_photos::text, ST_AsText(p.location), p.fame_rating, p.last_active, p.created_at, p.updated_at,
			u.first_name, u.last_name
		FROM profiles p
		JOIN users u ON u.id = p.user_id
		WHERE p.user_id = $1
	`, userID)

	err = row.Scan(&p.ID, &p.UserID, &p.Bio, &p.Gender, &preferredGender, &birthDate,
		&p.SearchRadius, &tags, &attributesBytes, &lookingForBytes, &profilePhotosBytes,
		&locationText, &p.FameRating, &p.LastActive, &p.CreatedAt, &p.UpdatedAt, &firstName, &lastName)
	if err != nil {
		http.Error(w, "Profile not found: "+err.Error(), http.StatusNotFound)
		return
	}

	p.PreferredGender = preferredGender
	p.Tags = tags
	if locationText.Valid {
		p.Location = locationText.String
	}
	if birthDate.Valid {
		p.BirthDate = birthDate.String
	}

	var attrs map[string]interface{}
	var looking map[string]interface{}
	var photos []string
	if len(attributesBytes) > 0 {
		_ = json.Unmarshal(attributesBytes, &attrs)
	}
	if len(lookingForBytes) > 0 {
		_ = json.Unmarshal(lookingForBytes, &looking)
	}
	if len(profilePhotosBytes) > 0 {
		_ = json.Unmarshal(profilePhotosBytes, &photos)
	}
	if attrs != nil {
		p.Attributes = attrs
	} else {
		p.Attributes = map[string]interface{}{}
	}
	if looking != nil {
		p.LookingFor = looking
	} else {
		p.LookingFor = map[string]interface{}{}
	}
	p.ProfilePhotos = photos

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"profile":    p,
		"first_name": firstName,
		"last_name":  lastName,
	})
}

func UploadProfilePhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		http.Error(w, "No files provided", http.StatusBadRequest)
		return
	}

	// Check existing photo count
	var existingBytes []byte
	config.DB.QueryRow("SELECT profile_photos::text FROM profiles WHERE user_id = $1", userID).Scan(&existingBytes)
	var existing []string
	if len(existingBytes) > 0 {
		_ = json.Unmarshal(existingBytes, &existing)
	}
	if len(existing)+len(files) > 5 {
		http.Error(w, "Maximum 5 photos allowed", http.StatusBadRequest)
		return
	}

	uploadDir := "static/uploads"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		http.Error(w, "Failed to create upload dir", http.StatusInternalServerError)
		return
	}

	allowedTypes := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true,
	}
	extensions := map[string]string{
		"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
	}

	var newUrls []string
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			continue
		}

		// Read first 512 bytes to detect MIME type
		buffer := make([]byte, 512)
		n, err := f.Read(buffer)
		if err != nil && err != io.EOF {
			f.Close()
			continue
		}
		contentType := http.DetectContentType(buffer[:n])
		if !allowedTypes[contentType] {
			f.Close()
			http.Error(w, "Only image files (JPEG, PNG, GIF, WebP) are allowed", http.StatusBadRequest)
			return
		}

		// Seek back to start
		if seeker, ok := f.(io.Seeker); ok {
			seeker.Seek(0, io.SeekStart)
		}

		ext := extensions[contentType]
		name := uuid.New().String() + ext
		dstPath := filepath.Join(uploadDir, name)

		out, err := os.Create(dstPath)
		if err != nil {
			f.Close()
			continue
		}
		if _, err := io.Copy(out, f); err != nil {
			out.Close()
			f.Close()
			continue
		}
		out.Close()
		f.Close()
		newUrls = append(newUrls, "/static/uploads/"+name)
	}

	if len(newUrls) == 0 {
		http.Error(w, "No valid image files saved", http.StatusBadRequest)
		return
	}

	merged := append(existing, newUrls...)
	mergedBytes, _ := json.Marshal(merged)

	_, err = config.DB.Exec(
		"UPDATE profiles SET profile_photos = $1::jsonb, updated_at = NOW() WHERE user_id = $2",
		mergedBytes, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update profile photos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"profile_photos": merged})
}

func DeleteProfilePhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URL == "" {
		http.Error(w, "Photo URL required", http.StatusBadRequest)
		return
	}

	var existingBytes []byte
	config.DB.QueryRow("SELECT profile_photos::text FROM profiles WHERE user_id=$1", userID).Scan(&existingBytes)
	var photos []string
	if len(existingBytes) > 0 {
		_ = json.Unmarshal(existingBytes, &photos)
	}

	var updated []string
	found := false
	for _, p := range photos {
		if p != req.URL {
			updated = append(updated, p)
		} else {
			found = true
		}
	}
	cleanURL := path.Clean(req.URL)
	if !found || cleanURL != req.URL || !strings.HasPrefix(req.URL, "/static/uploads/") {
		http.Error(w, "Photo not found", http.StatusNotFound)
		return
	}

	merged, _ := json.Marshal(updated)
	config.DB.Exec("UPDATE profiles SET profile_photos=$1::jsonb, updated_at=NOW() WHERE user_id=$2", merged, userID)

	// Remove physical file (ignore error if already gone)
	os.Remove(filepath.Join("static", "uploads", filepath.Base(req.URL)))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"profile_photos": updated})
}

func GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	targetIDStr := chi.URLParam(r, "id")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil {
		http.Error(w, "Invalid profile ID", http.StatusBadRequest)
		return
	}

	var profile models.Profile
	var attributesBytes, lookingForBytes, profilePhotosBytes []byte
	var preferredGender pq.StringArray
	var tags pq.StringArray
	var locationText sqlNullString
	var birthDate sqlNullString

	err = config.DB.QueryRow(`
		SELECT id, user_id, bio, gender, preferred_gender, birth_date, search_radius, tags,
			ST_AsText(location) as location, attributes::text, looking_for::text, profile_photos::text,
			fame_rating, last_active, created_at, updated_at
		FROM profiles WHERE id = $1
	`, targetID).Scan(
		&profile.ID, &profile.UserID, &profile.Bio, &profile.Gender, &preferredGender, &birthDate,
		&profile.SearchRadius, &tags, &locationText, &attributesBytes, &lookingForBytes,
		&profilePhotosBytes, &profile.FameRating, &profile.LastActive, &profile.CreatedAt,
		&profile.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "Profile not found", http.StatusNotFound)
		return
	}
	profile.PreferredGender = preferredGender
	profile.Tags = tags
	if birthDate.Valid {
		profile.BirthDate = birthDate.String
	}
	if locationText.Valid {
		profile.Location = locationText.String
	}
	if len(attributesBytes) > 0 {
		_ = json.Unmarshal(attributesBytes, &profile.Attributes)
	}
	if profile.Attributes == nil {
		profile.Attributes = map[string]interface{}{}
	}
	if len(lookingForBytes) > 0 {
		_ = json.Unmarshal(lookingForBytes, &profile.LookingFor)
	}
	if profile.LookingFor == nil {
		profile.LookingFor = map[string]interface{}{}
	}
	if len(profilePhotosBytes) > 0 {
		var photos []string
		_ = json.Unmarshal(profilePhotosBytes, &photos)
		profile.ProfilePhotos = photos
	}

	// Determine online status (active within last 5 minutes)
	lastActive, _ := time.Parse(time.RFC3339, profile.LastActive)
	profile.IsOnline = time.Since(lastActive) < 5*time.Minute

	// Record view notification and adjust fame if viewing someone else
	if profile.UserID != userID {
		CreateNotification(profile.UserID, &userID, "view", "Someone viewed your profile")
		utils.AdjustFame(profile.UserID, 1)
	}

	// Determine relationship status between viewer and profile owner
	relStatus := "none"
	config.DB.QueryRow(`
		SELECT
			CASE
				WHEN EXISTS (
					SELECT 1 FROM matches
					WHERE ((user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1))
					  AND status='accepted'
				) THEN 'connected'
				WHEN EXISTS (
					SELECT 1 FROM matches
					WHERE user1_id=LEAST($1,$2) AND user2_id=GREATEST($1,$2)
					  AND status='pending'
				) THEN 'pending'
				WHEN EXISTS (
					SELECT 1 FROM notifications
					WHERE user_id=$1 AND sender_id=$2 AND type='like'
				) THEN 'liked_you'
				ELSE 'none'
			END
	`, userID, profile.UserID).Scan(&relStatus)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"profile":         profile,
		"relation_status": relStatus,
	})
}

// sqlNullString scans nullable text from DB
type sqlNullString struct {
	String string
	Valid  bool
}

func (n *sqlNullString) Scan(value interface{}) error {
	if value == nil {
		n.String, n.Valid = "", false
		return nil
	}
	switch v := value.(type) {
	case string:
		n.String, n.Valid = v, true
	case []byte:
		n.String, n.Valid = string(v), true
	default:
		n.String, n.Valid = "", false
	}
	return nil
}
