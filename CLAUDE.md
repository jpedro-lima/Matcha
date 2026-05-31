# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Matcha is a dating-app project with a Node.js + Express + Knex API (TypeScript, ESM), a React + Vite + TypeScript frontend, and a PostgreSQL database. The stack is orchestrated via `docker-compose.yml` + an nginx TLS proxy.

> Historical note: an earlier Go (chi) backend lived in `app/backend/` and is being replaced by `app/api/`. Some frontend code still talks to the legacy contract — see [planning.md](planning.md) for the migration roadmap and [DOC.md](DOC.md) for the new API contract.

## Running the stack

```bash
make up         # docker compose up -d --build  → db, minio, api, nginx
make down       # docker compose down            (volumes kept)
make restart    # restart all services
make logs       # tail all services
make health     # curl -sk https://localhost/api/health
make access-db  # psql inside the db container
make nuke       # full reset incl. volumes (destructive — wipes DB + uploads)
```

Nginx serves TLS on `https://localhost` and proxies `/api/` → api container `:3000`. Self-signed cert is generated on first boot by `nginx/gen-certs.sh`.

**Photo bytes do NOT go through nginx.** MinIO is exposed directly on `localhost:9000` (host) / `minio:9000` (docker network). Clients hit MinIO with signed URLs emitted by the API — nginx only routes `/api/` and `/ws/`. See "Object storage" below.

After editing `.env`, run `docker compose up -d --force-recreate api` — `docker compose restart` does **not** re-read `.env` (env is fixed at container creation, not at process start).

## API (`app/api/`)

Node 20 + Express + Knex + TypeScript ESM. **Feature-based layout** under `src/`:

```
src/
├── app.ts / server.ts          ← Express composition + listen/graceful shutdown
├── config/                     ← env (zod-validated), db (singleton Knex), logger (pino)
├── middlewares/                ← validate, require-auth, error-handler, http-logger, rate-limit
├── utils/                      ← AppError ({ code, status, message, details? })
├── common/                     ← infra compartilhada entre módulos (layer-based: services/types/schemas)
│   ├── services/
│   │   ├── email.service.ts    ← Nodemailer wrapper (gated by SMTP_DISABLED)
│   │   ├── jwt.service.ts      ← sign/verify access + refresh
│   │   ├── bcrypt.service.ts   ← hashPassword / verifyPassword
│   │   ├── token.service.ts    ← email_tokens + password_reset_tokens (one-shot, hashed)
│   │   ├── s3.service.ts       ← MinIO/S3: dual clients (internal + signing) + presignPut/presignGet/head/getRange/deleteObject
│   │   └── completeness.service.ts ← recalculateCompleteness(userId, trx?) — hook one-way de perfil completo
│   ├── types/
│   │   ├── user.types.ts       ← UserRow, PublicUser, publicUserFromRow
│   │   ├── profile.types.ts    ← ProfileRow, Profile, profileFromRow (snake→camel)
│   │   ├── jwt.types.ts        ← AccessPayload, RefreshPayload
│   │   └── auth-token.types.ts ← AuthTokenRow
│   └── schemas/
│       ├── password.schema.ts  ← passwordSchema (Zod regex shared by auth)
│       └── profile.schemas.ts  ← genderSchema, sexualOrientationSchema (enums reutilizáveis)
├── database/                   ← knexfile, migrations, seeds (knex CLI from host)
└── modules/
    ├── routes.ts               ← agregador (ORDEM IMPORTA: rotas específicas antes das genéricas)
    ├── auth/                   ← register/login/refresh/verify/forgot/reset
    ├── user/                   ← GET/PATCH /users/me + PATCH /users/me/location
    ├── photo/                  ← presign + confirm + delete + list (acesso via signed URL)
    ├── tag/                    ← GET/PUT /users/me/tags + GET /tags?query=
    └── health/
```

Cada módulo segue o mesmo layout: `<dominio>.handlers.ts`, `<dominio>.routes.ts`, `<dominio>.service.ts`, `<dominio>.schemas.ts`, `<dominio>.types.ts`, `tests/<dominio>.service.spec.ts` + `tests/<dominio>.routes.spec.ts`.

### Key conventions

