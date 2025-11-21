package models

import (
	"time"
)

type Notification struct {
	ID         int       `db:"id" json:"id"`
	UserID     int       `db:"user_id" json:"user_id"`
	SenderID   *int      `db:"sender_id" json:"sender_id"`
	Type       string    `db:"type" json:"type"`
	Content    string    `db:"content" json:"content"`
	Read       bool      `db:"read" json:"read"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	SenderName *string   `db:"sender_name" json:"sender_name"`
}
