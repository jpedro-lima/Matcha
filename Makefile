# Start containers
up:
    docker-compose up -d --build

# Stop and remove containers, networks, volumes
down:
    docker-compose down