- **Feature-based modules + layer-based common.** Cada domínio é uma pasta `src/modules/<dominio>/` (handlers, routes, service, schemas, types, tests). Cross-cutting (usado por múltiplos módulos) vive em `src/common/` organizado por **camada** (`services/`, `types/`, `schemas/`) — primitivas independentes encaixam melhor em layer-based que em concern-based.
- **Naming dentro de módulo: `<dominio>.<papel>.ts`** — `auth.handlers.ts`, `auth.routes.ts`, `auth.service.ts`, `auth.schemas.ts`, `auth.types.ts`. Em `common/` o nome ainda é `<nome>.<papel>.ts` mas papéis ficam em pastas separadas (`services/email.service.ts`, `types/user.types.ts`, `schemas/password.schema.ts`). O sufixo pontuado deixa editor tabs / grep / stack traces auto-explicativos.
- **Quase sem testes em `common/`.** Os services em `common/` são wrappers finos sobre libs npm (bcrypt, jsonwebtoken, nodemailer). A cobertura real é feita pelos módulos que os consomem. **Exceção deliberada:** `src/common/tests/<wrapper>.spec.ts` recebe invariantes críticas que nenhum outro nível pega (e.g. [common/tests/jwt.spec.ts](app/api/src/common/tests/jwt.spec.ts) garante que access ≠ refresh — os specs de auth mockam jwt-service e perderiam essa invariante). Um arquivo por wrapper, não centralizar. Critério pra entrar: invariante de segurança + falha silenciosa + sem cobertura em outro lugar.
- **Aggregator pattern + ordering.** `src/modules/routes.ts` importa cada `<dominio>Routes` e monta com prefixo. `app.ts` faz apenas `app.use(routes)`. **Ordem importa**: rotas específicas antes das genéricas — `routes.use('/users/me/photos', photoRoutes)` vem **antes** de `routes.use('/users', userRoutes)`, senão Express casa o handler mais largo primeiro.
- **Separação handlers × routes × service.** Handlers (`*.handlers.ts`) são `RequestHandler` puros — sem `Router`. Routes (`*.routes.ts`) é o catálogo: linha por endpoint, `método + path + middlewares + handler`. Service (`*.service.ts`) é onde Knex/SQL vive.
- **Handlers nunca tocam Knex.** Se um handler importa `db`, é bug — sobe a query pro service.
- **Code style: tabs, no semicolons, ESM** — `"type": "module"` em `package.json`, `tsconfig` com `module/moduleResolution: nodenext`. Nunca use `ignoreDeprecations`.
- **Strings em inglês** — `AppError` messages, response bodies, Zod messages, email subjects/bodies, Vitest descriptions. Comentários `//` podem ficar em PT.
- **Password policy em UM lugar** — `common/password.schema.ts` (Zod regex: ≥ 8 chars + letter + number + symbol). Sem zxcvbn, sem service de dicionário. O middleware `validate` reprova senha fraca na fronteira como `400 VALIDATION_ERROR`.
- **Zod 4 UUID = strict (variant nibble).** `z.uuid()` rejeita placeholders fake tipo `11111111-1111-1111-1111-111111111111` porque o 13º char (variant) precisa ser 8/9/a/b. Em testes, gerar UUID v4 real (`randomUUID()` ou hardcoded válido tipo `4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21`).
- **Schemas como fonte de verdade.** Tipos vêm de `z.infer<typeof xxxSchema>` no arquivo `<dominio>.schemas.ts` — `<dominio>.types.ts` só guarda DTOs internos que não saem por validação (e.g. `LoginResult`, `UserWithProfile`). **Não duplicar** os campos do schema em uma `type X = { ... }` paralela.

### Migrations workflow

Always run from the **host** (not the container) using the `app/api/` scripts:

```bash
cd app/api
npm run migrate:make -- <name_in_snake_case>   # creates YYYYMMDDHHMMSS_<name>.ts in src/database/migrations/
npm run migrate                                 # applies pending migrations
npm run migrate:rollback                        # rolls back last batch
```

Every migration must have a working `up` **and** `down`. Migrations are added just-in-time per phase in `planning.md`, not pre-built.

### Testing

Vitest, **100% mocks** — no real DB in tests, no global setup, no test database. Each spec uses `vi.mock(...)` for collaborators (`db`, `email-service`, `jwt-service`, etc.). Specs co-located under `src/**/tests/*.spec.ts`.

```bash
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```

