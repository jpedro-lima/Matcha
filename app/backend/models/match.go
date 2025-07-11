package models

type Match struct {
    ID             int    `db:"id" json:"id"`
    User1ID        int    `db:"user1_id" json:"user1_id"`
    User2ID        int    `db:"user2_id" json:"user2_id"`
    MatchedAt      string `db:"matched_at" json:"matched_at"`
    Status         string `db:"status" json:"status"`
    LastMessage    string `db:"last_message" json:"last_message"`
    LastMessageAt  string `db:"last_message_at" json:"last_message_at"`
}
