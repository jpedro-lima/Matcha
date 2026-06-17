# Lista de Implementação — API Matcha (Node.js + Express + Knex)

Roteiro sequencial para construir do zero a API descrita em [DOC.md](DOC.md), atendendo [specifications.md](specifications.md).

**Princípios:**

- **Entregáveis testáveis em cada fase.** Cada fase encerra com um cenário concreto (curl, psql, log esperado) que valida o trabalho antes da próxima começar.
- **Instalação _just-in-time_.** Cada fase instala somente as dependências que ela consome. Nada de pré-instalar pacotes que ainda não serão usados.
- **Migrations _just-in-time_.** Tabelas migram junto da fase que as consome — não há um "big bang" de schema no começo.
- **Migrations sempre via `knex migrate:make`.** Nunca criar arquivos de migration manualmente. Use sempre `npm run migrate:make -- <nome_em_snake_case>` para que o knex aplique o timestamp padrão (`YYYYMMDDHHMMSS_<nome>.ts`) e a ordem cronológica fique garantida. Em todo o restante deste documento, quando aparecer "migration `<nome>`", está implícito que o arquivo é gerado por esse comando.
- **TDD por módulo de negócio (Vitest).** A partir da Fase 4, para **cada módulo de regra de negócio** (passwordService, jwtService, profileService, matchService, etc.), o ciclo é estrito:
  1. **Red** — escrever o(s) teste(s) Vitest cobrindo o comportamento esperado da regra. O teste deve falhar (módulo ainda não existe ou não está completo).
  2. **Green** — implementar o **service** mínimo para passar o teste.
  3. **Refactor** — limpar a implementação sem quebrar testes.
  4. Só **depois do service verde**, implementar o **controller** (também precedido por teste de integração com `supertest` quando fizer sentido — ex.: validação de body, auth obrigatório).

  Ordem dentro de cada fase: `migrations → testes do service → service → testes do controller (opcional) → controller`. Não pular para o controller antes do service estar coberto.

- **Separação rígida controller × service.** Controllers cuidam **apenas de HTTP** (parse de `req`, chamada de service, formatação de `res`). **Não importam Knex**, não escrevem SQL, não conhecem `db`. Services em [src/services/](app/api/src/services/) carregam regra de negócio + acesso a dados; recebem argumentos puros, levantam `AppError` quando algo violar invariantes. Essa fronteira é o que torna o TDD do princípio anterior viável — services testam sem subir Express.

---

## Fase 0 — Bootstrap do projeto ✅

1. `app/api/` com `package.json` (`"type": "module"`), scripts `dev`/`build`/`start`/`lint`/`format`/`typecheck`/`migrate`/`seed`.
2. TypeScript + tsx + ESLint + Prettier; `tsconfig.json` com `strict`, `module/moduleResolution: nodenext`.
3. Express + cors + helmet + cookie-parser + compression + morgan + zod (runtime). `@types/*` dev.
4. Estrutura `src/{config,database/{migrations,seeds},middlewares,routes,controllers,services,models,sockets,utils,validators}` — tudo sob `src/`, inclusive migrations (`tsc` compila junto, e o knex carrega `.ts` em dev / `.js` em prod via `loadExtensions`).
5. `.env.example` único na raiz; `.gitignore` central na raiz cobrindo `.env`, `node_modules/`, `dist/`, `uploads/`.
6. `src/config/env.ts` validando ambiente com Zod (`JWT_*` ≥ 32 chars, falha rápido).

## Fase 1 — Infra local (Docker + Nginx + TLS) ✅

7. `app/api/Dockerfile` multi-stage (build com `tsc` → runtime `node:20-alpine`, usuário não-root).
8. `docker-compose.yml` na raiz com `db` (postgres:16-alpine, healthcheck `pg_isready`), `api`, `nginx`. Volumes nomeados `matcha_db`, `matcha_uploads`, `matcha_certs`. Network `matcha_net`.
9. `nginx/Dockerfile` extends `nginx:1.27-alpine` + openssl; `nginx/gen-certs.sh` em `/docker-entrypoint.d/` gera certificado self-signed idempotentemente na primeira subida.
10. `nginx/nginx.conf` com redirect 80→443, TLS 1.2/1.3, proxy `/api/` e `/ws/`, `location /uploads/` direto, `location /` (SPA) comentado até o frontend voltar ao compose.
11. `GET /api/health` retornando `{ status: "ok" }`. Validado via `make health`.
12. `Makefile` com `up`/`down`/`restart`/`logs`/`ps`/`health`/`regen-certs`/`clean`/`nuke`/`help`. Zero dependência no host além de Docker.

**Checkpoint:** `make up && make health` retorna `HTTP 200 {"status":"ok"}` em uma máquina sem `node`/`openssl` instalados.

---

## Fase 2 — Knex + PostgreSQL (setup, sem schema de domínio) ✅

> Objetivo: Knex operacional e conectado ao Postgres, com pipeline de migrations funcionando end-to-end. **Sem migrar nenhuma tabela de negócio ainda** — isso fica para as fases que consomem cada tabela.

**Instalar (delta da fase):** `knex`, `pg` (runtime); `@types/pg` (dev).

13. **`src/database/knexfile.ts`** com perfis `development`/`test`/`production` lendo `POSTGRES_*` do env validado. Cliente `pg`, pool padrão, `migrations.directory`/`seeds.directory` resolvidos via `import.meta.url` (relativos ao próprio knexfile), `extension: 'ts'` + `loadExtensions: ['.ts', '.js']` (dev usa `.ts` via tsx; prod compilada carrega `.js`).
14. **`src/config/db.ts`** exportando uma instância singleton de Knex inicializada a partir do `knexfile`. Encerrar com `db.destroy()` em handlers `SIGTERM`/`SIGINT`.
15. **`GET /api/db-health`** que executa `SELECT version()` e devolve `{ ok: true, version: "PostgreSQL 16.x …" }`. Endpoint de smoke test apenas; será removido ao final da fase ou marcado como interno.
16. **Habilitar `pgcrypto`** em uma migration `enable_pgcrypto` (`CREATE EXTENSION IF NOT EXISTS pgcrypto`) — necessário para `gen_random_uuid()` daqui em diante. _(Os dois primeiros arquivos do repo — `0001_pgcrypto.ts` e `0002_smoke.ts` — foram criados manualmente antes da convenção; renomear depois ou deixar como exceção histórica.)_
17. **Migration `smoke`** criando + dropando uma tabela `_smoke` só para validar `up`/`down`. Rodar `npm run migrate` e `npm run migrate:rollback` e confirmar o ciclo. Pode ser deletada antes da Fase 3 ou mantida como exemplo.