Mocking `db` pattern (see [auth.service.spec.ts](app/api/src/modules/auth/tests/auth.service.spec.ts)): `dbBuilder` mocks the query-builder chain (`where`/`first`/`insert`/`returning`/`update`); `dbMock = vi.fn(() => dbBuilder)`; `dbMock.transaction` is mocked to invoke the callback with `dbMock` as `trx`, so transactional code paths share the same builder.

HTTP integration specs live as `<domain>.routes.spec.ts` next to the routes file (under `<module>/tests/`) and use `supertest(app)` against the real Express composition, mocking only the service layer (`vi.mock('../auth.service.js', ...)`). See [auth.routes.spec.ts](app/api/src/modules/auth/tests/auth.routes.spec.ts).

### Auth (Phase 4.3)

Endpoints in [modules/auth/auth.routes.ts](app/api/src/modules/auth/auth.routes.ts) (handlers in [auth.handlers.ts](app/api/src/modules/auth/auth.handlers.ts), business in [auth.service.ts](app/api/src/modules/auth/auth.service.ts)):

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | 201 if email dispatched; 202 if SMTP failed (user + token persisted; client should call resend) |
| POST | `/auth/resend-verification` | Always 200 neutral (anti-enumeration). Silent on missing/verified users; logs SMTP errors |
| GET  | `/auth/verify-email/:token` | Consumes token, sets `email_verified=true` |
| POST | `/auth/login` | Username + password. Sets `matcha_refresh` httpOnly cookie + returns `accessToken` in body |
| POST | `/auth/refresh` | Reads cookie, rotates tokens |
| POST | `/auth/logout` | Clears cookie, 204 |
| POST | `/auth/forgot-password` | Always 200 |
| POST | `/auth/reset-password` | Token from email + new password (Zod-validated) |
| GET  | `/auth/me` | `requireAuth` → returns `{ id, username, email, emailVerified }` |

`register` puts `users.insert` + `issueEmailToken` in a single `db.transaction`; `sendVerificationEmail` runs **outside** the transaction. If SMTP fails the transaction has already committed (no orphans), the error is logged, and the response carries `emailSent: false` → 202.

### User profile (Phase 5.2 + 5.3)

Endpoints in [modules/user/user.routes.ts](app/api/src/modules/user/user.routes.ts):

| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | `requireAuth` → `{ user, profile }` (joins `users` + `profiles`) |
| PATCH | `/users/me` | Edita `firstName`, `lastName`, `email`, `bio`, `gender`, `sexualOrientation`, `birthDate`. Mudança de `email` é transacional: re-baixa `email_verified=false`, deleta tokens antigos, emite novo, dispara verificação (falha SMTP só loga) |
| PATCH | `/users/me/location` | Body é `z.discriminatedUnion('consent', …).strict()` em cada variante: `{ consent: true, latitude, longitude }` **ou** `{ consent: false, city, neighborhood }`. Service zera os campos opostos ao gravar — sem ambiguidade no DB |

`profiles` é 1:1 com `users` (PK = FK CASCADE). Linha criada na **mesma transação** do `auth.service.register`. Trigger `set_updated_at()` (definida na migration `users`) é reaproveitada — `profiles_set_updated_at` referencia a mesma função.

### Photos (Phase 5.4)

Endpoints in [modules/photo/photo.routes.ts](app/api/src/modules/photo/photo.routes.ts) (mounted at `/users/me/photos` no aggregator):

| Method | Path | Notes |
|---|---|---|
| GET | `/users/me/photos` | Lista fotos do user (excluindo `failed`); cada item recebe uma **signed GET URL** TTL 1h |
| POST | `/users/me/photos/presign` | Body `{ contentType, size }`. Valida MIME ∈ {jpeg,png,webp}, size ≤ 5MB, máximo 5 fotos ativas (`pending`+`ready`). Insere row `status='pending'` + retorna `{ photoId, uploadUrl, expiresAt }` (PUT TTL 5min) |
| POST | `/users/me/photos/:id/confirm` | Valida HEAD + content-length/type + magic bytes (`file-type` nos primeiros 32B). Falha → `status='failed'` + `s3.delete` + 400/404. Sucesso → `status='ready'` + retorna signed GET URL |
| DELETE | `/users/me/photos/:id` | Apaga row + `s3.delete` |

