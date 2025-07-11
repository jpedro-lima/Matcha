package models

type User struct {
    ID        int    `db:"id"`
    Username  string `json:"username" db:"username"`
    FirstName string `json:"first_name" db:"first_name"`
    LastName  string `json:"last_name" db:"last_name"`
    Email     string `json:"email" db:"email"`
    Password  string `json:"password" db:"password"`
}