**Checkpoint:**

```bash
make up                                         # db + api sobem; api passa health
docker compose exec api npm run migrate         # aplica 0001 + 0002
curl -sk https://localhost/api/db-health        # {"ok":true,"version":"PostgreSQL 16..."}
docker compose exec db psql -U matcha -d matcha_db -c '\dx'   # pgcrypto listado
docker compose exec api npm run migrate:rollback              # 0002 desfeito sem erro
```

---

## Fase 3 — Camadas transversais (sem Socket.IO)

> Objetivo: Express bem composto, com logger estruturado, tratamento de erro padronizado e validação Zod genérica. **Sem WebSocket** — Socket.IO entra apenas na Fase 8.

**Instalar (delta da fase):** `pino`, `pino-http` (runtime); `vitest`, `supertest`, `@types/supertest` (dev). Morgan deixa de ser usado (substituído pelo pino-http) — remover do `package.json`.

18. **Split `server.ts` → `app.ts` + `server.ts`.** `app.ts` exporta o Express já composto; `server.ts` faz apenas `app.listen()`, com graceful shutdown (`SIGTERM` → fecha HTTP server + `db.destroy()`).
19. **Middlewares globais em `app.ts`:** `helmet()`, `cors({ origin: env.APP_URL, credentials: true })`, `cookieParser()`, `compression()`, `express.json({ limit: '1mb' })`, `express.urlencoded({ extended: false })`.
20. **Logger `pino` + `pino-http`** com transporte pretty em dev. Injetar `X-Request-Id` (gerar UUID se ausente, ecoar no header de resposta) e correlacionar nos logs.
21. **`AppError` + error handler global.** Classe com `code`, `status`, `message`, `details?`. Middleware final converte para o formato `{ error: { code, message, details } }` da seção 9 do DOC. Erros sem `AppError` viram 500 genérico (sem vazar stack em produção).
22. **`validate(schemas)` middleware.** Recebe `{ body?, query?, params? }` com schemas Zod, popula `req.body`/`query`/`params` parseados, lança `AppError('VALIDATION_ERROR', 400, …)` com `details` no erro. Rota stub `POST /api/_test/validate` (criada e removida ao final da fase) para provar o caminho.
23. **Setup Vitest** — `vitest.config.ts` com `environment: 'node'`, `globals: false` (forçar imports explícitos de `describe`/`it`/`expect`), pasta de testes co-localizada (`*.test.ts` ao lado do arquivo testado). Scripts no `package.json`: `test`, `test:watch`, `test:coverage`. Adicionar primeiro teste sanity (`expect(1 + 1).toBe(2)`) só para validar o pipeline. **Sem este step a Fase 4 não pode começar** — o TDD do princípio acima depende do runner estar pronto.

**Checkpoint:**

```bash
curl -sk https://localhost/api/health -H 'x-request-id: abc-123' -i
# Resposta inclui header x-request-id: abc-123
# Log da API contém o mesmo request id numa linha JSON estruturada

curl -sk -X POST https://localhost/api/_test/validate -d '{}' -H content-type:application/json
# 400 com {"error":{"code":"VALIDATION_ERROR","message":"…","details":[…]}}

npm test     # pipeline Vitest passa com pelo menos o teste sanity
```

---

## Fase 4 — Autenticação (`/auth`)

> Objetivo: ciclo completo `register → verify → login → refresh → logout → forgot/reset` funcionando via curl. Subdividida em três entregas testáveis.

### Fase 4.1 — Schema e seed de identidade

**Instalar (delta da fase):** `bcrypt` + `@types/bcrypt` (já para conseguir gerar o hash do seed).

24. **Migration `users`** (`npm run migrate:make -- users`) com a tabela `users` da seção 7 do DOC: `id uuid PK default gen_random_uuid()`, `email`/`username` UNIQUE NOT NULL, `first_name`/`last_name`, `password_hash`, `email_verified bool default false`, `created_at`/`updated_at`. Índices únicos em `email` e `username`.
25. **Migration `auth_tokens`** (`npm run migrate:make -- auth_tokens`) com:
    - `email_tokens(token_hash varchar(64) PK, user_id uuid FK CASCADE, expires_at timestamptz, created_at)`
    - `password_reset_tokens` com mesma estrutura.
    - Índice em `user_id` para invalidação por usuário.
26. **Seed `01_users.ts`** inserindo 5 usuários verificados (`email_verified=true`) com senha conhecida (`Test1234!`) hashada via bcrypt (12 rounds). Documentar credenciais no topo do arquivo.

**Checkpoint:**

```bash
docker compose exec api npm run migrate
docker compose exec api npm run seed
docker compose exec db psql -U matcha -d matcha_db -c 'select email, email_verified from users;'
# Mostra os 5 usuários com email_verified=true.
docker compose exec db psql -U matcha -d matcha_db -c '\d email_tokens'
# Coluna token_hash, FK em user_id com ON DELETE CASCADE.
```

### Fase 4.2 — Serviços e middlewares de auth (TDD, sem rotas ainda)

**Instalar (delta da fase):** , `jsonwebtoken` + `@types/jsonwebtoken`, `nodemailer` + `@types/nodemailer`.

Cada módulo abaixo segue o ciclo **Red → Green → Refactor**. Os testes ficam co-localizados (`src/services/tests/<nome>.spec.ts`).
As senhas devem conter número, caractere, e simbolo validados via zod regex.

27. **`passwordService`** —
    - 🔴 `passwordService.test.ts`: `hashPassword` retorna string diferente do input; `verifyPassword(hash, plain)` é `true` e contra senha errada é `false`; rounds ≥ 12 (inspecionar prefixo bcrypt).
    - 🟢 Implementar `services/passwordService.ts` com `hashPassword` / `verifyPassword`.