**Fluxo 3-passos** (API nunca recebe os bytes):
1. Frontend `POST /presign` → recebe URL pré-assinada
2. Frontend `PUT` direto no MinIO → 200
3. Frontend `POST /:id/confirm` → API valida e marca ready

**Error codes:** `PHOTO_LIMIT_REACHED` (400), `PHOTO_NOT_FOUND` (404), `PHOTO_NOT_UPLOADED` (404 — declarou no presign, mas nunca subiu), `INVALID_FILE_TYPE` (400 — magic bytes não batem com MIME declarado).

> **Não existe `is_profile` / foto principal.** Foi decisão explícita na 5.4: spec menciona até 5 fotos mas sem distinção de "principal" no backend; UI escolhe a primeira por `created_at`.

### Tags (Phase 5.5)

Endpoints in [modules/tag/tag.routes.ts](app/api/src/modules/tag/tag.routes.ts) — exporta **dois routers** porque os endpoints têm prefixos distintos:

| Method | Path | Notes |
|---|---|---|
| GET | `/users/me/tags` | `requireAuth` → `{ tags: [{ id, name }] }` (alfabético) |
| PUT | `/users/me/tags` | Body `{ tags: string[] }` (max 20). Schema normaliza cada tag: `trim + strip '#' + lowercase + regex /^[a-z0-9-]+$/`. Service deduplica, faz `INSERT ... ON CONFLICT DO NOTHING` em `tags`, apaga vínculos antigos e cria os novos em **uma transação**. |
| GET | `/tags?query=…` | `requireAuth` + `validate({ query })` — autocomplete. LIKE prefix; `ORDER BY count(user_tags) DESC, name ASC`; `LIMIT 20`. Query schema só aceita `[a-z0-9-]+` (mesma normalização) — bloqueia wildcards `%`/`_` do SQL. |

**Detalhes-chave:**

- **Mount order em `routes.ts`**: `/users/me/tags` (específico) **antes** de `/users` (genérico), idem pra photos.
- **`tag.schemas.ts` faz double-validation**: `z.string().trim().transform(s => s.replace(/^#+/, '').toLowerCase()).pipe(z.string().regex(/^[a-z0-9-]+$/))`. O `.pipe(...)` valida o resultado **depois** do transform — se o usuário enviar `"hello world"`, o regex falha na fase 2.
- **`req.query` em Express 5 é getter readonly** — `Object.assign` é silenciosamente ignorado. O middleware `validate` usa `Object.defineProperty(req, 'query', { value: parsed.data, ... })` pra entregar o valor transformado ao handler. Sem isso, autocomplete recebe `MU` em vez de `mu`.

### Profile completeness hook (Phase 5.6)

`common/services/completeness.service.ts#recalculateCompleteness(userId, executor?)` é chamado por **todo mutator de sinal de perfil**:

| Consumer | Quando | Modo |
|---|---|---|
| `user.service#updateUser` | depois da transação que faz update + (opcional) issue de novo email token | sem executor (lê snapshot pós-commit) |
| `user.service#updateLocation` | depois do `UPDATE profiles` | sem executor |
| `photo.service#confirmPhoto` | depois de marcar `status='ready'` | sem executor |
| `tag.service#replaceUserTags` | **dentro** da transação (precisa enxergar os `user_tags` recém-criados) | `executor = trx` |

**Sinais obrigatórios** (todos têm que estar presentes pra marcar):
- `profiles.bio`, `profiles.gender`, `profiles.sexual_orientation`, `profiles.birth_date`
- `profiles.location_consent ≠ null` (cobre tanto GPS `true` quanto manual `false`)
- `count(photos where status='ready') ≥ 1`
- `count(user_tags) ≥ 1`

**Semântica one-way**: se `profile_completed_at` já estava preenchido, o hook é no-op. Decisão deliberada — não regredimos o timestamp pra evitar UX confusa de "perfil deixou de estar completo" quando o user edita algo. (Se a UX exigir badge "rascunho", calcular sob demanda; o timestamp persistido fica como "primeiro momento que ficou completo".)

**Pattern de executor opcional** segue o de `issueEmailToken(userId, executor?)` — `executor: Knex | Knex.Transaction = defaultDb`. Permite participar de transações ou rodar standalone sem duplicar lógica.

