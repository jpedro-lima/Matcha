package main

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var genders = []string{"male", "female", "non-binary"}

var tagPool = []string{
	"rock", "music", "sertanejo", "games", "programação", "cinema", "tecnologia",
	"fotografia", "viagens", "culinária", "esportes", "futebol", "basquete",
	"natação", "yoga", "livros", "escrita", "arte", "pintura", "desenho",
	"dança", "teatro", "moda", "design", "arquitetura", "história", "ciência",
	"astronomia", "filosofia", "psicologia", "negócios", "empreendedorismo",
	"finanças", "política", "jardinagem", "animais", "cães", "gatos", "natureza",
	"camping", "aventura", "carros", "motos", "bicicletas", "animes", "mangás",
	"meditação", "café", "vinhos", "cervejas", "festivais",
}

// Cities as [longitude, latitude] — WKT is POINT(lon lat)
var cities = [][2]float64{
	{-43.1729, -22.9068}, // Rio de Janeiro
	{-46.6333, -23.5505}, // São Paulo
	{-38.5108, -3.7172},  // Fortaleza
	{-34.8807, -8.0539},  // Recife
	{-44.3028, -2.5307},  // São Luís
	{2.3522, 48.8566},    // Paris
	{-0.1276, 51.5074},   // London
	{13.4050, 52.5200},   // Berlin
	{-73.9857, 40.7484},  // New York
	{-118.2437, 34.0522}, // Los Angeles
}

var firstNames = []string{
	"Alice", "Bruno", "Carlos", "Diana", "Eduardo", "Fernanda", "Gabriel",
	"Helena", "Igor", "Julia", "Kevin", "Larissa", "Marcos", "Natália",
	"Otávio", "Patrícia", "Rafael", "Sabrina", "Thiago", "Valentina",
	"William", "Yasmin", "Zé", "Ana", "Beatriz", "Cláudio", "Débora",
}

var lastNames = []string{
	"Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa",
	"Ferreira", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Ribeiro",
	"Martins", "Araújo", "Melo", "Barbosa", "Cardoso", "Moreira", "Nunes",
}

func main() {
	dbUser := getEnv("DB_USER", "postgres")
	dbPass := getEnv("DB_PASSWORD", "mysecretpassword")
	dbName := getEnv("DB_NAME", "postgres")
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")

	dsn := fmt.Sprintf("user=%s password=%s dbname=%s host=%s port=%s sslmode=disable",
		dbUser, dbPass, dbName, dbHost, dbPort)

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		fmt.Printf("DB connection failed: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Password for all seeded users. Can be overridden with SEED_PASSWORD env var.
	seedPass := getEnv("SEED_PASSWORD", "Password123!")
	hashed, _ := bcrypt.GenerateFromPassword([]byte(seedPass), bcrypt.DefaultCost)
	hashedStr := string(hashed)

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	created := 0
	targetProfiles := getEnvInt("SEED_PROFILE_COUNT", 30)

	for i := 1; created < targetProfiles; i++ {
		gender := genders[rng.Intn(len(genders))]
		prefIdx := rng.Intn(len(genders))
		prefGender := fmt.Sprintf(`{"%s"}`, genders[prefIdx])
		city := cities[rng.Intn(len(cities))]
		lonJitter := (rng.Float64() - 0.5) * 1.0
		latJitter := (rng.Float64() - 0.5) * 1.0
		age := 18 + rng.Intn(42)
		birthYear := time.Now().Year() - age
		birthDate := fmt.Sprintf("%d-%02d-%02d", birthYear, 1+rng.Intn(12), 1+rng.Intn(28))

		// Pick 3-5 random tags
		numTags := 3 + rng.Intn(3)
		chosen := rng.Perm(len(tagPool))[:numTags]
		tagStr := "{"
		for j, idx := range chosen {
			if j > 0 {
				tagStr += ","
			}
			tagStr += `"` + tagPool[idx] + `"`
		}
		tagStr += "}"

		fame := rng.Intn(100)
		firstName := firstNames[rng.Intn(len(firstNames))]
		lastName := lastNames[rng.Intn(len(lastNames))]
		username := fmt.Sprintf("user_%d_%d", i, rng.Intn(9999))
		email := fmt.Sprintf("seed_%d_%d@matcha.local", i, rng.Intn(99999))

		var userID int
		err := db.QueryRow(`
			INSERT INTO users (username, first_name, last_name, email, password, confirmed)
			VALUES ($1,$2,$3,$4,$5,true) RETURNING id
		`, username, firstName, lastName, email, hashedStr).Scan(&userID)
		if err != nil {
			// Username/email collision — skip
			continue
		}

		_, err = db.Exec(`
			INSERT INTO profiles (user_id, bio, gender, preferred_gender, birth_date,
				location, search_radius, tags, fame_rating)
			VALUES ($1,$2,$3,$4::varchar[],$5,
				ST_GeogFromText($6),$7,$8::varchar[],$9)
		`,
			userID,
			fmt.Sprintf("Hi, I'm %s! Seed profile #%d.", firstName, created+1),
			gender,
			prefGender,
			birthDate,
			fmt.Sprintf("POINT(%f %f)", city[0]+lonJitter, city[1]+latJitter),
			100,
			tagStr,
			fame,
		)
		if err != nil {
			fmt.Printf("Profile insert failed for user %d: %v\n", userID, err)
			continue
		}

		created++
		if created%10 == 0 || created == targetProfiles {
			fmt.Printf("  %d/%d profiles created...\n", created, targetProfiles)
		}
	}

	fmt.Printf("Seed complete: %d profiles created.\n", created)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		parsed, err := strconv.Atoi(v)
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}
