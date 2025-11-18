#!/usr/bin/env bash
# Seed API via HTTP (curl + jq)
# Usage: ./seed_via_api.sh -n 30 -b http://localhost:8080

set -euo pipefail

COUNT=30
BASE_URL="http://localhost:8080"
SEED=$(date +%s)
FIRST=(Alice Bob Carol David Eva Frank Grace Hannah Ivan Julia Kevin Laura Mark Nina Oscar Paula Quinn Rita Sam Tina Uma Victor Wendy Xavier Yara Zack)
LAST=(Silva Santos Oliveira Souza Costa Almeida Ferreira Gomes Pereira Rodrigues Martins Barbosa Ribeiro Carvalho Moreira)
GENDERS=(male female)
TAGS=(music travel fitness gaming cooking movies photography art outdoors tech dancing reading yoga cycling running boardgames coffee wine coding sports)
OCCUPATIONS=("software developer" "graphic designer" "photographer" "teacher" "doctor" "nurse" "chef" "architect" "marketing specialist" "researcher" "urban farmer" "content writer" "yoga instructor" "event planner")
HOROSCOPES=(Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces)
CITIES=("São Paulo" "Rio de Janeiro" "Belo Horizonte" "Curitiba" "Porto Alegre" "Brasília" "Recife" "Fortaleza" "Lisbon" "Madrid" "Paris")
BIO_INTROS=("Curious mind" "Weekend explorer" "Coffee-powered dreamer" "Late-night thinker" "Avid storyteller" "Optimistic builder" "City wanderer" "Casual philosopher" "Friendly neighbor")
BIO_ACTIONS=("collects vinyl records" "shoots street photography" "experiments with new recipes" "codes side projects" "finds hidden cafes" "maps running trails" "plants balcony gardens" "designs tiny gadgets" "writes flash fiction" "hosts board game nights" "curates playlists")
BIO_ENDINGS=("always up for spontaneous road trips" "who laughs at their own jokes" "searching for a partner in trivia" "trying to master homemade pasta" "fond of rainy-day movies" "with a soft spot for rescue pets" "looking for good conversation" "that never says no to karaoke" "currently learning to salsa dance")

rand() { echo $(( (RANDOM<<15 | RANDOM) % $1 )); }
choose() { local arr=("${!1}"); echo "${arr[$(rand ${#arr[@]})]}"; }

inserted=0
skipped=0

