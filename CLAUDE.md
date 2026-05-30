# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Matcha is a dating-app project with a Node.js + Express + Knex API (TypeScript, ESM), a React + Vite + TypeScript frontend, and a PostgreSQL database. The stack is orchestrated via `docker-compose.yml` + an nginx TLS proxy.

> Historical note: an earlier Go (chi) backend lived in `app/backend/` and is being replaced by `app/api/`. Some frontend code still talks to the legacy contract — see [planning.md](planning.md) for the migration roadmap and [DOC.md](DOC.md) for the new API contract.

## Running the stack

```bash
make up         # docker compose up -d --build  → db, api, nginx
make down       # docker compose down            (volumes kept)
make restart    # restart all services
make logs       # tail all services
make health     # curl -sk https://localhost/api/health
make access-db  # psql inside the db container
make nuke       # full reset incl. volumes (destructive — wipes DB + uploads)
```

Nginx serves TLS on `https://localhost` and proxies `/api/` → api container `:3000`. Self-signed cert is generated on first boot by `nginx/gen-certs.sh`.

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
│   │   └── token.service.ts    ← email_tokens + password_reset_tokens (one-shot, hashed)
│   ├── types/
│   │   ├── user.types.ts       ← UserRow, PublicUser, publicUserFromRow
│   │   ├── jwt.types.ts        ← AccessPayload, RefreshPayload
│   │   └── auth-token.types.ts ← AuthTokenRow
│   └── schemas/
│       └── password.schema.ts  ← passwordSchema (Zod regex shared by auth)
├── database/                   ← knexfile, migrations, seeds (knex CLI from host)
└── modules/
    ├── routes.ts               ← agregador: routes.use('/auth', authRoutes); app.use(routes)
    ├── auth/
    │   ├── auth.handlers.ts    ← RequestHandlers puros (sem Router)
    │   ├── auth.routes.ts      ← Router amarrando handlers + middlewares (catálogo do domínio)
    │   ├── auth.service.ts     ← regra de negócio + I/O via knex
    │   ├── auth.schemas.ts     ← Zod schemas + types inferidos (RegisterBody, etc.)
    │   ├── auth.types.ts       ← DTOs (RegisterInput, LoginResult, RegisterResult)
    │   └── tests/
    │       ├── auth.service.spec.ts   ← unit (mocka colaboradores)
    │       └── auth.routes.spec.ts    ← integração via supertest
    └── health/
        ├── health.handlers.ts
        └── health.routes.ts
```

### Key conventions

- **Feature-based modules + layer-based common.** Cada domínio é uma pasta `src/modules/<dominio>/` (handlers, routes, service, schemas, types, tests). Cross-cutting (usado por múltiplos módulos) vive em `src/common/` organizado por **camada** (`services/`, `types/`, `schemas/`) — primitivas independentes encaixam melhor em layer-based que em concern-based.
- **Naming dentro de módulo: `<dominio>.<papel>.ts`** — `auth.handlers.ts`, `auth.routes.ts`, `auth.service.ts`, `auth.schemas.ts`, `auth.types.ts`. Em `common/` o nome ainda é `<nome>.<papel>.ts` mas papéis ficam em pastas separadas (`services/email.service.ts`, `types/user.types.ts`, `schemas/password.schema.ts`). O sufixo pontuado deixa editor tabs / grep / stack traces auto-explicativos.
- **Quase sem testes em `common/`.** Os services em `common/` são wrappers finos sobre libs npm (bcrypt, jsonwebtoken, nodemailer). A cobertura real é feita pelos módulos que os consomem. **Exceção deliberada:** `src/common/tests/<wrapper>.spec.ts` recebe invariantes críticas que nenhum outro nível pega (e.g. [common/tests/jwt.spec.ts](app/api/src/common/tests/jwt.spec.ts) garante que access ≠ refresh — os specs de auth mockam jwt-service e perderiam essa invariante). Um arquivo por wrapper, não centralizar. Critério pra entrar: invariante de segurança + falha silenciosa + sem cobertura em outro lugar.
- **Aggregator pattern.** `src/modules/routes.ts` importa cada `<dominio>Routes` e monta com prefixo. `app.ts` faz apenas `app.use(routes)`. Adicionar módulo novo = uma linha em `routes.ts`, sem tocar `app.ts`.
- **Separação handlers × routes × service.** Handlers (`*.handlers.ts`) são `RequestHandler` puros — sem `Router`. Routes (`*.routes.ts`) é o catálogo: linha por endpoint, `método + path + middlewares + handler`. Service (`*.service.ts`) é onde Knex/SQL vive.
- **Handlers nunca tocam Knex.** Se um handler importa `db`, é bug — sobe a query pro service.
- **Code style: tabs, no semicolons, ESM** — `"type": "module"` em `package.json`, `tsconfig` com `module/moduleResolution: nodenext`. Nunca use `ignoreDeprecations`.
- **Strings em inglês** — `AppError` messages, response bodies, Zod messages, email subjects/bodies, Vitest descriptions. Comentários `//` podem ficar em PT.
- **Password policy em UM lugar** — `common/password.schema.ts` (Zod regex: ≥ 8 chars + letter + number + symbol). Sem zxcvbn, sem service de dicionário. O middleware `validate` reprova senha fraca na fronteira como `400 VALIDATION_ERROR`.

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

- [planning.md](planning.md) — phased rebuild of the API. Each phase has a checkpoint script that proves the work end-to-end. Current state: **Phase 4 (Auth) complete**; Phase 5 (profile, photos, tags, location) is next.
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
