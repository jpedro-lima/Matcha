package utils

import "strings"

var weakPasswords = map[string]bool{
	"password": true, "password1": true, "password123": true,
	"123456": true, "1234567": true, "12345678": true, "123456789": true,
	"qwerty": true, "qwerty123": true, "qwertyuiop": true,
	"abc123": true, "letmein": true, "monkey": true, "master": true,
	"dragon": true, "111111": true, "baseball": true, "iloveyou": true,
	"sunshine": true, "princess": true, "welcome": true, "shadow": true,
	"superman": true, "michael": true, "football": true, "charlie": true,
	"aa123456": true, "donald": true, "batman": true, "starwars": true,
	"hello": true, "hello123": true, "passw0rd": true, "trustno1": true,
	"ranger": true, "solo": true, "access": true, "flower": true,
	"696969": true, "hottie": true, "loveme": true, "zaq1zaq1": true,
	"qazwsx": true, "senha": true, "senha123": true, "matcha": true,
	"matcha123": true, "admin": true, "admin123": true, "root": true,
	"test": true, "test123": true, "user": true, "user123": true,
}

func IsWeakPassword(password string) bool {
	return weakPasswords[strings.ToLower(password)]
}