for i in $(seq 1 $COUNT); do
  FIRSTNAME=${FIRST[$((RANDOM % ${#FIRST[@]}))]}
  LASTNAME=${LAST[$((RANDOM % ${#LAST[@]}))]}
  TIMESTAMP=$(date +%s%N)
  USER_INDEX=$(((i - 1) % 100 + 1))
  USERNAME="seed_${FIRSTNAME,,}_${USER_INDEX}_${TIMESTAMP}_${LASTNAME,,}"
  EMAIL="${FIRSTNAME,,}${USER_INDEX}@${FIRSTNAME,,}.com"
  PASSWORD="Password123!"

  echo "[$i/$COUNT] Registering ${EMAIL}"
  REGISTER_RESP=$(curl -sS -X POST "$BASE_URL/register" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USERNAME\",\"first_name\":\"$FIRSTNAME\",\"last_name\":\"$LASTNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"validate_password\":\"$PASSWORD\"}") || true

  # Check for success and extract confirmation link
  CONF_LINK=$(echo "$REGISTER_RESP" | jq -r '.confirmationLink // empty' || true)
  if [ -z "$CONF_LINK" ]; then
    echo "  register failed or no confirmation link returned: $REGISTER_RESP"
    skipped=$((skipped+1))
    continue
  fi

  echo "  Confirming email..."
  # Call the confirmation link (this will set confirmed=true)
  if ! curl -sS -X GET "$CONF_LINK" >/dev/null 2>&1; then
    echo "  confirmation failed";
    skipped=$((skipped+1));
    continue
  fi

  # Login to obtain JWT
  LOGIN_RESP=$(curl -sS -X POST "$BASE_URL/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}") || true
  TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // empty' || true)
  if [ -z "$TOKEN" ]; then
    echo "  login failed: $LOGIN_RESP"
    skipped=$((skipped+1))
    continue
  fi

  GENDER=${GENDERS[$((RANDOM % ${#GENDERS[@]}))]}
  if [ "$GENDER" = "male" ]; then
    PREFS='["female"]'
  elif [ "$GENDER" = "female" ]; then
    PREFS='["male"]'
  fi
  # unique tags
  TAG_COUNT=4
  SHUFFLED_TAGS=($(printf "%s\n" "${TAGS[@]}" | shuf | head -n $TAG_COUNT))

  BIO=$(printf "%s who %s and is %s." \
    "${BIO_INTROS[$((RANDOM % ${#BIO_INTROS[@]}))]}" \
    "${BIO_ACTIONS[$((RANDOM % ${#BIO_ACTIONS[@]}))]}" \
    "${BIO_ENDINGS[$((RANDOM % ${#BIO_ENDINGS[@]}))]}")

  BIRTH=$(date -d "$((1985 + RANDOM % 20))-01-01" +%Y-%m-%d 2>/dev/null || date -I -d "1970-01-01")
  SEARCH_RADIUS=$((20 + RANDOM % 80))
  # Set all users near São Paulo for matching
  BASE_LON="-46.6333"
  BASE_LAT="-23.5505"
  DELTA=0.01  # ~1km
  LON_OFFSET=$(echo "scale=4; ($RANDOM % 200 - 100) * $DELTA / 100" | bc 2>/dev/null || echo "0.0000")
  LAT_OFFSET=$(echo "scale=4; ($RANDOM % 200 - 100) * $DELTA / 100" | bc 2>/dev/null || echo "0.0000")
  LON=$(echo "scale=4; $BASE_LON + $LON_OFFSET" | bc 2>/dev/null || echo "$BASE_LON")
  LAT=$(echo "scale=4; $BASE_LAT + $LAT_OFFSET" | bc 2>/dev/null || echo "$BASE_LAT")
  LOCATION="POINT($LON $LAT)"

  HEIGHT=$((155 + RANDOM % 35))
  OCCUPATION=${OCCUPATIONS[$((RANDOM % ${#OCCUPATIONS[@]}))]}
  HOROSCOPE=${HOROSCOPES[$((RANDOM % ${#HOROSCOPES[@]}))]}
  HOME_CITY="São Paulo"
  ATTRS=$(jq -n --argjson height "$HEIGHT" --arg occ "$OCCUPATION" --arg hor "$HOROSCOPE" --arg city "$HOME_CITY" '{height_cm:$height, occupation:$occ, horoscope:$hor, city:$city}')

  RELATION_GOALS=(long_term short_term friendship)
  RELATION=${RELATION_GOALS[$((RANDOM % ${#RELATION_GOALS[@]}))]}
  LOOKING_INTERESTS=($(printf "%s\n" "${TAGS[@]}" | shuf | head -n 2))
  LOOKING_INTERESTS_JSON=$(printf '%s\n' "${LOOKING_INTERESTS[@]}" | jq -R . | jq -s .)
  LOOKING=$(jq -n --arg rt "$RELATION" --argjson interests "$LOOKING_INTERESTS_JSON" '{relationship_type:$rt, interests:$interests}')

  PROFILE_JSON=$(jq -n --arg bio "$BIO" --arg gender "$GENDER" --argjson prefs "$PREFS" \
    --arg birth "$BIRTH" --arg loc "$LOCATION" --argjson tags "$(printf '%s
' "${SHUFFLED_TAGS[@]}" | jq -R . | jq -s .)" \
    --argjson attrs "$ATTRS" --argjson look "$LOOKING" --argjson photos "[\"https://picsum.photos/seed/$USERNAME/400/600\", \"https://picsum.photos/seed/$USERNAME/400/601\"]" \
    '{bio:$bio, gender:$gender, preferred_gender:$prefs, birth_date:$birth, location:$loc, search_radius: 50, tags:$tags, attributes:$attrs, looking_for:$look, profile_photos:$photos}')

  echo "  Creating profile..."
  CREATE_RESP=$(curl -sS -X POST "$BASE_URL/profiles" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PROFILE_JSON") || true

  if echo "$CREATE_RESP" | jq -e '.id' >/dev/null 2>&1; then
    echo "  profile created"
    inserted=$((inserted+1))
  else
    echo "  create profile failed: $CREATE_RESP"
    skipped=$((skipped+1))
  fi

  # small pause
  sleep 0.1

done

cat <<EOF
Done. inserted=$inserted skipped=$skipped
EOF
