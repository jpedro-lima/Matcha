package models

type Profile struct {
    ID              int      `db:"id" json:"id"`
    UserID          int      `db:"user_id" json:"user_id"`
    Bio             string   `db:"bio" json:"bio"`
    Gender          string   `db:"gender" json:"gender"`
    PreferredGender []string `db:"preferred_gender" json:"preferred_gender"`
    BirthDate       string   `db:"birth_date" json:"birth_date"`
    SearchRadius    int      `db:"search_radius" json:"search_radius"`
    Tags            []string `db:"tags" json:"tags"`
    Location        string                 `db:"location" json:"location"` // optional: use geo type
    Attributes      map[string]interface{} `db:"attributes" json:"attributes"`
    LookingFor      map[string]interface{} `db:"looking_for" json:"looking_for"`
    ProfilePhotos   []string               `db:"profile_photos" json:"profile_photos"`
    LastActive      string                 `db:"last_active" json:"last_active"`
    CreatedAt       string                 `db:"created_at" json:"created_at"`
    UpdatedAt       string                 `db:"updated_at" json:"updated_at"`
}
