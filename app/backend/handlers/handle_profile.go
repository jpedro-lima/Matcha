package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"
    "github.com/jpedro-lima/Matcha/models"
	"github.com/jpedro-lima/Matcha/utils"
	"github.com/jpedro-lima/Matcha/config"

	"github.com/lib/pq"
)

func CreateProfile(w http.ResponseWriter, r *http.Request) {
    userID, err := utils.GetUserIDFromRequest(r)
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
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

    query := `
        INSERT INTO profiles (
            user_id, bio, gender, preferred_gender, birth_date,
            search_radius, tags, attributes, looking_for, profile_photos
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
        RETURNING id
    `
    err = config.DB.QueryRow(
        query,
        profile.UserID,
        profile.Bio,
        profile.Gender,
        pq.Array(profile.PreferredGender),
        profile.BirthDate,
        profile.SearchRadius,
        pq.Array(profile.Tags),
        attributesJSON,
        lookingForJSON,
        profilePhotosJSON,
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

    query := `
        UPDATE profiles SET
            bio = COALESCE($1, bio),
            gender = COALESCE($2, gender),
            preferred_gender = COALESCE($3, preferred_gender),
            birth_date = COALESCE($4, birth_date),
            search_radius = COALESCE($5, search_radius),
            tags = COALESCE($6, tags),
            attributes = COALESCE($7::jsonb, attributes),
            looking_for = COALESCE($8::jsonb, looking_for),
            profile_photos = COALESCE($9::jsonb, profile_photos),
            updated_at = NOW()
        WHERE id = $10 AND user_id = $11
        RETURNING id
    `
    err = config.DB.QueryRow(
        query,
        updated.Bio,
        updated.Gender,
        pq.Array(updated.PreferredGender),
        birthDate,
        updated.SearchRadius,
        pq.Array(updated.Tags),
        attributesJSON,
        lookingForJSON,
        profilePhotosJSON,
        profileID,
        userID,
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