28. **`passwordPolicy`** —
    - 🔴 `passwordPolicy.test.ts`: `123456` lança `AppError('WEAK_PASSWORD')`; `senha` (dicionário) lança; `Test1234!` (sem score zxcvbn ≥ 3 dependendo do user info) lança; `Forte#2026!` passa.
    - 🟢 Implementar `services/passwordPolicy.ts` com `assertStrongPassword` rodando zxcvbn (score ≥ 3) + regex de complexidade.
29. **`jwtService`** —
    - 🔴 `jwtService.test.ts`: `signAccess({sub:'x'})` produz JWT decodável; `verifyAccess(token)` devolve payload; token expirado lança; refresh tem TTL diferente; secret errado falha.
    - 🟢 Implementar `services/jwtService.ts` (`signAccess`/`signRefresh`/`verifyAccess`/`verifyRefresh`).
30. **`tokenService`** (usa banco — precisa de helper de setup/teardown de DB de teste; ver item 33) —
    - 🔴 `tokenService.test.ts`: `issueEmailToken(userId)` salva **hash** em `email_tokens` (não o token cru); retorna token cru no formato esperado; `consumeToken` valida hash, deleta e retorna `userId`; segunda chamada com o mesmo token falha (uso único); token expirado é rejeitado.
    - 🟢 Implementar `services/tokenService.ts` com `crypto.randomBytes(32)` + `sha256`.
31. **`emailService`** — sem testes unitários (apenas wrapper Nodemailer). Em vez disso, fica documentado como dependência injetável; nos testes dos services que usam (`registerService` na 4.3) será mockado com `vi.fn()`.
32. **`requireAuth` middleware** —
    - 🔴 `requireAuth.test.ts`: chamada sem `Authorization` lança 401 `MISSING_TOKEN`; com token inválido lança 401 `INVALID_TOKEN`; com token válido popula `req.user` e chama `next()`.
    - 🟢 Implementar `middlewares/requireAuth.ts`.
33. **Infra de testes que tocam o DB** — `vitest.config.ts` aponta para um banco de teste (`POSTGRES_DB=matcha_db_test`), com helper `beforeEach` que roda migrate + truncate, e `afterAll` que faz `db.destroy()`. Documentar no README. (Alternativa: usar transações que dão rollback ao fim de cada teste — mais rápido, menos isolamento entre testes paralelos.)

**Checkpoint:** `npm test` verde, cobertura ≥ 80% nos services acima. Nenhum endpoint de auth ainda existe — services e middlewares são consumidos só por testes.

### Fase 4.3 — Services orquestradores, controllers e rotas

Cada endpoint passa por duas camadas: um **service orquestrador** (`authService`) que combina os módulos da 4.2 e expõe operações de negócio (`register`, `login`, etc.), e o **controller** fino. O TDD se aplica ao service orquestrador; o controller ganha smoke tests de integração via `supertest`.

34. **`authService` — `register(input)`** —
    - 🔴 testes: rejeita email duplicado (`EMAIL_EXISTS`), username duplicado (`USERNAME_EXISTS`), senha fraca; em sucesso cria usuário + token de e-mail em transação e chama `emailService.sendVerificationEmail` (mockado). `email_verified=false` na linha criada.
    - 🟢 implementar `services/authService.ts#register`.
35. **`authService` — `verifyEmail(token)`** —
    - 🔴 testes: token inválido lança `INVALID_TOKEN`; token expirado lança `EXPIRED_TOKEN`; sucesso marca `email_verified=true` e remove o token.
    - 🟢 implementar.
36. **`authService` — `login(username, password)`** —
    - 🔴 testes: credenciais erradas → `INVALID_CREDENTIALS` 401; email não verificado → `EMAIL_NOT_VERIFIED` 403; sucesso devolve `{accessToken, refreshToken}` válidos.
    - 🟢 implementar.
37. **`authService` — `refresh`, `logout`, `forgotPassword`, `resetPassword`** — mesmo ciclo: testes primeiro descrevendo cada error code esperado + happy path, depois implementação. `refresh` rotaciona token (blocklist em DB ou jti+exp em memória; documentar tradeoff). `logout` revoga refresh. `forgotPassword` sempre 200 (não revela existência). `resetPassword` valida força + consome token + atualiza hash.
38. **Controllers e rotas em [src/controllers/authController.ts](app/api/src/controllers/authController.ts) + [src/routes/auth.ts](app/api/src/routes/auth.ts)** — controllers são adapters HTTP, **não importam Knex** nem `db`:
    - `POST /auth/register` → `authService.register`.
    - `GET /auth/verify-email/:token` → `authService.verifyEmail`.
    - `POST /auth/login` → `authService.login` + set-cookie do refresh.
    - `POST /auth/refresh` → `authService.refresh`.
    - `POST /auth/logout` → `authService.logout` + clear-cookie.
    - `POST /auth/forgot-password` → `authService.forgotPassword`.
    - `POST /auth/reset-password` → `authService.resetPassword`.
    - `GET /auth/me` (com `requireAuth`) → devolve `{ id, username, email, emailVerified }` (carregado do DB).
39. **Testes de integração com `supertest`** — `auth.integration.test.ts`: sobe `app` (sem `listen`), faz `POST /auth/register` + assert 201 + checa que registro foi persistido; idem para login/refresh/logout. Cobre o caminho HTTP completo incluindo `validate` middleware.
40. **Rate limit** em `/auth/register|login|forgot-password|reset-password`: `express-rate-limit` 5 requisições / 15 min por IP. Testar o teto via integração (loop de 6 requests).

**Checkpoint** (`README` da fase ou script `app/scripts/auth-smoke.sh`):

```bash
# 1. Registra
curl -sk -X POST https://localhost/api/auth/register \
  -H content-type:application/json \
  -d '{"email":"x@y.com","username":"x","firstName":"X","lastName":"Y","password":"Forte#2026!"}'
# 201; e-mail aparece nos logs (Mailtrap)

# 2. Verifica via link impresso/Mailtrap
curl -sk https://localhost/api/auth/verify-email/<token>
# 200

# 3. Login
curl -sk -c cookies.txt -X POST https://localhost/api/auth/login \
  -H content-type:application/json -d '{"username":"x","password":"Forte#2026!"}'
# 200, body com accessToken; cookies.txt com refresh

# 4. Rota protegida
curl -sk https://localhost/api/auth/me -H "Authorization: Bearer <accessToken>"
# 200 com {id, username, email, emailVerified:true}

# 5. Refresh + logout
curl -sk -b cookies.txt -X POST https://localhost/api/auth/refresh   # 200
curl -sk -b cookies.txt -X POST https://localhost/api/auth/logout    # 204
```