**Testing pattern para consumers**: mockar o módulo com `vi.mock('../../../common/services/completeness.service.js', () => ({ recalculateCompleteness: vi.fn() }))`. A cobertura real do hook fica em [common/tests/completeness.spec.ts](app/api/src/common/tests/completeness.spec.ts) — invariante de domínio + ramificações de early-return, exatamente o critério de quando vale um spec dedicado em `common/tests/`.

### Object storage (MinIO + signed URLs)

Bucket `matcha-photos` é **privado** (init.sh força `mc anonymous set none`). Acesso só via signed URLs emitidas pela API. **Nginx não proxia `/uploads/`** (removido na 5.4) — o navegador conecta direto no MinIO público.

`common/services/s3.service.ts` mantém **dois S3Clients**:

| Client | Endpoint | Usado para |
|---|---|---|
| `internalClient` | `S3_ENDPOINT` (e.g. `http://minio:9000`) | `head`, `deleteObject`, `getRange` — operações server-side dentro do docker |
| `signingClient` | `S3_PUBLIC_URL` (e.g. `http://localhost:9000`) | `presignPut`, `presignGet` — URLs que o **cliente** vai usar; o host na URL precisa ser alcançável de fora do docker |

TTLs hard-coded: `PUT_TTL_SECONDS = 5*60`, `GET_TTL_SECONDS = 60*60`. Frontend deve usar `staleTime < 1h` no TanStack Query pra renovar URLs antes do 403.

**Gotchas conhecidas:**

- **`requestChecksumCalculation: 'WHEN_REQUIRED'`** em ambos os clients. Sem isso, AWS SDK v3 (Jan/26+) embute CRC32 na URL presigned; MinIO recusa porque o cliente HTTP comum (browser, curl) não recalcula esse header → `SignatureDoesNotMatch`.
- **`MINIO_ROOT_PASSWORD` ≡ `S3_SECRET_KEY`.** Têm que ser bytes idênticos no `.env`, senão tudo dá `SignatureDoesNotMatch`. Mesmo critério para `MINIO_ROOT_USER` ≡ `S3_ACCESS_KEY`.
- **`head()` trata 403 como 404.** MinIO devolve 403 (sem detail) para HEAD em objeto ausente em alguns cenários — o wrapper retorna `null` em ambos.
- **`photoFromRow(row, url)` é puro.** A URL é gerada pelo service via `presignGet` (potencialmente em batch com `Promise.all`) e injetada no mapper. Isso mantém `photo.types.ts` livre de I/O e sem dep em `s3.service`.
- **Tampering é grátis de detectar.** Alterar `X-Amz-Expires`, key, qualquer query param → MinIO recalcula HMAC → `403 SignatureDoesNotMatch`. Não precisa validar TTL no servidor; é input do hash.

### Dev SMTP escape: `SMTP_DISABLED`

`SMTP_DISABLED=true` in `.env` makes `common/email.service.ts#send()` **log the email body (with the verification URL containing the raw token) instead of calling SMTP**. Useful when you don't have a verified Resend domain yet.

Flow with `SMTP_DISABLED=true`:
1. `POST /auth/register` → 201, user + token row in `email_tokens`
2. The raw token only exists in the log line `"SMTP_DISABLED: email NOT sent (dev)"` — grep `docker compose logs api` for the URL
3. Copy the URL → `curl -sk https://localhost/api/auth/verify-email/<raw-token>`

Note: the parsed env uses `z.stringbool()` (Zod 4), which correctly handles `"true"`/`"false"` strings — do **not** swap it for `z.coerce.boolean()` (any non-empty string would coerce to `true`, including `"false"`).

### Common gotchas

