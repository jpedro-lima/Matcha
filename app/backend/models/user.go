package models

type User struct {
	ID                    int    `db:"id"`
	Username              string `json:"username" db:"username"`
	FirstName             string `json:"first_name" db:"first_name"`
	LastName              string `json:"last_name" db:"last_name"`
	Email                 string `json:"email" db:"email"`
	Password              string `json:"password" db:"password"`
	CreatedAt             string `json:"created_at" db:"created_at"`
	UpdatedAt             string `json:"updated_at" db:"updated_at"`
	Confirmed             bool   `json:"confirmed" db:"confirmed"`
	Banned                bool   `json:"banned" db:"banned"`
	ConfirmationToken     string `json:"confirmation_token" db:"confirmation_token"`
	ConfirmationExpiresAt string `json:"confirmation_expires_at" db:"confirmation_expires_at"`
}