---

## Fase 5 — Perfil (`/users/me`, fotos via S3, tags, localização)

> Objetivo: usuário consegue completar perfil, subir/excluir/promover fotos (upload direto pro storage, sem passar bytes pela API), gerenciar tags reutilizáveis e atualizar localização (com consentimento ou manual). Subdividida em seis entregas testáveis.

> **TDD aplicado a cada service** desta fase: teste primeiro, implementação depois. Handlers são adapters HTTP — testar via `supertest` quando tiver lógica não trivial.

### Fase 5.1 — Infra de object storage (MinIO + nginx + SDK)

> Objetivo: storage dedicado rodando local via Docker, com presigned URLs prontas. **A API nunca recebe bytes de imagem** — cliente faz `PUT` direto no bucket, API só intermedeia metadados/permissão. Sem testes em `common/` (wrapper sobre SDK npm).

**Instalar (delta da fase):** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (runtime). `multer` e `sharp` **não** entram — a API não processa imagens.

41. **Serviço `minio` no `docker-compose.yml`** (`minio/minio:latest`), healthcheck `/minio/health/live`, volume nomeado `matcha_minio`, console em `:9001` (dev only), envs `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`. Init container `minio/mc` cria o bucket `matcha-photos` na primeira subida e aplica policy de leitura pública — controle de acesso fica nas rotas da API (perfis são públicos a usuários autenticados).
42. **Env vars `S3_*`** validadas em `src/config/env.ts`: `S3_ENDPOINT` (internal: `http://minio:9000`), `S3_REGION` (`us-east-1` placeholder), `S3_BUCKET` (`matcha-photos`), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` (`https://localhost/uploads` — URL público via nginx).
43. **`src/common/services/s3.service.ts`** — wrapper sobre o AWS SDK: `presignPut(key, contentType, contentLength)` retorna `{ uploadUrl, expiresAt }` (TTL 5 min), `head(key)` valida que objeto chegou + retorna size/contentType, `getRange(key, bytes)` baixa primeiros N bytes (para magic-byte check), `delete(key)`, `publicUrl(key)` → `${S3_PUBLIC_URL}/${key}`.
44. **`nginx.conf`** ganha `location /uploads/` proxying para `http://minio:9000/matcha-photos/` com `proxy_cache_path`, `proxy_cache_valid 200 7d`, `add_header Cache-Control "public, max-age=604800"`. Fotos são imutáveis por key — cache agressivo é seguro.

**Checkpoint:**

```bash
make up                                              # api, minio, nginx
docker compose exec api curl -fI http://minio:9000/minio/health/live  # 200
curl -sk https://localhost/uploads/idontexist.txt -o /dev/null -w '%{http_code}\n'   # 404 do MinIO via nginx — roteamento OK
# Gerar presigned PUT por REPL temporário e fazer PUT manual no URL retornado;
# depois confirmar que `curl -sk https://localhost/uploads/<key>` devolve o conteúdo.
```

### Fase 5.2 — Perfil base (schema + leitura/edição)

45. **Migration `profiles`** (`npm run migrate:make -- profiles`) — tabela `profiles` 1:1 com `users` (PK = FK CASCADE), todos os campos da seção 7 do DOC; CHECKs `gender ∈ {m,f,nb,other}`, `sexual_orientation ∈ {hetero,homo,bi,other}`, `birth_date <= now - 18 years`; índices `(gender, sexual_orientation)`, `(latitude, longitude)`, `fame_rating DESC`. **Atualizar `auth.service.register`** para inserir linha em `profiles` (campos opcionais NULL) na mesma transação.
46. **`GET /users/me`** retorna `{ user: {id, email, username, firstName, lastName, emailVerified}, profile: {...} }`. **`PATCH /users/me`** edita campos não-foto/não-tag/não-location: `firstName`, `lastName`, `bio`, `gender`, `sexualOrientation`, `birthDate`. Mudança de `email` dispara fluxo de re-verificação (gera `email_token` novo, marca `email_verified=false`). Validação via `modules/user/user.schemas.ts`.

**Checkpoint:** `GET /users/me` retorna `{ user, profile }`; `PATCH /users/me` altera bio/gênero; `PATCH /users/me` com `email` novo gera nova linha em `email_tokens` e baixa `email_verified` no banco.

### Fase 5.3 — Localização

47. **`PATCH /users/me/location`** aceita dois shapes válidos no schema Zod: `{ consent: true, latitude, longitude }` (GPS do browser) ou `{ consent: false, city, neighborhood }` (fallback manual). Backend valida coords (`-90 ≤ lat ≤ 90`, `-180 ≤ lon ≤ 180`) e persiste em `profiles`. **Sem fallback IP automático no backend** — esse é trabalho do frontend (e o usuário precisa consentir explicitamente, conforme `specifications.md`).

**Checkpoint:** PATCH com `consent=true` + coords grava no banco; PATCH com `consent=false` sem `city` retorna `400 VALIDATION_ERROR`.

### Fase 5.4 — Fotos via presigned URL (3 passos do cliente)

> **Fluxo:** (1) cliente pede slot → API gera presigned PUT + cria linha `status='pending'`; (2) cliente faz `PUT` direto no MinIO com os bytes; (3) cliente confirma → API valida via HEAD + magic bytes e marca `status='ready'`. **A API nunca recebe os bytes da imagem.** Resize é responsabilidade do cliente (canvas no frontend, idealmente WebP ≤ 1024px no lado maior).

**Instalar (delta):** `file-type` (runtime — validação de magic bytes via stream parcial).

48. **Migration `photos`** (`npm run migrate:make -- photos`) ✅ — `id uuid PK default gen_random_uuid()`, `user_id uuid FK CASCADE`, `key text NOT NULL UNIQUE`, `mime varchar(32)`, `bytes int`, `status varchar(16) NOT NULL default 'pending'` (`pending`/`ready`/`failed`), `created_at timestamptz default now()`. Índice em `user_id`. (Designação de foto de perfil dropada — não há `is_profile` por decisão da Fase 5.4.)
49. **`POST /users/me/photos/presign`** ✅ — body `{ contentType, size }`. Service valida: `contentType ∈ {image/jpeg, image/png, image/webp}`, `size ≤ 5MB`, user tem `< 5` fotos com `status ∈ ('ready', 'pending')`. Gera `photoId`, `key = <userId>/<photoId>`, chama `s3.presignPut`, insere linha `status='pending'`, retorna `{ photoId, uploadUrl, expiresAt }`.
50. **`POST /users/me/photos/:id/confirm`** ✅ — service faz `s3.head(key)`; se 404/403 → marca `failed`, retorna `404 PHOTO_NOT_UPLOADED`. Valida `content-length`/`content-type` retornados pelo MinIO contra o que foi declarado no presign. Baixa primeiros 32 bytes via `s3.getRange`, passa pelo `file-type` — se MIME real ≠ declarado → `s3.delete` + marca `failed` + retorna `400 INVALID_FILE_TYPE`. Sucesso → `status='ready'`, retorna `{ id, url, mime, bytes, status }`. **`DELETE /users/me/photos/:id`** ✅ apaga linha + chama `s3.delete`. **`GET /users/me/photos`** ✅ lista fotos do usuário (excluindo `failed`).

> **Limpeza de fotos órfãs** (linhas `status='pending'` que nunca foram confirmadas) **fica adiada para a Fase 10** — não é caminho crítico para a feature funcionar.

**Checkpoint:**

```bash
# 1. Presign
PRESIGN=$(curl -sk -X POST https://localhost/api/users/me/photos/presign \
  -H 'Authorization: Bearer <t>' -H content-type:application/json \
  -d '{"contentType":"image/webp","size":120000}')
