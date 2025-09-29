package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
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

	// Expect profile.Location as WKT like "POINT(lon lat)" (lon first). If empty, we will default to a fixed point (0 0) to avoid errors.
	if profile.Location == "" {
		profile.Location = "POINT(0 0)" // fallback to valid geography
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
