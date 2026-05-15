# 📘 API Documentation — Matcha-like Dating App

> Documentação técnica da API REST + WebSocket para o aplicativo de relacionamento.

---

## 📑 Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Variáveis de Ambiente](#4-variáveis-de-ambiente)
5. [Docker & Docker Compose](#5-docker--docker-compose)
6. [Nginx & SSL Local](#6-nginx--ssl-local)
7. [Schema do Banco de Dados](#7-schema-do-banco-de-dados)
8. [Autenticação (JWT)](#8-autenticação-jwt)
9. [Convenções da API](#9-convenções-da-api)
10. [Endpoints REST](#10-endpoints-rest)
11. [Eventos WebSocket](#11-eventos-websocket)
12. [Segurança](#12-segurança)
13. [Setup e Execução](#13-setup-e-execução)

---

## 1. Visão Geral

API REST + WebSocket para um app de relacionamento. Suporta cadastro com verificação por e-mail, perfis com geolocalização, sistema de matching, chat em tempo real e notificações em tempo real.

**Base URL (dev):** `https://localhost/api`
**WebSocket URL (dev):** `wss://localhost/ws`

---

## 2. Stack Tecnológica

| Camada           | Tecnologia                  |
| ---------------- | --------------------------- |
| Runtime          | Node.js (LTS)               |
| Framework HTTP   | Express                     |
| Banco de Dados   | PostgreSQL 16               |
| Query Builder    | Knex.js                     |
| Autenticação     | JWT (access + refresh)      |
| Hash de Senha    | bcrypt (≥ 12 rounds)        |
| Real-time        | Socket.IO (ou ws)           |
| Validação        | Zod                         |
| E-mail           | Nodemailer                  |
| Upload de Imagem | Multer + sharp              |
| Reverse Proxy    | Nginx                       |
| TLS              | OpenSSL (self-signed local) |
| Containerização  | Docker + Docker Compose     |

---

## 3. Estrutura do Projeto

```
matcha/
├── docker-compose.yml
├── .env
├── nginx/
│   ├── nginx.conf
│   └── certs/
│       ├── server.crt
│       └── server.key
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   ├── knexfile.ts
│   │   ├── migrations/
│   │   └── seeds/
│   └── src/
│       ├── server.ts
│       ├── app.ts
│       ├── config/
│       ├── middlewares/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── models/
│       ├── sockets/
│       ├── utils/
│       └── validators/
└── frontend-web/
    └── (já existente)
```

---

## 4. Variáveis de Ambiente

Arquivo `.env` na raiz:

```env
# ── Postgres ─────────────────────────
POSTGRES_USER=matcha
POSTGRES_PASSWORD=changeme
POSTGRES_DB=matcha_db
POSTGRES_HOST=db
POSTGRES_PORT=5432

# ── API ──────────────────────────────
NODE_ENV=development
API_PORT=3000
APP_URL=https://localhost

# ── JWT ──────────────────────────────
JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_REFRESH_SECRET=replace-with-another-strong-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── SMTP ─────────────────────────────
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=no-reply@matcha.local

# ── Uploads ──────────────────────────
UPLOAD_DIR=/usr/src/app/uploads
MAX_PHOTO_SIZE_MB=5
```

---

## 5. Docker & Docker Compose

Exemplo de `docker-compose.yml`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks: [matcha_net]

  api:
    build: ./api
    restart: unless-stopped
    depends_on: [db]
    environment:
      NODE_ENV: ${NODE_ENV}
    env_file: .env
    volumes:
      - ./api:/usr/src/app
      - uploads:/usr/src/app/uploads
      - /usr/src/app/node_modules
    networks: [matcha_net]

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on: [api]
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - uploads:/usr/share/nginx/uploads:ro
    networks: [matcha_net]

volumes:
  db_data:
  uploads:

networks:
  matcha_net:
```

---

## 6. Nginx & SSL Local

### Gerar certificado self-signed com OpenSSL

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/C=BR/ST=SP/L=SP/O=Matcha/CN=localhost"
```

### `nginx/nginx.conf` (resumo)

```nginx
events {}
http {
  upstream api { server api:3000; }

  server {
    listen 80;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    # Frontend (SPA)
    root /usr/share/nginx/html;
    index index.html;

    location / { try_files $uri /index.html; }

    # API
    location /api/ {
      proxy_pass http://api/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws/ {
      proxy_pass http://api/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
    }

    # Uploads (servidos pelo Nginx)
    location /uploads/ {
      alias /usr/share/nginx/uploads/;
    }
  }
}
```

---

## 7. Schema do Banco de Dados

### Tabelas principais

### `users` — identidade & autenticação

| Coluna           | Tipo                               | Notas                                     |
| ---------------- | ---------------------------------- | ----------------------------------------- |
| `id`             | uuid PK                            | `gen_random_uuid()`                       |
| `email`          | varchar(255) UNIQUE NOT NULL       | considerar `citext` para case-insensitive |
| `username`       | varchar(50) UNIQUE NOT NULL        |                                           |
| `first_name`     | varchar(100) NOT NULL              |                                           |
| `last_name`      | varchar(100) NOT NULL              |                                           |
| `password_hash`  | varchar(255) NOT NULL              | bcrypt                                    |
| `email_verified` | boolean NOT NULL DEFAULT false     |                                           |
| `created_at`     | timestamptz NOT NULL DEFAULT now() |                                           |
| `updated_at`     | timestamptz NOT NULL DEFAULT now() |                                           |

**Índices:** `email` (unique), `username` (unique).

---

### `profiles` — dados de perfil & estado

Relação 1:1 com `users`. Linha criada na mesma transação do registro, com campos opcionais em `NULL` até o usuário completar o perfil.

| Coluna                 | Tipo                                      | Notas                                                               |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `user_id`              | uuid PK / FK → users.id ON DELETE CASCADE | 1:1 com users                                                       |
| `gender`               | varchar(20) NULL                          | `male` / `female` / `other`                                         |
| `sexual_orientation`   | varchar(20) NULL                          | `hetero` / `homo` / `bi` — default aplicado na query, não na coluna |
| `biography`            | text NULL                                 |                                                                     |
| `birth_date`           | date NULL                                 | CHECK 18+                                                           |
| `latitude`             | numeric(9,6) NULL                         |                                                                     |
| `longitude`            | numeric(9,6) NULL                         |                                                                     |
| `city`                 | varchar(120) NULL                         |                                                                     |
| `neighborhood`         | varchar(120) NULL                         |                                                                     |
| `location_consent`     | boolean NOT NULL DEFAULT false            | GPS explícito                                                       |
| `profile_photo_url`    | varchar(500) NULL                         | preenchido na Fase 2 (MinIO)                                        |
| `fame_rating`          | numeric(6,2) NOT NULL DEFAULT 0           | derivado                                                            |
| `last_seen_at`         | timestamptz NULL                          | presença                                                            |
| `is_online`            | boolean NOT NULL DEFAULT false            | presença                                                            |
| `profile_completed_at` | timestamptz NULL                          | marcado quando todos os campos obrigatórios estão preenchidos       |
| `created_at`           | timestamptz NOT NULL DEFAULT now()        |                                                                     |
| `updated_at`           | timestamptz NOT NULL DEFAULT now()        |                                                                     |

**Índices:**

- `user_id` (PK)
- `(gender, sexual_orientation)` — filtro de browsing
- `(latitude, longitude)` — bounding box geográfico
- `fame_rating DESC` — ordenação por reputação

**CHECKs sugeridos:**

- `gender IN ('male','female','other')`
- `sexual_orientation IN ('hetero','homo','bi')`
- `birth_date <= CURRENT_DATE - INTERVAL '18 years'`

> 💡 **Por que `sexual_orientation` é `NULL` em vez de `DEFAULT 'bi'`?**
> O requisito IV.3 diz "se não especificada, considerar bissexual por padrão". Isso é regra de matching, não regra de schema. Aplicar o default no SQL impede distinguir "não informou" de "informou bi". Mantenha `NULL` no banco e use `COALESCE(sexual_orientation, 'bi')` na query de browsing — você preserva a regra e ganha telemetria de quem completou de fato.

> 🔗 **FKs de outras tabelas** (`likes`, `visits`, `blocks`, `reports`, `messages`, `notifications`) apontam para `users.id`, não para `profiles.user_id`. A identidade é o âncora; o perfil é estado anexo.

#### `photos`

| Coluna       | Tipo                                 | Notas |
| ------------ | ------------------------------------ | ----- |
| `id`         | uuid PK                              |       |
| `user_id`    | uuid FK → users.id ON DELETE CASCADE |       |
| `url`        | varchar(500)                         |       |
| `is_profile` | boolean DEFAULT false                |       |
| `position`   | smallint                             | 1-5   |
| `created_at` | timestamptz                          |       |

> Constraint: máximo 5 fotos por usuário; apenas uma com `is_profile=true`.

#### `tags`

| Coluna | Tipo                        | Notas              |
| ------ | --------------------------- | ------------------ |
| `id`   | serial PK                   |                    |
| `name` | varchar(40) UNIQUE NOT NULL | sem `#`, minúsculo |

#### `user_tags`

| Coluna    | Tipo    |
| --------- | ------- |
| `user_id` | uuid FK |
| `tag_id`  | int FK  |

PK composta `(user_id, tag_id)`.

#### `likes`

| Coluna       | Tipo               | Notas |
| ------------ | ------------------ | ----- |
| `id`         | uuid PK            |       |
| `liker_id`   | uuid FK → users.id |       |
| `liked_id`   | uuid FK → users.id |       |
| `created_at` | timestamptz        |       |

UNIQUE `(liker_id, liked_id)`.

#### `visits`

| Coluna       | Tipo        |
| ------------ | ----------- |
| `id`         | uuid PK     |
| `visitor_id` | uuid FK     |
| `visited_id` | uuid FK     |
| `created_at` | timestamptz |

#### `blocks`

| `blocker_id` | uuid FK |
| `blocked_id` | uuid FK |
| `created_at` | timestamptz |

PK composta.

#### `reports`

| Coluna        | Tipo        |
| ------------- | ----------- |
| `id`          | uuid PK     |
| `reporter_id` | uuid FK     |
| `reported_id` | uuid FK     |
| `reason`      | varchar(50) |
| `created_at`  | timestamptz |

#### `matches` (view ou tabela materializada)

Pares onde existe like mútuo. Pode ser uma VIEW:

```sql
CREATE VIEW matches AS
SELECT LEAST(l1.liker_id, l1.liked_id) AS user_a,
       GREATEST(l1.liker_id, l1.liked_id) AS user_b,
       GREATEST(l1.created_at, l2.created_at) AS matched_at
FROM likes l1
JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
WHERE l1.liker_id < l1.liked_id;
```

#### `messages`

| Coluna         | Tipo             |
| -------------- | ---------------- |
| `id`           | uuid PK          |
| `sender_id`    | uuid FK          |
| `recipient_id` | uuid FK          |
| `content`      | text             |
| `read_at`      | timestamptz NULL |
| `created_at`   | timestamptz      |

#### `notifications`

| Coluna       | Tipo             | Notas                                             |
| ------------ | ---------------- | ------------------------------------------------- |
| `id`         | uuid PK          |                                                   |
| `user_id`    | uuid FK          | destinatário                                      |
| `actor_id`   | uuid FK NULL     | quem causou                                       |
| `type`       | varchar(20)      | `like` / `visit` / `message` / `match` / `unlike` |
| `payload`    | jsonb            | dados extras                                      |
| `read_at`    | timestamptz NULL |                                                   |
| `created_at` | timestamptz      |                                                   |

#### `email_tokens` / `password_reset_tokens`

| Coluna       | Tipo            |
| ------------ | --------------- |
| `token`      | varchar(255) PK |
| `user_id`    | uuid FK         |
| `expires_at` | timestamptz     |

---

## 8. Autenticação (JWT)

Estratégia **dual token**:

- **Access token** — JWT curto (15 min), enviado em `Authorization: Bearer <token>`.
- **Refresh token** — JWT longo (7 dias), enviado via **httpOnly cookie** `Secure` + `SameSite=Strict`.

### Fluxo

1. `POST /auth/login` → retorna access token no body + refresh token no cookie.
2. Em cada request protegido, frontend envia `Authorization: Bearer <access>`.
3. Quando o access expira (401), frontend chama `POST /auth/refresh` → novo access token.
4. `POST /auth/logout` → invalida o refresh token (lista de revogação).

### Payload do access token

```json
{
	"sub": "uuid-do-usuario",
	"username": "joao123",
	"iat": 1715800000,
	"exp": 1715800900
}
```

---

## 9. Convenções da API

### Códigos de status

| Código | Uso                             |
| ------ | ------------------------------- |
| 200    | OK                              |
| 201    | Criado                          |
| 204    | Sem conteúdo                    |
| 400    | Validação                       |
| 401    | Não autenticado                 |
| 403    | Sem permissão                   |
| 404    | Não encontrado                  |
| 409    | Conflito (ex: e-mail já existe) |
| 422    | Senha fraca, etc.               |
| 429    | Rate limit                      |
| 500    | Erro interno                    |

### Formato de erro

```json
{
	"error": {
		"code": "WEAK_PASSWORD",
		"message": "A senha não atende aos requisitos de segurança.",
		"details": ["min 8 chars", "não pode ser comum"]
	}
}
```

### Paginação

Query params: `?page=1&limit=20`
Resposta:

```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
}
```

---

## 10. Endpoints REST

### 🔐 10.1 Autenticação — `/auth`

#### `POST /auth/register`

Cria conta e envia e-mail de verificação.

**Body**

```json
{
	"email": "joao@example.com",
	"username": "joao123",
	"firstName": "João",
	"lastName": "Silva",
	"password": "S3nh@F0rt3!2026"
}
```

**Validações**

- E-mail válido e único.
- Username único, 3–50 chars, alfanumérico + `_`.
- Senha **não pode ser palavra de dicionário** (qualquer idioma) — usar lib como `zxcvbn`, score ≥ 3.
- Mínimo 8 chars, com maiúscula, minúscula, número e símbolo.

**Respostas**

- `201` `{ "message": "Conta criada. Verifique seu e-mail." }`
- `409 EMAIL_EXISTS` / `USERNAME_EXISTS`
- `422 WEAK_PASSWORD`

---

#### `GET /auth/verify-email/:token`

Confirma e-mail. Marca `email_verified=true` e consome o token.

**Respostas**

- `200` `{ "message": "E-mail verificado." }`
- `400 INVALID_TOKEN` / `EXPIRED_TOKEN`

---

#### `POST /auth/login`

**Body**

```json
{ "username": "joao123", "password": "..." }
```

**Resposta `200`**

```json
{
	"accessToken": "...",
	"user": { "id": "...", "username": "joao123", "profileCompleted": false }
}
```

> O `refreshToken` é setado como cookie httpOnly.

- `401 INVALID_CREDENTIALS`
- `403 EMAIL_NOT_VERIFIED`

---

#### `POST /auth/refresh`

Lê refresh token do cookie → emite novo access.

- `200` `{ "accessToken": "..." }`
- `401 REFRESH_INVALID`

---

#### `POST /auth/logout`

Revoga refresh token + limpa cookie. Disponível **de qualquer página** (frontend chama no clique).

- `204`

---

#### `POST /auth/forgot-password`

**Body** `{ "email": "..." }`

Sempre retorna `200` (mesmo se o e-mail não existir, por segurança).

---

#### `POST /auth/reset-password`

**Body**

```json
{ "token": "...", "newPassword": "..." }
```

- `200` / `400 INVALID_TOKEN` / `422 WEAK_PASSWORD`

---

### 👤 10.2 Perfil — `/users`

> Todos os endpoints abaixo exigem JWT. `me` é atalho para o usuário autenticado.

#### `GET /users/me`

Retorna perfil completo do usuário autenticado (inclui e-mail).

---

#### `PATCH /users/me`

Atualiza qualquer campo de perfil (nome, sobrenome, e-mail, gênero, orientação, bio, etc.).

**Body** (todos opcionais)

```json
{
	"firstName": "João",
	"lastName": "Silva",
	"email": "novo@email.com",
	"gender": "male",
	"sexualOrientation": "bi",
	"biography": "Texto...",
	"birthDate": "1995-06-12"
}
```

> Se `email` mudar → novo fluxo de verificação dispara.

---

#### `PATCH /users/me/location`

**Body**

```json
{
	"latitude": -23.55,
	"longitude": -46.63,
	"city": "São Paulo",
	"neighborhood": "Pinheiros",
	"consent": true
}
```

Se `consent=false`, `city`/`neighborhood` são **obrigatórios** (manual).

---

#### `POST /users/me/photos`

Upload de imagem (multipart/form-data, campo `file`).

- `201` `{ "id": "...", "url": "/uploads/...", "isProfile": false }`
- `400 MAX_PHOTOS_REACHED` (já tem 5)
- `400 INVALID_IMAGE`

---

#### `DELETE /users/me/photos/:photoId`

`204` ou `404`.

---

#### `PATCH /users/me/photos/:photoId/profile`

Define como foto de perfil (desmarca as outras).

`200` `{ "id": "...", "isProfile": true }`

---

#### `GET /users/me/tags`

Lista as tags do usuário.

---

#### `PUT /users/me/tags`

Substitui todas as tags do usuário.

**Body**

```json
{ "tags": ["vegan", "geek", "piercing"] }
```

Tags inexistentes são criadas automaticamente.

---

#### `GET /users/me/visitors`

Histórico de quem visualizou meu perfil (paginado, ordem desc).

```json
{
  "data": [
    { "user": { "id":"...", "username":"ana", "profilePhoto":"..." }, "visitedAt": "..." }
  ],
  "pagination": { ... }
}
```

---

#### `GET /users/me/likes`

Quem deu like no meu perfil.

---

#### `GET /tags?query=ve`

Autocomplete de tags reutilizáveis.

`[ { "id": 12, "name": "vegan" }, ... ]`

---

### 🔍 10.3 Browsing — `/browse`

#### `GET /browse`

Lista de **perfis sugeridos** segundo as regras de matching.

**Query params (todos opcionais)**

| Param                 | Tipo   | Descrição                                         |
| --------------------- | ------ | ------------------------------------------------- |
| `minAge` / `maxAge`   | int    | Faixa etária                                      |
| `minFame` / `maxFame` | number | Faixa de fame                                     |
| `maxDistanceKm`       | int    | Raio em km                                        |
| `tags`                | csv    | `vegan,geek` (filtrar por tags em comum)          |
| `sortBy`              | enum   | `distance` (default), `age`, `fame`, `commonTags` |
| `order`               | enum   | `asc` / `desc`                                    |
| `page`, `limit`       | int    | paginação                                         |

**Regras aplicadas pelo servidor**

1. Excluir: o próprio usuário, bloqueados (em ambos os sentidos), já curtidos, contas não verificadas, sem foto de perfil.
2. Filtrar por **orientação compatível** (bissexual por padrão se não declarado).
3. Score baseado em: proximidade (peso ↑), tags em comum (peso ↑), fame rating (peso ↓).
4. **Mesma área geográfica tem prioridade**.

**Resposta**

```json
{
  "data": [
    {
      "id": "uuid",
      "username": "ana",
      "age": 27,
      "distanceKm": 3.2,
      "fameRating": 142.5,
      "commonTags": ["vegan", "geek"],
      "profilePhoto": "/uploads/...",
      "city": "São Paulo",
      "neighborhood": "Pinheiros"
    }
  ],
  "pagination": { ... }
}
```

---

### 🔎 10.4 Pesquisa — `/search`

#### `GET /search`

Pesquisa avançada com **um ou mais critérios obrigatórios**.

**Query params**

| Param                              | Descrição                        |
| ---------------------------------- | -------------------------------- |
| `minAge`, `maxAge`                 | obrigatório se filtrar por idade |
| `minFame`, `maxFame`               |                                  |
| `city` ou `lat`+`lng`+`radiusKm`   |                                  |
| `tags`                             | csv                              |
| `sortBy`, `order`, `page`, `limit` | mesmos da `/browse`              |

> Mesmo formato de resposta da `/browse`.

---

### 👥 10.5 Visualização de Perfil — `/users/:id`

#### `GET /users/:id`

Retorna perfil público (sem `email`, sem `password_hash`).

**Side effect:** registra uma entrada em `visits` (exceto se for o próprio usuário) e **dispara notificação** ao visualizado.

**Resposta**

```json
{
	"id": "...",
	"username": "ana",
	"firstName": "Ana",
	"lastName": "S.",
	"age": 27,
	"gender": "female",
	"sexualOrientation": "bi",
	"biography": "...",
	"tags": ["vegan", "geek"],
	"photos": [{ "id": "...", "url": "...", "isProfile": true }],
	"fameRating": 142.5,
	"location": { "city": "São Paulo", "neighborhood": "Pinheiros" },
	"isOnline": true,
	"lastSeenAt": "2026-05-15T10:23:00Z",
	"relationship": {
		"iLiked": false,
		"likedMe": true,
		"matched": false,
		"blocked": false
	}
}
```

- `403 USER_BLOCKED` / `BLOCKED_BY_USER`
- `404`

---

#### `POST /users/:id/like`

Dá like. **Requer ter foto de perfil definida.**

- `201` `{ "matched": true }` se virou match (cria match e notificação para ambos).
- `201` `{ "matched": false }`.
- `409 ALREADY_LIKED`
- `422 NO_PROFILE_PHOTO`

> Dispara notificação `like` ou `match`.

---

#### `DELETE /users/:id/like`

Remove like. Se havia match, **desfaz** (chat é fechado, notificações desativadas).

- `204`
- Dispara notificação `unlike` ao outro usuário.

---

#### `POST /users/:id/report`

**Body** `{ "reason": "fake_account" }` (`fake_account` é o motivo mínimo do escopo).

- `201`
- `409 ALREADY_REPORTED`

---

#### `POST /users/:id/block`

Bloqueia: o usuário some das buscas, notificações e chat de ambos os lados.

- `201`

---

#### `DELETE /users/:id/block`

Desbloqueia.

- `204`

---

### 💬 10.6 Chat — `/chats`

> Chat só liberado entre usuários **conectados** (match ativo). Mensagens em tempo real via WebSocket, mas há endpoints REST para histórico e envio fallback.

#### `GET /chats`

Lista das conversas (matches) do usuário com última mensagem e contador de não lidas.

```json
{
	"data": [
		{
			"matchId": "uuid",
			"user": {
				"id": "...",
				"username": "ana",
				"profilePhoto": "...",
				"isOnline": true
			},
			"lastMessage": { "content": "oi!", "createdAt": "...", "fromMe": false },
			"unreadCount": 3
		}
	]
}
```

---

#### `GET /chats/:matchId/messages?before=<msgId>&limit=50`

Histórico paginado por cursor (mensagens mais antigas).

```json
{
	"data": [
		{
			"id": "uuid",
			"senderId": "...",
			"content": "oi!",
			"readAt": null,
			"createdAt": "2026-05-15T10:22:00Z"
		}
	],
	"hasMore": true
}
```

- `403 NOT_MATCHED`

---

#### `POST /chats/:matchId/messages`

Envio via REST (fallback ao WS).

**Body** `{ "content": "olá!" }`

- `201` — mensagem criada. Servidor emite evento `message:new` via WS para o destinatário.

---

#### `PATCH /chats/:matchId/read`

Marca todas as mensagens recebidas dessa conversa como lidas.

- `204`

---

### 🔔 10.7 Notificações — `/notifications`

#### `GET /notifications?unreadOnly=true&page=1&limit=20`

Lista de notificações.

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "like",
      "actor": { "id":"...", "username":"ana", "profilePhoto":"..." },
      "payload": {},
      "readAt": null,
      "createdAt": "..."
    }
  ],
  "unreadCount": 5,
  "pagination": { ... }
}
```

---

#### `PATCH /notifications/:id/read`

`204`.

---

#### `PATCH /notifications/read-all`

`204`.

---

## 11. Eventos WebSocket

**Conexão:** `wss://localhost/ws` — autenticação via token JWT em handshake (query `?token=...` ou header `Authorization`).

> ⚠️ **Delay máximo: 10s** para chat e notificações.

### Convenção

| Direção            | Prefixo            | Exemplos                          |
| ------------------ | ------------------ | --------------------------------- |
| Cliente → Servidor | verbo              | `message:send`, `typing:start`    |
| Servidor → Cliente | substantivo:evento | `message:new`, `notification:new` |

### Eventos do cliente

| Evento          | Payload                | Descrição                                    |
| --------------- | ---------------------- | -------------------------------------------- |
| `message:send`  | `{ matchId, content }` | Envia mensagem. Servidor persiste e propaga. |
| `message:read`  | `{ matchId }`          | Marca mensagens lidas.                       |
| `typing:start`  | `{ matchId }`          | Indica digitação (opcional).                 |
| `typing:stop`   | `{ matchId }`          |                                              |
| `presence:ping` | —                      | Heartbeat para `is_online`.                  |

### Eventos do servidor

| Evento             | Payload                                         |
| ------------------ | ----------------------------------------------- |
| `message:new`      | `{ id, matchId, senderId, content, createdAt }` |
| `message:read`     | `{ matchId, readerId, readAt }`                 |
| `typing`           | `{ matchId, userId, isTyping }`                 |
| `notification:new` | `{ id, type, actor, payload, createdAt }`       |
| `presence:update`  | `{ userId, isOnline, lastSeenAt }`              |
| `match:created`    | `{ matchId, user }`                             |
| `match:removed`    | `{ matchId }`                                   |
| `error`            | `{ code, message }`                             |

### Mapeamento de notificações

| Trigger                  | Evento WS                            | Tipo de notificação |
| ------------------------ | ------------------------------------ | ------------------- |
| `POST /users/:id/like`   | `notification:new`                   | `like`              |
| Like mútuo               | `match:created` + `notification:new` | `match`             |
| `GET /users/:id`         | `notification:new`                   | `visit`             |
| Mensagem recebida        | `message:new` + `notification:new`   | `message`           |
| `DELETE /users/:id/like` | `match:removed` + `notification:new` | `unlike`            |

---

## 12. Segurança

- **Senhas:** bcrypt ≥ 12 rounds; bloqueio de senhas comuns via `zxcvbn` (score ≥ 3).
- **JWT:** secrets fortes (32+ bytes aleatórios); access curto + refresh em cookie httpOnly Secure SameSite=Strict.
- **HTTPS:** obrigatório (Nginx + cert local em dev).
- **Rate limiting:** `express-rate-limit` em `/auth/*` (ex: 5 tentativas / 15 min por IP).
- **Helmet:** headers de segurança.
- **CORS:** apenas origin do frontend.
- **Validação:** todo input validado (Zod/Joi); nunca confiar em ID vindo do cliente — sempre conferir contra `req.user.id`.
- **SQL Injection:** Knex já parametriza; nunca concatenar strings em raw queries.
- **Upload:** validar mime + magic bytes; redimensionar com `sharp`; gerar nome aleatório; servir via Nginx (não via Node).
- **GDPR:** consentimento explícito para GPS; endpoint de exclusão de conta (`DELETE /users/me`) deve apagar dados em cascata.
- **Tokens de e-mail:** uso único, hash em DB, expiração 24h (verificação) / 1h (reset).

---

## 13. Setup e Execução

```bash
# 1. Clonar e configurar
cp .env.example .env
# editar .env

# 2. Gerar certificados
./scripts/gen-certs.sh

# 3. Subir os containers
docker compose up -d --build

# 4. Rodar migrations e seeds (dentro do container api)
docker compose exec api npx knex migrate:latest
docker compose exec api npx knex seed:run

# 5. Acessar
# Frontend + API: https://localhost
# (aceitar o certificado self-signed no navegador)

# Logs
docker compose logs -f api
```

### Comandos úteis

```bash
# Nova migration
docker compose exec api npx knex migrate:make create_users_table

# Reset do banco (dev only!)
docker compose exec api npx knex migrate:rollback --all
docker compose exec api npx knex migrate:latest

# Acessar o psql
docker compose exec db psql -U matcha -d matcha_db
```

---

## 📌 Checklist de Conformidade com os Requisitos

| Requisito                               | Coberto por                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| Registro com e-mail + verificação       | `POST /auth/register` + `GET /auth/verify-email/:token`        |
| Senha forte                             | Validação `zxcvbn` em register/reset                           |
| Login + reset por e-mail                | `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` |
| Logout em um clique                     | `POST /auth/logout` (frontend exibe global)                    |
| Perfil completo                         | `PATCH /users/me`, `/photos`, `/tags`, `/location`             |
| Até 5 fotos                             | Constraint em `photos` + validação                             |
| Tags reutilizáveis                      | `tags` + `user_tags` + `GET /tags`                             |
| Ver quem visitou / curtiu               | `GET /users/me/visitors`, `/likes`                             |
| Fame rating público                     | Campo `fame_rating` em `users`                                 |
| GPS com consentimento + fallback manual | `PATCH /users/me/location` com `consent`                       |
| Browsing com matching inteligente       | `GET /browse` (proximidade, tags, fame, orientação)            |
| Pesquisa avançada                       | `GET /search`                                                  |
| Visualização de perfil + ações          | `GET /users/:id`, like/unlike/report/block                     |
| Match e chat liberados                  | `matches` view + `/chats`                                      |
| Chat em tempo real ≤ 10s                | WebSocket `message:*`                                          |
| Notificações em tempo real ≤ 10s        | WebSocket `notification:new`                                   |
| Não lidas visíveis em qualquer página   | `unreadCount` global retornado em vários endpoints             |

---

**Última atualização:** Maio/2026