URL=$(echo "$PRESIGN" | jq -r .uploadUrl)
ID=$(echo "$PRESIGN"  | jq -r .photoId)

# 2. Upload direto no MinIO (API nunca recebe os bytes)
curl -X PUT "$URL" --data-binary @teste.webp -H content-type:image/webp

# 3. Confirm — API valida via HEAD + magic bytes
curl -sk -X POST https://localhost/api/users/me/photos/$ID/confirm \
  -H 'Authorization: Bearer <t>'
# {id, url: "https://localhost/uploads/<userId>/<photoId>", isProfile: false}

# 4. Browser: abrir o url devolvido — imagem é servida pelo nginx (cache 7d)
```

### Fase 5.5 — Tags ✅

51. **Migration `tags_user_tags`** ✅ — `tags(id serial PK, name varchar(40) UNIQUE, created_at)` + `user_tags(user_id FK CASCADE, tag_id FK CASCADE, PK composta, idx em tag_id)`. **`GET /users/me/tags`** ✅ lista tags do user ordenadas por nome. **`PUT /users/me/tags`** ✅ substitui todo o conjunto em transação: schema normaliza (trim+lowercase+strip `#`) e valida regex `[a-z0-9-]`, service deduplica + `INSERT ... ON CONFLICT DO NOTHING` em `tags`, deleta vínculos antigos e cria os novos. Limite: 20 tags por user. **`GET /tags?query=`** ✅ autocomplete (LIMIT 20 por prefixo, `ORDER BY count(user_tags) DESC, name ASC`). Query schema só aceita `[a-z0-9-]+` — bloqueia wildcards `%`/`_` do LIKE.

**Checkpoint:** ✅ `PUT /users/me/tags` com `["vegan","Music","music"]` cria 2 tags únicas (`vegan`, `music`) e vincula ambas ao user. `GET /tags?query=mu` retorna `music`.

### Fase 5.6 — Completude ✅

52. **`profile_completed_at` hook** ✅ — `common/services/completeness.service.ts#recalculateCompleteness(userId, executor?)` chamado ao fim de `PATCH /users/me`, `PATCH /users/me/location`, `POST /photos/:id/confirm`, e **dentro da transação** do `PUT /users/me/tags`. Marca `profile_completed_at = now()` quando todos os sinais (`bio`, `gender`, `sexual_orientation`, `birth_date`, `location_consent ≠ null`, ≥ 1 foto `ready`, ≥ 1 tag) estão presentes E o timestamp ainda é NULL. **One-way**: não regride.

**Checkpoint final da Fase 5:** ✅ E2E via curl prova que o timestamp só preenche no último passo (PUT tag) e que mutações subsequentes não alteram o valor.

---

## Fase 6 — Descoberta (`/browse` e `/search`)

> Objetivo: feed de **até 10 perfis** sugeridos, compatíveis com filtros opcionais e com **exclusão automática** de: self, perfis incompletos, contas não verificadas, quem o user já decidiu sobre (like ou dislike), bloqueios em qualquer direção e orientação incompatível. Subdividida em três entregas testáveis.

> **Pré-requisito não-óbvio:** `/browse` precisa filtrar por likes, dislikes e blocks **antes** desses ganharem "significado social" (match mútuo, notificações, UI de bloqueio). Por isso o schema dessas tabelas entra na Fase 6.1, **não** na Fase 7.

> **TDD aplicado:** `browse.service` (engine de seleção e ordenação) — testes primeiro descrevendo cada critério de exclusão e cada filtro como cenário independente (mock do `dbBuilder`).

### Fase 6.1 — Schema de interações + helper de compatibilidade ✅

53. **Migration `interactions_core`** (`npm run migrate:make -- interactions_core`):
    - **`user_swipes`** — `swiper_id uuid FK users CASCADE`, `target_id uuid FK users CASCADE`, `decision varchar(8) CHECK (decision IN ('like','dislike'))`, `created_at timestamptz default now()`, **PK composta `(swiper_id, target_id)`**, `CHECK (swiper_id != target_id)`. Índice extra em `target_id` (consultas "quem me curtiu" na Fase 7). **A PK garante o invariante "uma decisão por par"** — rewind (dislike → like) vira `UPDATE`, não dupla-row.
    - **`blocks`** — `blocker_id uuid FK CASCADE`, `blocked_id uuid FK CASCADE`, `created_at`, PK composta, `CHECK (blocker_id != blocked_id)`. Bloqueio é unidirecional na tabela; o filtro do browse aplica em ambos sentidos (`OR`).
    - **SQL function `is_orientation_compatible(my_gender text, my_orient text, their_gender text, their_orient text) RETURNS bool`** cobrindo a matriz hetero/homo/bi/other. Regra: retorna `true` quando **cada lado está na "lista de procura" do outro**. `other` vira wildcard inclusivo nos dois eixos. NULL em orient default = `'bi'` (conforme spec).
    - **SQL function `haversine_km(lat1, lon1, lat2, lon2) RETURNS double precision`** — distância em km via Haversine puro. Evita PostGIS no MVP.

