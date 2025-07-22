package handlers

import (
    "encoding/json"
    "log"
    "net/http"
    "strconv"
    "time"

    "github.com/gorilla/websocket"
    "github.com/jpedro-lima/Matcha/config"
    "github.com/jpedro-lima/Matcha/models"
)

type MessageRequest struct {
    MatchID  int    `json:"match_id"`
    SenderID int    `json:"sender_id"`
    Content  string `json:"content"`
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // Adjust origin validation as needed
    },
}

var matchConnections = make(map[int][]*websocket.Conn)

func ChatHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
        return
    }
    defer conn.Close()

    matchIDStr := r.URL.Query().Get("match_id")
    matchID, _ := strconv.Atoi(matchIDStr)
    matchConnections[matchID] = append(matchConnections[matchID], conn)

    defer func() {
        conns := matchConnections[matchID]
        updated := []*websocket.Conn{}
        for _, c := range conns {
            if c != conn {
                updated = append(updated, c)
            }
        }
        matchConnections[matchID] = updated
    }()

    for {
        _, msgData, err := conn.ReadMessage()
        if err != nil {
            log.Println("WebSocket read error:", err)
            break
        }

        var msg MessageRequest
        if err := json.Unmarshal(msgData, &msg); err != nil {
            log.Println("Invalid message payload:", err)
            continue
        }

        // Validate sender access to match
        var exists bool
        err = config.DB.Get(&exists, `
            SELECT EXISTS (
                SELECT 1 FROM matches
                WHERE id = $1
                AND (user1_id = $2 OR user2_id = $2)
                AND status = 'accepted'
            )
        `, msg.MatchID, msg.SenderID)

        if err != nil || !exists {
            log.Println("Unauthorized sender or invalid match")
            continue
        }

        saved := models.Message{
            MatchID:   msg.MatchID,
            SenderID:  msg.SenderID,
            Content:   msg.Content,
            SentAt:    time.Now().Format(time.RFC3339),
            Read:      false,
        }

        _, err = config.DB.Exec(`
            INSERT INTO messages (match_id, sender_id, content, sent_at, read)
            VALUES ($1, $2, $3, $4, $5)
        `, saved.MatchID, saved.SenderID, saved.Content, saved.SentAt, saved.Read)

        if err != nil {
            log.Println("Failed to store message:", err)
            continue
        }

        payload, _ := json.Marshal(saved)
        broadcastToMatch(saved.MatchID, payload)
    }
}

func broadcastToMatch(matchID int, data []byte) {
    conns := matchConnections[matchID]
    for _, c := range conns {
        err := c.WriteMessage(websocket.TextMessage, data)
        if err != nil {
            log.Println("Broadcast error:", err)
        }
    }
}
