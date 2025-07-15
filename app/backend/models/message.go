package models

type Message struct {
    ID             int    `db:"id" json:"id"`
    MatchID        int    `db:"match_id" json:"match_id"`
    SenderID       int    `db:"sender_id" json:"sender_id"`
    Content        string `db:"content" json:"content"`
    SentAt         string `db:"sent_at" json:"sent_at"`
    Read           bool   `db:"read" json:"read"`
    AttachmentURL  string `db:"attachment_url,omitempty" json:"attachment_url,omitempty"`
    AttachmentType string `db:"attachment_type,omitempty" json:"attachment_type,omitempty"`
}
