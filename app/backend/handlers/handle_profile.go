package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jpedro-lima/Matcha/config"
	"github.com/jpedro-lima/Matcha/models"
	"github.com/jpedro-lima/Matcha/utils"

	"github.com/lib/pq"
)

func CreateProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		log.Printf("Auth error: %v", err)
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var profile models.Profile
	if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	profile.UserID = userID
	// Ensure location fallback before any DB operations
	if profile.Location == "" {
		profile.Location = "POINT(0 0)"
	}

	// Marshal JSONB fields early so we can reuse them for upsert/update
	attributesJSON, err := json.Marshal(profile.Attributes)
	if err != nil {
		http.Error(w, "Failed to serialize attributes", http.StatusBadRequest)
		return
	}

	lookingForJSON, err := json.Marshal(profile.LookingFor)
	if err != nil {
		http.Error(w, "Failed to serialize looking_for", http.StatusBadRequest)
		return
	}

	profilePhotosJSON, err := json.Marshal(profile.ProfilePhotos)
	if err != nil {
		http.Error(w, "Failed to serialize profile_photos", http.StatusBadRequest)
		return
	}

	// If a profile for this user already exists, update it instead of inserting to avoid unique constraint errors.
	var existingID int
	if err := config.DB.QueryRow("SELECT id FROM profiles WHERE user_id = $1", userID).Scan(&existingID); err == nil {
		// existing profile found -> perform update
		_, err := config.DB.Exec(`
			UPDATE profiles SET
				bio = $1,
				gender = $2,
				preferred_gender = $3,
				birth_date = $4,
				location = ST_GeogFromText($5),
				search_radius = $6,
				tags = $7,
				attributes = $8::jsonb,
				looking_for = $9::jsonb,
				profile_photos = $10::jsonb,
				updated_at = NOW()
			WHERE user_id = $11
		`,
			profile.Bio,
			profile.Gender,
			pq.Array(profile.PreferredGender),
			profile.BirthDate,
			profile.Location,
			profile.SearchRadius,
			pq.Array(profile.Tags),
			attributesJSON,
			lookingForJSON,
			profilePhotosJSON,
			userID,
		)
		if err != nil {
			http.Error(w, "Failed to update existing profile: "+err.Error(), http.StatusInternalServerError)
			return
		}
		profile.ID = existingID
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(profile)
		return
	}

	query := `
        INSERT INTO profiles (
            user_id, bio, gender, preferred_gender, birth_date, location,
            search_radius, tags, attributes, looking_for, profile_photos
        )
        VALUES ($1, $2, $3, $4, $5, ST_GeogFromText($6), $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
        RETURNING id
    `
	err = config.DB.QueryRow(
		query,
		profile.UserID,                    // $1
		profile.Bio,                       // $2
		profile.Gender,                    // $3
		pq.Array(profile.PreferredGender), // $4
		profile.BirthDate,                 // $5
		profile.Location,                  // $6 (WKT)
		profile.SearchRadius,              // $7
		pq.Array(profile.Tags),            // $8
		attributesJSON,                    // $9
		lookingForJSON,                    // $10
		profilePhotosJSON,                 // $11
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
		http.Error(w, "Unauthorized4", http.StatusUnauthorized)
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

	// Validate birth date - convert empty string to nil
	var birthDate interface{} = updated.BirthDate
	if updated.BirthDate == "" {
		birthDate = nil
	}

	// Marshal JSONB fields with empty array defaults
	attributesJSON, err := json.Marshal(updated.Attributes)
	if err != nil {
		http.Error(w, "Failed to serialize attributes", http.StatusBadRequest)
		return
	}
	if string(attributesJSON) == "null" {
		attributesJSON = []byte("[]")
	}

	lookingForJSON, err := json.Marshal(updated.LookingFor)
	if err != nil {
		http.Error(w, "Failed to serialize looking_for", http.StatusBadRequest)
		return
	}
	if string(lookingForJSON) == "null" {
		lookingForJSON = []byte("[]")
	}

	profilePhotosJSON, err := json.Marshal(updated.ProfilePhotos)
	if err != nil {
		http.Error(w, "Failed to serialize profile_photos", http.StatusBadRequest)
		return
	}
	if string(profilePhotosJSON) == "null" {
		profilePhotosJSON = []byte("[]")
	}

	// Allow updating location when provided (WKT). If empty string, keep existing.
	locParam := interface{}(nil)
	if updated.Location != "" {
		locParam = updated.Location
	}

	query := `
        UPDATE profiles SET
            bio = COALESCE($1, bio),
            gender = COALESCE($2, gender),
            preferred_gender = COALESCE($3, preferred_gender),
            birth_date = COALESCE($4, birth_date),
            location = COALESCE(ST_GeogFromText($5), location),
            search_radius = COALESCE($6, search_radius),
            tags = COALESCE($7, tags),
            attributes = COALESCE($8::jsonb, attributes),
            looking_for = COALESCE($9::jsonb, looking_for),
            profile_photos = COALESCE($10::jsonb, profile_photos),
            updated_at = NOW()
        WHERE id = $11 AND user_id = $12
        RETURNING id
    `
	err = config.DB.QueryRow(
		query,
		updated.Bio,                       // $1
		updated.Gender,                    // $2
		pq.Array(updated.PreferredGender), // $3
		birthDate,                         // $4
		locParam,                          // $5
		updated.SearchRadius,              // $6
		pq.Array(updated.Tags),            // $7
		attributesJSON,                    // $8
		lookingForJSON,                    // $9
		profilePhotosJSON,                 // $10
		profileID,                         // $11
		userID,                            // $12
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
		http.Error(w, "Unauthorized5", http.StatusUnauthorized)
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

// GetMyProfile returns the profile for the authenticated user including basic user info.
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
	// location as WKT text
	query := `
		SELECT p.id, p.user_id, p.bio, p.gender, p.preferred_gender, p.birth_date,
			   p.search_radius, p.tags, p.attributes::text, p.looking_for::text,
			   p.profile_photos::text, ST_AsText(p.location), p.last_active, p.created_at, p.updated_at,
			   u.first_name, u.last_name
		FROM profiles p
		JOIN users u ON u.id = p.user_id
		WHERE p.user_id = $1
	`
	row := config.DB.QueryRow(query, userID)
	var locationText sqlNullString
	var birthDate sqlNullString
	err = row.Scan(&p.ID, &p.UserID, &p.Bio, &p.Gender, &preferredGender, &birthDate,
		&p.SearchRadius, &tags, &attributesBytes, &lookingForBytes, &profilePhotosBytes,
		&locationText, &p.LastActive, &p.CreatedAt, &p.UpdatedAt, &firstName, &lastName)
	if err != nil {
		http.Error(w, "Profile not found: "+err.Error(), http.StatusNotFound)
		return
	}

	// Map scanned values into model
	p.PreferredGender = preferredGender
	p.Tags = tags
	if locationText.Valid {
		p.Location = locationText.String
	}
	if birthDate.Valid {
		p.BirthDate = birthDate.String
	}

	// decode JSON text fields
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

	// Build response containing user name and profile
	resp := map[string]interface{}{
		"profile":    p,
		"first_name": firstName,
		"last_name":  lastName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// UploadProfilePhotos accepts multipart form images and appends their URLs to the user's profile_photos.
func UploadProfilePhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.GetUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse multipart form (limit to 20MB)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		http.Error(w, "No files provided", http.StatusBadRequest)
		return
	}

	uploadDir := "static/uploads"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		http.Error(w, "Failed to create upload dir: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var newUrls []string
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			continue
		}
		defer f.Close()

		ext := filepath.Ext(fh.Filename)
		name := uuid.New().String() + ext
		dstPath := filepath.Join(uploadDir, name)

		out, err := os.Create(dstPath)
		if err != nil {
			continue
		}
		if _, err := io.Copy(out, f); err != nil {
			out.Close()
			continue
		}
		out.Close()

		// Build relative URL for frontend
		urlPath := "/static/uploads/" + name
		newUrls = append(newUrls, urlPath)
	}

	if len(newUrls) == 0 {
		http.Error(w, "No files saved", http.StatusInternalServerError)
		return
	}

	// Fetch existing photos
	var existingBytes []byte
	err = config.DB.QueryRow("SELECT profile_photos::text FROM profiles WHERE user_id = $1", userID).Scan(&existingBytes)
	var existing []string
	if err == nil && len(existingBytes) > 0 {
		_ = json.Unmarshal(existingBytes, &existing)
	}

	merged := append(existing, newUrls...)
	mergedBytes, _ := json.Marshal(merged)

	// Update DB
	_, err = config.DB.Exec("UPDATE profiles SET profile_photos = $1::jsonb, updated_at = NOW() WHERE user_id = $2", mergedBytes, userID)
	if err != nil {
		http.Error(w, "Failed to update profile photos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"profile_photos": merged})
}

// sqlNullString is a tiny helper to scan nullable text from DB
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