### Fase 6.2 — `browse.service.ts` ✅

54. **`modules/browse/browse.service.ts#browseFor(userId, filters)`** — query Knex única em `users` + `profiles` que **em uma passada**:
    - lê o perfil do `userId` (gender, orientation, lat, lng) — `with` clause ou subquery,
    - exclui automaticamente: self, `email_verified=false`, `profile_completed_at IS NULL`, qualquer linha em `user_swipes` onde `swiper_id = userId` (independente da decisão), pares com `blocks` em qualquer direção, e via `is_orientation_compatible(...)`,
    - aplica filtros opcionais do request: faixa etária via `birth_date`, faixa de `fame_rating`, `maxDistanceKm` via `haversine_km(...)`, overlap de `tags` via `EXISTS` em `user_tags`,
    - calcula `distance_km`, `common_tags` (subquery contando `user_tags` em comum), e o `score` ponderado:

      ```
      score = (W_DISTANCE / (distance_km + 1)) + W_TAGS * common_tags + W_FAME * fame_rating
      ```

      (`+1` no denominador evita divisão por zero quando dois perfis estão no mesmo ponto; quanto menor a distância, maior o termo.)

    - `ORDER BY score DESC, fame_rating DESC, users.id ASC` (último tiebreak garante paginação estável),
    - busca `LIMIT $limit + 1` para popular `hasMore` sem segunda query.
    - **Constantes no topo do arquivo do service**: `W_DISTANCE = 1`, `W_TAGS = 2`, `W_FAME = 0.5`. Sem env — afinar via PR.
    - Retorna `{ items: [{id, username, age, gender, sexualOrientation, bio, distanceKm, commonTags, fameRating, photoUrl}], hasMore }`. `photoUrl` é a primeira foto `ready` (por `created_at`), assinada via `presignGet` (TTL 1h) — gerada em **batch** com `Promise.all` antes de devolver.

### Fase 6.3 — `GET /browse` e `GET /search` ✅

55. **`modules/browse/browse.routes.ts`** monta dois endpoints na mesma engine:
    - **`GET /browse`** com `requireAuth` + `validate({ query: browseQuerySchema })`. Schema: `minAge`, `maxAge`, `minFame`, `maxFame`, `maxDistanceKm` (todos opcionais com bounds), `tags` (array via `?tags=a&tags=b`, cada item passa pelo `tagNameSchema` da Fase 5.5), `limit` (1-50, **default 10**), `cursor` (opaque base64 codificando `score|user_id` da última row da página anterior — pagination estável independente de novos likes do user). Resposta: `{ items, nextCursor }`.
    - **`GET /search`** — **mesma engine, mesmo schema**, mas exige `≥ 1` filtro preenchido (`refine` no schema) — sem critério → `400 SEARCH_NO_CRITERIA`. Browse é "feed", Search é "consulta dirigida" — mesma SQL, contracts distintos.

56. **Testes** em `modules/browse/tests/`:
    - `browse.service.spec.ts` — mocka `db` e cobre **cada filtro isoladamente**: já curtido sai do feed, dislike sai, bloqueado sai (ambos sentidos), orientação incompatível sai, distância fora do raio sai, score ordena correto, `hasMore=true` quando query devolve `limit+1` rows.
    - `browse.routes.spec.ts` — `supertest`: 401 sem auth, 400 com `limit > 50`, 400 `/search` sem critério, 200 com payload mockado do service.

**Checkpoint Fase 6:**

```bash
# Pré-condição: seed adicional com 6 perfis completos (verified + profile_completed_at + 1 foto + 1 tag)
# em raio de 50km do user logado, orientações variadas.

TOKEN=$(curl -sk -X POST https://localhost/api/auth/login \
  -d '{"username":"fase52","password":"Forte#2026!"}' -H ct:application/json | jq -r .accessToken)

# 1. Browse default → até 10 perfis ordenados
curl -sk https://localhost/api/browse -H "Authorization: Bearer $TOKEN" | jq '{count: (.items|length), hasMore}'

# 2. Like um → some do próximo browse
LIKED=$(curl -sk https://localhost/api/browse -H "Authorization: Bearer $TOKEN" | jq -r '.items[0].id')
curl -sk -X POST https://localhost/api/users/$LIKED/like -H "Authorization: Bearer $TOKEN"   # vem na 7.1
curl -sk https://localhost/api/browse -H "Authorization: Bearer $TOKEN" \
  | jq --arg id $LIKED '.items | map(select(.id == $id)) | length'   # 0

# 3. Dislike outro → some também
DISLIKED=$(curl -sk https://localhost/api/browse -H "Authorization: Bearer $TOKEN" | jq -r '.items[0].id')
curl -sk -X POST https://localhost/api/users/$DISLIKED/dislike -H "Authorization: Bearer $TOKEN"
curl -sk https://localhost/api/browse -H "Authorization: Bearer $TOKEN" \
  | jq --arg id $DISLIKED '.items | map(select(.id == $id)) | length'  # 0

# 4. Filtro de tags em comum reduz lista
curl -sk 'https://localhost/api/browse?tags=vegan' -H "Authorization: Bearer $TOKEN" | jq '.items | length'

# 5. /search sem critério → 400
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/api/search -H "Authorization: Bearer $TOKEN"   # 400
```

---

## Fase 7 — Visualização de perfil e ações sociais

> Objetivo: ver perfil alheio com flags de relacionamento, gravar swipe (like/dislike), detectar match mútuo, registrar visitas, bloquear, reportar. **Schema de `user_swipes` e `blocks` já existe da Fase 6.1** — esta fase dá significado social.

> **TDD aplicado:** `swipe.service` (match detection, rewind), `view.service` (perfil público + relationship), `block.service`, `report.service` — testes primeiro.

### Fase 7.1 — Swipes (like/dislike) + match detection