- **`.env` changes require `--force-recreate`**, not `restart` (see "Running the stack").
- **Resend "from" rules** — only `onboarding@resend.dev` works without a verified domain, and it only delivers to the account owner's email. Anything else needs a verified domain on the Resend dashboard.
- **Token consumption is irreversible** — `/auth/verify-email/:token` is `GET` and mutates state. Any link-prefetcher (corporate Outlook scanners, browser prefetch) that hits the URL burns the token. If this becomes a problem in production, move to `POST /auth/verify-email` with the token in the body.
- **Knex transactions and helpers** — `common/token.service.ts#issueEmailToken(userId, executor?)` accepts an optional `Knex | Knex.Transaction`. Pass the `trx` when calling from inside `db.transaction(...)`; otherwise it falls back to the global `db`.
- **S3_PUBLIC_URL semantics** — não é "URL onde a API serve fotos". É "URL via qual o **cliente** vai falar com o storage". Em dev, `http://localhost:9000` (host port do MinIO). Em prod, hostname público do bucket/CDN. Mudar essa env exige `--force-recreate api` porque é lida na construção do `signingClient`.
- **Orphan photos (pending sem upload).** Se o cliente chamar `/presign` mas nunca fizer `PUT`+`/confirm`, a row fica `status='pending'` ocupando uma das 5 vagas do limite. Cleanup automático **adiado pra Fase 10** (`npm run cleanup:photos`). Em dev, limpar com `delete from photos where status='pending'` se bater no limite por causa de testes interrompidos.

## Frontend (`app/frontend-web/`)

React 19 + Vite 6 + TypeScript, Tailwind v4, shadcn-style UI, React Router 7, TanStack Query, react-hook-form + zod, axios.

```bash
cd app/frontend-web
npm run dev       # vite dev server on :5173
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run prettier  # prettier --write .
```

Structure under `src/`:

- `router.tsx` — central route table. Public routes (`/`, `/register`, `/sign-in`) use `HomeLayout`; authenticated routes (`/main`, `/profile`, `/chat`, `/notifications`) use `MainLayout`.
- `api/` — one file per backend endpoint via axios. All requests go through `libs/axios.ts`, which reads `VITE_API_URL` and auto-attaches `Authorization: Bearer <accessToken>` from `localStorage.accessToken`.
- `env.ts` — zod-validated `import.meta.env`. `VITE_API_URL` required, must parse as URL.
- `pages/` — grouped by feature (`auth`, `main`, `profile`, `chat`, `notifications`, `errors`) with shared `_layouts/`.
- `components/ui/` — shadcn primitives (configured via `components.json`); domain components live one level up in `components/`.
- `libs/react-query.ts` — shared QueryClient.

> The frontend still targets the **legacy Go API contract** (e.g. `email` + `password` login, no refresh-cookie flow). Migration to the new `app/api/` contract is pending — see the IV.x gaps below.

## Specs and planning

- [planning.md](planning.md) — phased rebuild of the API. Each phase has a checkpoint script that proves the work end-to-end. Current state: **Phases 4 (Auth) e 5 inteira (MinIO, profile, location, photos, tags, completude) complete**; próxima é Fase 6 (Browse/Search).
- [DOC.md](DOC.md) — target API contract (routes, payloads, error envelope, schema).
- [specifications.md](specifications.md) — product requirements (the 42 spec) the project must satisfy.

## Frontend gaps vs. `specifications.md`

> Snapshot of what's missing in [app/frontend-web/](app/frontend-web/). Backend endpoint references here describe the legacy Go contract; the equivalent in the new API will live under `app/api/src/routes/`. Update as features land.

### IV.1 Registro e Login
- [ ] **Login por username** — formulário em [pages/auth/sign-in.tsx](app/frontend-web/src/pages/auth/sign-in.tsx) usa campo `email` com placeholder "Username"; spec exige login via username.
- [ ] **Confirmação de senha** — campo `validatePassword` existe mas o schema zod não valida igualdade.
- [ ] **Fluxo de reset de senha funcional** — [pages/auth/reset-password.tsx](app/frontend-web/src/pages/auth/reset-password.tsx) é só UI; sem `onSubmit`, sem chamada de API, sem tela de "nova senha" a partir do link do e-mail.
- [ ] **Logout em qualquer página** — implementado dentro de `MainLayout`, mas o header público em [components/header.tsx](app/frontend-web/src/components/header.tsx) não tem logout para sessões que caiam em rotas públicas.
- [ ] **Verificação de e-mail (UI)** — sem página/feedback que confirme conta a partir do link único.

