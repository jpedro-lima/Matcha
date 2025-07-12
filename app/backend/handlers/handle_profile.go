package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"
    "github.com/jpedro-lima/Matcha/models"

)

// Dummy in-memory store for demonstration
var profiles = make(map[int]*models.Profile)
var nextProfileID = 1

// CreateProfile handles POST /profiles
func CreateProfile(w http.ResponseWriter, r *http.Request) {
    var profile models.Profile
    if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }
    profile.ID = nextProfileID
    nextProfileID++
    profiles[profile.ID] = &profile

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(profile)
}

// UpdateProfile handles PUT /profiles/{id}
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid profile ID", http.StatusBadRequest)
        return
    }

    existing, ok := profiles[id]
    if !ok {
        http.Error(w, "Profile not found", http.StatusNotFound)
        return
    }

    var updated models.Profile
    if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    updated.ID = existing.ID
    profiles[id] = &updated

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(updated)
}

// DeleteProfile handles DELETE /profiles/{id}
func DeleteProfile(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid profile ID", http.StatusBadRequest)
        return
    }

    if _, ok := profiles[id]; !ok {
        http.Error(w, "Profile not found", http.StatusNotFound)
        return
    }

    delete(profiles, id)
    w.WriteHeader(http.StatusNoContent)
}