57. **Migration `interactions_matches`** (`npm run migrate:make -- interactions_matches`) — cria **VIEW `matches`**:
    ```sql
    CREATE VIEW matches AS
      SELECT LEAST(a.swiper_id, b.swiper_id)    AS user_a,
             GREATEST(a.swiper_id, b.swiper_id) AS user_b,
             GREATEST(a.created_at, b.created_at) AS matched_at
      FROM user_swipes a
      JOIN user_swipes b
        ON a.swiper_id = b.target_id AND a.target_id = b.swiper_id
      WHERE a.decision='like' AND b.decision='like'
        AND a.swiper_id < b.swiper_id;   -- evita duplicação simétrica
    ```
58. **Endpoints em `modules/swipe/swipe.routes.ts`** (handlers finos + `swipe.service`):
    - **`POST /users/:id/like`** — `swipeUser(actorId, targetId, 'like')`. Pré-check: `actor` tem `profile_completed_at IS NOT NULL` (5.6) — senão `400 PROFILE_INCOMPLETE`. UPSERT em `user_swipes (decision='like')`. Após gravar, consulta VIEW `matches` pra detectar mútuo. Retorna `{ status: 'matched', matchedAt }` ou `{ status: 'liked' }`. Match → stub que loga (notificação real na Fase 9).
    - **`POST /users/:id/dislike`** — `swipeUser(actorId, targetId, 'dislike')`. UPSERT `decision='dislike'`. Sem match detection. **204**.
    - **`DELETE /users/:id/like`** — DELETE em `user_swipes` (rewind/unlike). Se desfaz match (consulta VIEW antes de apagar), marca evento pra hook de chat-close da Fase 8.

### Fase 7.2 — Visualização de perfil (`GET /users/:id`)

59. **`GET /users/:id`** em `modules/user/user.routes.ts` (extensão) — perfil público (sem `email`/`password_hash`):
    - Resposta: `{ user, profile, photos, tags, relationship: { iLiked, iDisliked, likedMe, matched, blocked }, isOnline, lastActive, fameRating }`. `photos` com signed URLs TTL 1h (batch via `presignGet`).
    - `relationship` calculado com 4 `EXISTS` rápidos em `user_swipes`/`blocks`/VIEW `matches` (sem JOIN pesado).
    - **Registra entrada em `visits`** (exceto self-view) — UPSERT por par com atualização de `visited_at`. Enfileira notificação `visit` (stub Fase 9).
    - **Respeita bloqueio**: se há `blocks` em qualquer sentido entre actor e target → `404 USER_NOT_FOUND` (não revela bloqueio).
    - **Se `profile_completed_at IS NULL`** do target → `404` também (perfis incompletos não são públicos).

### Fase 7.3 — Visits, block, report

60. **Migration `visits_blocks_reports`** (`npm run migrate:make -- visits_blocks_reports`):
    - **`visits`** — `visitor_id uuid FK CASCADE`, `visited_id uuid FK CASCADE`, `visited_at timestamptz default now()`, PK `(visitor_id, visited_id)`, `CHECK (visitor_id != visited_id)`. UPSERT em cada GET → registra "última visita" sem espalhar 100 rows.
    - **`reports`** — `reporter_id uuid FK CASCADE`, `reported_id uuid FK CASCADE`, `reason varchar(32) default 'fake_account'`, `created_at`, PK `(reporter_id, reported_id)`.
    - (Tabela `blocks` já existe da Fase 6.1.)
61. **Endpoints**:
    - **`POST /users/:id/report`** — UPSERT em `reports`. Idempotente. 204.
    - **`POST /users/:id/block`** — em transação: INSERT em `blocks` + DELETE de `user_swipes` em ambos sentidos (manter swipe de alguém bloqueado é incoerente — UI não consegue ver/desfazer). 204.
    - **`DELETE /users/:id/block`** — desbloqueia. **Não restaura swipes**.

**Checkpoint Fase 7:**

```bash
# Pré-condição: dois users completos A e B (orientações compatíveis), sem swipes entre eles.

# 1. A vê perfil de B
curl -sk https://localhost/api/users/<B-id> -H "Authorization: Bearer $TOKEN_A" \
  | jq '.relationship'
# { iLiked: false, iDisliked: false, likedMe: false, matched: false, blocked: false }

# 2. A dá like em B
curl -sk -X POST https://localhost/api/users/<B-id>/like -H "Authorization: Bearer $TOKEN_A"
# { "status": "liked" }

# 3. B dá like em A → match mútuo
curl -sk -X POST https://localhost/api/users/<A-id>/like -H "Authorization: Bearer $TOKEN_B"
# { "status": "matched", "matchedAt": "..." }

# 4. A vê o perfil de B de novo → relationship.matched = true
curl -sk https://localhost/api/users/<B-id> -H "Authorization: Bearer $TOKEN_A" | jq '.relationship.matched'  # true

# 5. A bloqueia B → GET /users/<B-id> devolve 404 + swipes mútuos sumiram do user_swipes
curl -sk -X POST https://localhost/api/users/<B-id>/block -H "Authorization: Bearer $TOKEN_A"   # 204
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/api/users/<B-id> -H "Authorization: Bearer $TOKEN_A"   # 404
docker compose exec db psql -U matcha -d matcha_db -c \
  "select count(*) from user_swipes where (swiper_id=<A-id> and target_id=<B-id>) or (swiper_id=<B-id> and target_id=<A-id>);"
# 0
```

---

## Fase 8 — Chat (`/chats` + WebSocket)

> Objetivo: conversa em tempo real (≤ 10 s) entre usuários com match ativo.

> **TDD aplicado:** `messageService` (regra de envio: bloqueado/match-inativo recusa; persiste + atualiza `last_message_at`) testado isoladamente. Os handlers do Socket.IO viram thin wrappers que chamam o service. Adicional: instalar `socket.io-client` em dev para teste de integração end-to-end de WS.

**Instalar (delta da fase):** `socket.io` (runtime); `socket.io-client` (dev).

