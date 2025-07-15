This project is a simple RESTful API built using Go, Chi, and PostgreSQL. It provides user authentication, email confirmation, and profile management. Users can register, confirm their email, log in, update their password, and log out.

---

## 🧰 Features

User Registration
Email Confirmation
JWT-based Login & Authentication
Password Updates
Logout
---

## 🏁 Getting Started

### Prerequisites

Docker
Docker Compose
Go 1.18+ (for manual dev/testing)
### Running the Project

Navigate to the project directory and start the backend with:

```bash
docker-compose up
🔐 API Flow with cURL
Here’s how to test the full authentication cycle manually.

1️⃣ Register
bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teste",
    "first_name": "teste",
    "last_name": "teste",
    "email": "testea@testel.com",
    "password": "teste1234",
    "validate_password": "teste1234"
  }'
Watch the logs for:

Send confirmation email to testea@testel.com with link:
http://localhost:8080/confirm?token=YOUR_TOKEN
2️⃣ Confirm Email
Replace YOUR_TOKEN with the value from the server output:

bash
curl -X GET "http://localhost:8080/confirm?token=YOUR_TOKEN"
3️⃣ Login
bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testea@testel.com",
    "password": "teste1234"
  }'
Response:

json
{
  "token": "YOUR_JWT_TOKEN"
}
4️⃣ Update Password
bash
curl -X PATCH http://localhost:8080/update_password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "old_password": "teste1234",
    "new_password": "teste4321"
  }'
5️⃣ Logout
bash
curl -X DELETE http://localhost:8080/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN""
