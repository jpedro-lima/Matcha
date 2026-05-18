package utils

import (
	"fmt"
	"net/smtp"
	"os"
)

func SendEmail(to, subject, body string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")

	if host == "" {
		host = "mailpit"
	}
	if port == "" {
		port = "1025"
	}
	if user == "" {
		user = "matcha@matcha.local"
	}

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n%s",
		user, to, subject, body,
	)

	var auth smtp.Auth
	if pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}

	return smtp.SendMail(host+":"+port, auth, user, []string{to}, []byte(msg))
}