62. **Migration `messages`** (`npm run migrate:make -- messages`) — tabela `messages` (seção 7 do DOC) com `(sender_id, recipient_id)` indexado em ambos os sentidos e `read_at`.
63. **Setup do Socket.IO** anexado ao mesmo `httpServer` em `server.ts`; middleware de auth no handshake (token via query `?token=` ou header `Authorization`); rejeita conexão sem JWT válido.
64. **Mapa de presença em memória** (`userId → Set<Socket>`) + heartbeat `presence:ping` atualizando `last_seen_at` e `is_online` em `profiles`. Documentar limitação de scaling (não funciona com múltiplas réplicas — registrar no DOC como dívida).
65. **`GET /chats`** lista conversas (matches ativos) com `lastMessage` e `unreadCount`.
66. **`GET /chats/:matchId/messages?before=&limit=`** paginado por cursor; valida participação no match.
67. **`POST /chats/:matchId/messages`** (REST fallback) e evento WS `message:send` — ambos passam pelo mesmo service que persiste e emite `message:new` ao destinatário.
68. **`PATCH /chats/:matchId/read`** + evento `message:read` para echo no remetente.
69. **Typing indicators** (`typing:start/stop` → `typing`).
70. **Política de bloqueio**: service de mensagens recusa envio se houver `blocks` entre os pares ou match inativo.

**Checkpoint:** dois clientes (curl WS ou script Node) conectados como A e B em match ativo trocam mensagem em <1 s; após `POST /users/<B>/block` por A, novo `message:send` é rejeitado com `error` e a mensagem não aparece em `GET /chats/.../messages`.

---

## Fase 9 — Notificações

> Objetivo: notificações persistentes em tempo real para like, visit, message, match, unlike.

> **TDD aplicado:** `notificationService.createNotification` testado isoladamente (dedupe de 10 min, payload por tipo, mock do canal WS). Os hooks dos services das fases 7 e 8 que hoje são stubs viram chamadas reais — atualizar testes existentes.

71. **Migration `notifications`** (`npm run migrate:make -- notifications`) — tabela `notifications` da seção 7 do DOC.
72. **`services/notificationService.ts`** — `createNotification(userId, actorId, type, payload)` chamado por likes, matches, unlike, visits, messages; emite `notification:new` no Socket.IO se o destinatário tiver socket conectado. Substituir os stubs deixados nas Fases 7 e 8.
73. **`GET /notifications`** com `unreadOnly`, paginação e `unreadCount` agregado.
74. **`PATCH /notifications/:id/read`** e **`PATCH /notifications/read-all`**.
75. **Janela de dedupe** (ex.: não duplicar `visit` do mesmo `actor` em 10 minutos) — política explícita e documentada em comentário do service.

**Checkpoint:** disparar like de A → B; conectar B via WS; receber `notification:new` em menos de 10 s. `GET /notifications?unreadOnly=true` devolve a notificação; `PATCH /notifications/:id/read` zera o contador.

---

## Fase 10 — Segurança e GDPR

> Objetivo: endurecer aplicação para padrões mínimos de produção.

76. **Helmet com CSP** ajustada ao frontend; **HSTS** habilitado atrás do nginx em produção (não em dev com cert self-signed).
77. **Sanitização**: nunca confiar em IDs do cliente — sempre validar contra `req.user.id` em serviços de mutação.
78. **Rate limit global** (mais permissivo) + limites estritos em upload de fotos e endpoints de auth (já em Fase 4).
79. **`DELETE /users/me`** — apaga em cascata (likes, visits, messages, photos do bucket, tokens, profile) em transação; exige confirmação por senha no body. Para cada foto, chama `s3.delete(key)` antes do `DELETE FROM photos`.
80. **Auditoria de tokens** — hash em DB para `email_tokens`/`password_reset_tokens` (já feito em Fase 4), uso único, TTL 24h verificação / 1h reset.
81. **Logs sem PII** — nunca logar senha, refresh token cru, ou conteúdo de mensagem. Definir redactors no pino.
82. **Limpeza de fotos órfãs** (adiado da Fase 5.4) — CLI `npm run cleanup:photos` (cron em produção): seleciona linhas em `photos` com `status='pending'` e `created_at < now() - interval '1 hour'`. Faz `s3.head` em cada — se objeto existe, promove para `ready` (cliente fez `PUT` mas nunca chamou `/confirm`); se não, `DELETE FROM photos`. Mesma rotina para `status='failed'` mais velhos que 24h (registro residual). Evita drift entre bucket e tabela.

**Checkpoint:** `DELETE /users/me` remove tudo associado ao usuário; `psql` confirma ausência de registros órfãos e `mc ls minio/matcha-photos/<userId>/` retorna vazio. `npm run cleanup:photos` em um banco com linhas `pending` antigas converte/limpa corretamente. Logs da aplicação inspecionados não contêm secrets nem corpos de mensagem.

---

## Fase 11 — Qualidade e entrega

> Objetivo: cobertura agregada, CI rodando a suíte completa, documentação final. Vitest, supertest e socket.io-client já foram instalados nas Fases 3/8; a maior parte dos testes já foi escrita ao longo das Fases 4–9 via TDD — esta fase consolida e automatiza.

**Instalar (delta da fase):** avaliar `@vitest/coverage-v8` (relatório de cobertura) e, se for o caso, `testcontainers` para postgres em CI (alternativa: service container do GitHub Actions).

83. **Coverage report** — habilitar `coverage` no `vitest.config.ts` com threshold mínimo (ex.: 80% statements/branches em `src/services/`). Falha do gate de cobertura quebra o CI.
84. **CI** (GitHub Actions): `lint` → `typecheck` → `migrate` em postgres ephemeral → `npm test -- --run --coverage` em paralelo. Cache de `node_modules` por `package-lock.json` hash.
85. **README atualizado** seguindo seção 13 do [DOC.md](DOC.md): `make up`, `make health`, fluxo de testes (`npm test`, `npm test -- --coverage`), troubleshooting.
86. **Checklist final** validando cada linha da [tabela de conformidade do DOC](DOC.md#-checklist-de-conformidade-com-os-requisitos) e do [checklist do specifications](specifications.md#checklist-rápido-de-implementação).

---

**Estratégia de execução:**

- Fases **0–3** são pré-requisito — não pular nem entregar parcialmente, porque tudo daqui em diante depende de Express composto + Knex + logger/error handler.
- Fases **4 → 9** entregam features de usuário, em ordem (cada uma destrava a próxima do ponto de vista do produto).
- Fases **10–11** são cross-cutting; não deixar para o final absoluto — segurança deve subir em paralelo com cada feature (rate limit, redação de logs, etc.), e testes devem acompanhar cada fase quando o tooling estiver pronto.
