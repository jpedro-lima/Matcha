package utils

import "github.com/jpedro-lima/Matcha/config"

// AdjustFame adds delta to a user's fame_rating, clamped between 0 and 100.
func AdjustFame(userID int, delta int) {
	config.DB.Exec(`
		UPDATE profiles
		SET fame_rating = GREATEST(0, LEAST(100, fame_rating + $1))
		WHERE user_id = $2
	`, delta, userID)
}