### IV.2 Perfil do Usuário
- [ ] **Data de nascimento** — [pages/profile/profile-form.tsx](app/frontend-web/src/pages/profile/profile-form.tsx) envia `birth_date: '1990-01-01'` fixo; sem date picker.
- [ ] **Atributos / "looking for"** — também enviados hardcoded (`height: '180cm'`, `occupation`, `relationship_type`, etc.).
- [ ] **Fame rating real** — [pages/profile/profile.tsx](app/frontend-web/src/pages/profile/profile.tsx#L52) exibe valor fixo `325`.
- [ ] **Quem visualizou meu perfil** — sem UI/rota para o histórico de visitas.
- [ ] **Quem curtiu meu perfil** — sem UI para a lista de likes recebidos.
- [ ] **Editar nome, sobrenome, e-mail, senha** — formulário de perfil só salva bio/gênero/tags/fotos; sem fluxo de edição dos campos do usuário.
- [ ] **Tags reutilizáveis** — lista de tags em [profile-form.tsx](app/frontend-web/src/pages/profile/profile-form.tsx#L34-L90) é estática no frontend; spec pede tags reutilizáveis.
- [ ] **Até 5 fotos com designação de foto de perfil** — [pages/profile/carousel-form.tsx](app/frontend-web/src/pages/profile/carousel-form.tsx) precisa de validação de limite e seleção de foto principal explícita.
- [ ] **Consentimento GPS explícito + fallback manual** — [hooks/get-user-location.tsx](app/frontend-web/src/hooks/get-user-location.tsx) chama `geolocation` direto (sem prompt de consentimento) e cai em IP automaticamente; sem input manual nem persistência no perfil.
- [ ] **Modificar localização a qualquer momento** — sem UI dedicada.

### IV.3 Navegação (Browsing)
- [ ] **Lista de perfis sugeridos** — [pages/main/main.tsx](app/frontend-web/src/pages/main/main.tsx) carrega um perfil de cada vez; spec pede lista ordenável/filtrável.
- [ ] **Ordenação e filtragem** (idade, localização, fame, tags em comum) — sem controles na UI.
- [ ] **Respeito a orientação sexual e bissexual default** — não há indicação visível na UI.
- [ ] **Tags do perfil sugerido** — `mapSuggested` em [main.tsx](app/frontend-web/src/pages/main/main.tsx#L62-L71) fixa `tags: []`.

### IV.4 Pesquisa (Research)
- [ ] **Página de pesquisa avançada** — **inexistente** (sem rota, sem componente).
- [ ] **Ordenação/filtragem dos resultados** — depende da página acima.

### IV.5 Visualização de Perfil
- [ ] **Página de visualização de perfil alheio** — sem rota tipo `/profile/:id`.
- [ ] **Histórico de visitas registrado por visualização** — sem trigger no frontend.
- [ ] **Status online / última conexão** — não exibido em nenhuma página.
- [ ] **Sinalização "esse usuário já te curtiu / vocês estão conectados"** — não há UI dedicada.
- [ ] **Reportar conta falsa** — disponível apenas dentro de [pages/chat/chat-window.tsx](app/frontend-web/src/pages/chat/chat-window.tsx#L150) via `window.prompt`; deveria estar na view de perfil.
- [ ] **Bloquear usuário** — idem: existe só no chat, não no perfil.
- [ ] **Unlike a partir do perfil** — [api/unmatch.ts](app/frontend-web/src/api/unmatch.ts) existe, mas só é acionado pelo botão "Undo last match" do swipe.

### IV.6 Chat
- [ ] **Notificação global de nova mensagem em qualquer página** — o badge em [pages/_layouts/main.tsx](app/frontend-web/src/pages/_layouts/main.tsx#L29) cobre notificações, não mensagens.
- [ ] **Reconexão automática do WebSocket** — [chat-window.tsx](app/frontend-web/src/pages/chat/chat-window.tsx) não trata `onclose`/erro de rede.
- [ ] **UI de moderação fora de `window.prompt`/`alert`** — substituir prompts por dialogs (`AlertDialog`) para reportar/bloquear.

### IV.7 Notificações
- [ ] **Push em tempo real** — atualmente polling de 5s via React Query; aceitável dentro do limite de 10s mas seria mais robusto via WebSocket/SSE.
- [ ] **Cobertura visual dos 5 tipos** — UI exibe genericamente `n.type`; falta diferenciação de ícone/cor para like, view, message, match, unlike.
- [ ] **Acesso ao perfil/origem da notificação** — clicar não leva ao perfil/chat correspondente.

> Backend gaps tracking moved to [planning.md](planning.md). Each phase there defines the slice of `specifications.md` it closes, plus a manual checkpoint to verify it.
