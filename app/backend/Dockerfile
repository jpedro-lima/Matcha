# Use the official Go image as the base
FROM golang:alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Use a smaller final image
FROM alpine:latest

WORKDIR /root/

# Install migrate CLI
RUN apk add --no-cache curl tar
RUN curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz -o migrate.tar.gz \
  && tar -xzvf migrate.tar.gz \
  && mv migrate /usr/bin/migrate \
  && rm migrate.tar.gz

COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/chat.html chat.html
# Expose app port
EXPOSE 8080

# Entry point: run migration, then app
CMD migrate -path ./migrations -database "postgres://postgres:mysecretpassword@db:5432/postgres?sslmode=disable" up && ./main

