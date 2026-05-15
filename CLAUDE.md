# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Matcha is a dating-app style project with a Go (chi) RESTful + WebSocket backend, a React + Vite + TypeScript frontend, and a PostgreSQL/PostGIS database. The three services are wired together via `docker-compose.yml` at the repo root.

## Running the stack

The repo root holds the orchestration; nearly everything else lives under `app/`.

```bash
make up      # docker-compose up -d --build  (backend on :8080, frontend on :5173, postgis on :5432)
make down    # docker-compose down
```

The backend container runs `migrate -path ./migrations -database ... up && ./main` on boot (see `app/backend/Dockerfile`), so adding a new migration file in `app/backend/migrations/` and restarting the `app` container is the migration workflow — there is no separate migrate command.

Frontend Docker mounts package.json and runs `npm run dev`. For local dev outside Docker, run `npm install && npm run dev` from `app/frontend-web/`.

## Backend (Go)

Module: `github.com/jpedro-lima/Matcha`, Go 1.22.4. Layout under `app/backend/`:

- `main.go` — wires chi router, registers every route inline (no per-domain router files). Starts `handlers.CleanupUnconfirmedUsers()` in a goroutine on boot to drop unconfirmed users whose 1-minute confirmation window expired.
- `config/db.go` — single global `config.DB *sqlx.DB` initialized from `DB_*` env vars. All handlers use this global directly.
- `handlers/` — one file per domain (`auth`, `chat`, `handle_match`, `handle_moderation`, `handle_notification`, `handle_profile`). Handlers talk to `config.DB` directly; there is no service/repository layer.
- `models/` — sqlx structs matching the SQL tables.
- `utils/jwt.go` — JWT generation + `GetUserIDFromRequest` which parses `Authorization: Bearer <token>` and returns the user id. Auth is enforced per-handler by calling this helper, not via middleware.
- `migrations/` — golang-migrate up/down pairs. Schema currently spans `0001_init` (users, profiles, matches, messages + PostGIS indexes), `0002_reports_blocks` (moderation + `users.banned` column), `0003_notifications`.

Key cross-cutting things to know:

- **PostGIS is required** — `profiles.location` is `GEOGRAPHY(POINT, 4326)` and is read/written via `ST_GeogFromText('POINT(lon lat)')`. The DB image is `postgis/postgis:15-3.3`, not vanilla postgres.
- **JSONB fields on profiles** — `attributes`, `looking_for`, `profile_photos` are JSONB; handlers marshal them with `json.Marshal` then cast `$N::jsonb` in SQL.
- **WebSocket chat** — `/ws?match_id=N` upgrades to a websocket. `handlers/chat.go` keeps an in-process `map[matchID][]*websocket.Conn`; messages are persisted to `messages` and fanned out to that match's connections. State is in-memory only, so it does not survive a backend restart and won't work across multiple backend replicas.
- **Notifications** — `CreateNotification(userID, senderID, type, content)` in `handle_notification.go` is called from other handlers (e.g. chat, swipe) to insert into `notifications`.
- **CORS** — only `http://localhost:5173` is allowed; update `main.go` if the frontend origin changes.
- **JWT secret** — hardcoded to `"your_secret_key"` in `utils/jwt.go`. Treat as a known dev placeholder.
- **Auth flow quirk** — passwords are currently stored and compared in plaintext (`SELECT * FROM users WHERE email=$1 AND password=$2`); be aware before "refactoring" — it's an existing state of the codebase, not necessarily intentional design.

### Routes

All routes are registered in [app/backend/main.go](app/backend/main.go) — start there to find the handler for any endpoint. Static uploads are served from `./static/` under `/static/*`.

## Frontend (`app/frontend-web/`)

React 19 + Vite 6 + TypeScript, Tailwind v4, shadcn-style UI primitives, React Router 7, TanStack Query, react-hook-form + zod, axios.

Scripts:

```bash
npm run dev       # vite dev server on :5173
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run prettier  # prettier --write .
```

Structure under `src/`:

- `router.tsx` — central route table. Public routes (`/`, `/register`, `/sign-in`) use `HomeLayout`; authenticated app routes (`/main`, `/profile`, `/chat`, `/notifications`) use `MainLayout`.
- `api/` — one file per backend endpoint (axios calls). All requests go through `libs/axios.ts`, which reads `VITE_API_URL` and auto-attaches `Authorization: Bearer <accessToken>` from `localStorage`. JWT persistence is `localStorage.accessToken`.
- `env.ts` — zod-validated `import.meta.env`. `VITE_API_URL` is required and must be a URL; missing/invalid values throw at module load.
- `pages/` — grouped by feature (`auth`, `main`, `profile`, `chat`, `notifications`, `errors`) with shared `_layouts/`.
- `components/ui/` — shadcn primitives (configured via `components.json`); domain components live one level up in `components/`.
- `libs/react-query.ts` — shared QueryClient.

## Seeding test data

`app/scripts/seed_via_api.sh -n 30 -b http://localhost:8080` registers fake users via the HTTP API, calls the printed confirmation link to flip `confirmed=true`, then logs in and creates profiles. Requires `curl` + `jq` and the stack running.

## Manual API testing

The full auth cycle (register → confirm via logged link → login → update_password → logout) is documented as cURL commands in the root `README.md`.

## Itens faltando vs. `specifications.md` (frontend)

Snapshot do gap entre o que está implementado em [app/frontend-web/](app/frontend-web/) e o que `specifications.md` exige. Atualizar conforme as features forem entregues.

### IV.1 Registro e Login
- [ ] **Login por username** — formulário em [pages/auth/sign-in.tsx](app/frontend-web/src/pages/auth/sign-in.tsx) usa campo `email` com placeholder "Username"; spec exige login via username.
- [ ] **Validação de senhas fracas (dicionário)** — [pages/auth/register.tsx](app/frontend-web/src/pages/auth/register.tsx) só checa regex de complexidade; não bloqueia palavras de dicionário.
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
- [ ] **Tags reutilizáveis** — lista de tags em [profile-form.tsx](app/frontend-web/src/pages/profile/profile-form.tsx#L34-L90) é estática no frontend; spec pede tags reutilizáveis (criadas por usuários e reaproveitadas).
- [ ] **Até 5 fotos com designação de foto de perfil** — [pages/profile/carousel-form.tsx](app/frontend-web/src/pages/profile/carousel-form.tsx) precisa de validação de limite e seleção de foto principal explícita.
- [ ] **Consentimento GPS explícito + fallback manual** — [hooks/get-user-location.tsx](app/frontend-web/src/hooks/get-user-location.tsx) chama `geolocation` direto (sem prompt de consentimento na UI) e cai em IP automaticamente; sem input manual de cidade/bairro nem persistência no perfil.
- [ ] **Modificar localização a qualquer momento** — sem UI dedicada.

### IV.3 Navegação (Browsing)
- [ ] **Lista de perfis sugeridos** — [pages/main/main.tsx](app/frontend-web/src/pages/main/main.tsx) carrega um perfil de cada vez (`getSuggestedProfile` em [api/get-match.ts](app/frontend-web/src/api/get-match.ts)); spec pede lista ordenável/filtrável.
- [ ] **Ordenação e filtragem** (idade, localização, fame, tags em comum) — sem controles na UI.
- [ ] **Respeito a orientação sexual e bissexual default** — não há indicação visível na UI; depende do backend.
- [ ] **Tags do perfil sugerido** — `mapSuggested` em [main.tsx](app/frontend-web/src/pages/main/main.tsx#L62-L71) fixa `tags: []`; o backend não está devolvendo tags do match e a UI não exibe.

### IV.4 Pesquisa (Research)
- [ ] **Página de pesquisa avançada** — **inexistente**. Sem rota, sem componente, sem chamada API (faixa etária, faixa de fame, localização, tags).
- [ ] **Ordenação/filtragem dos resultados** — depende da página acima.

### IV.5 Visualização de Perfil
- [ ] **Página de visualização de perfil alheio** — sem rota tipo `/profile/:id`; o usuário só vê os cards do swipe em `/main`.
- [ ] **Histórico de visitas registrado por visualização** — sem trigger no frontend (não há GET de perfil de outro usuário).
- [ ] **Status online / última conexão** — não exibido em nenhuma página.
- [ ] **Sinalização "esse usuário já te curtiu / vocês estão conectados"** — não há UI dedicada.
- [ ] **Reportar conta falsa** — disponível apenas dentro de [pages/chat/chat-window.tsx](app/frontend-web/src/pages/chat/chat-window.tsx#L150) via `window.prompt`; deveria estar na view de perfil.
- [ ] **Bloquear usuário** — idem: existe só no chat, não no perfil.
- [ ] **Unlike a partir do perfil** — [api/unmatch.ts](app/frontend-web/src/api/unmatch.ts) existe, mas só é acionado pelo botão "Undo last match" do swipe.

### IV.6 Chat
- [ ] **Notificação global de nova mensagem em qualquer página** — o badge em [pages/_layouts/main.tsx](app/frontend-web/src/pages/_layouts/main.tsx#L29) cobre notificações, não mensagens; sem indicador específico de chat não lido.
- [ ] **Reconexão automática do WebSocket** — [chat-window.tsx](app/frontend-web/src/pages/chat/chat-window.tsx) não trata reconexão em caso de `onclose`/erro de rede.
- [ ] **UI de moderação fora de `window.prompt`/`alert`** — substituir prompts por dialogs (`AlertDialog`) para reportar/bloquear.

### IV.7 Notificações
- [ ] **Push em tempo real** — atualmente faz polling de 5s via React Query em [main.tsx layout](app/frontend-web/src/pages/_layouts/main.tsx#L26); aceitável dentro do limite de 10s mas seria mais robusto via WebSocket/SSE.
- [ ] **Cobertura dos 5 tipos de evento** — UI exibe genericamente `n.type`; falta diferenciação visual (ícone/cor) para like, view, message, match, unlike.
- [ ] **Acesso ao perfil/origem da notificação** — clicar em uma notificação não leva ao perfil/chat correspondente.

### Segurança
- [ ] **JWT secret e credenciais via `.env`** — `utils/jwt.go` do backend tem secret hardcoded; auditar `.env` e remover qualquer credencial commitada.
- [ ] **Senhas em plaintext no backend** — afeta o frontend porque o fluxo de reset/login depende disso. Migrar para hash antes de prosseguir.

## Itens faltando vs. `specifications.md` (backend)

Snapshot do gap entre [app/backend/](app/backend/) e `specifications.md`. Pareado com a lista do frontend acima.

### IV.1 Registro e Login
- [ ] **Login por username** — [handlers/auth.go:28-31](app/backend/handlers/auth.go#L28-L31) (`LoginRequest`) e [auth.go:126](app/backend/handlers/auth.go#L126) usam `email + password`; spec exige username.
- [ ] **Senha forte / bloqueio de dicionário** — `validator` só checa `min=8` em [auth.go:24](app/backend/handlers/auth.go#L24); sem checagem contra wordlist ou complexidade real.
- [ ] **Hash de senha** — [auth.go:62-65](app/backend/handlers/auth.go#L62-L65), [auth.go:126](app/backend/handlers/auth.go#L126), [auth.go:181](app/backend/handlers/auth.go#L181) gravam/comparam plaintext (`SELECT * FROM users WHERE email=$1 AND password=$2`). Trocar por bcrypt/argon2.
- [ ] **Envio real de e-mail** — [auth.go:73-75](app/backend/handlers/auth.go#L73-L75) só faz `fmt.Fprintf(os.Stdout, ...)`; sem SMTP/serviço transacional.
- [ ] **Janela de confirmação de 1 minuto** — `CleanupUnconfirmedUsers` em [auth.go:110-115](app/backend/handlers/auth.go#L110-L115) apaga o usuário se o link expirar; 1 minuto é curto demais para fluxo real.
- [ ] **Endpoint de "forgot password"** — não existe rota tipo `POST /password-reset` em [main.go](app/backend/main.go); só há `PATCH /update_password` (exige login).
- [ ] **JWT secret via env var** — `jwtKey = []byte("your_secret_key")` em [utils/jwt.go:11](app/backend/utils/jwt.go#L11) está hardcoded.

### IV.2 Perfil do Usuário
- [ ] **Limite de 5 fotos** — [handlers/handle_profile.go:347](app/backend/handlers/handle_profile.go#L347) (`UploadProfilePhotos`) só concatena; sem checar `len(merged) <= 5`.
- [ ] **Foto de perfil designada** — modelo armazena `profile_photos JSONB` como array; sem flag de "principal" ou índice persistido. Outras consultas assumem `->> 0` como capa.
- [ ] **Fame rating** — não há coluna nem cálculo. [profiles](app/backend/migrations/0001_init.up.sql#L17-L33) não tem `fame_rating`, e nenhum handler computa.
- [ ] **Histórico de visitas** — [handle_profile.go:474-477](app/backend/handlers/handle_profile.go#L474-L477) cria uma notificação "view" mas não persiste em uma tabela `profile_views`. Sem endpoint `GET /profiles/me/visitors`.
- [ ] **Lista de "quem me curtiu"** — não há endpoint dedicado. `matches` com `status='pending'` modela isso, mas falta rota `GET /likes/received`.
- [ ] **Edição de username/email/first_name/last_name** — não há `PATCH /users/me`; só `UpdatePassword` existe.
- [ ] **Tags reutilizáveis** — `tags VARCHAR(50)[]` em cada perfil ([0001_init.up.sql:26](app/backend/migrations/0001_init.up.sql#L26)); sem tabela `tags` + `profile_tags` normalizada que permita reutilização e contagem global.
- [ ] **Atualização de `last_active`** — coluna existe ([0001_init.up.sql:30](app/backend/migrations/0001_init.up.sql#L30)) mas nenhum handler faz `UPDATE profiles SET last_active = NOW()`. Sem isso, "online/última conexão" não funciona.
- [ ] **Status online/última conexão (IV.5)** — derivado de `last_active`; depende do item acima.
- [ ] **Validação de localização obrigatória** — [handle_profile.go:37-39](app/backend/handlers/handle_profile.go#L37-L39) cai em `POINT(0 0)` silenciosamente se vier vazio; deveria recusar perfil sem localização (GPS ou manual).

### IV.3 Navegação (Browsing)
- [ ] **Retornar lista, não um único perfil aleatório** — [handle_match.go:23-90](app/backend/handlers/handle_match.go#L23-L90) (`GetSuggestedProfile`) seleciona 10 candidatos e devolve **um** aleatório via `rand.Intn`. Spec pede lista paginada/ordenada.
- [ ] **Faixa etária respeitando preferência do usuário** — [handle_match.go:50-51](app/backend/handlers/handle_match.go#L50-L51) usa `minAge := 25; maxAge := 135` hardcoded.
- [ ] **Ranking por (1) proximidade, (2) tags em comum, (3) fame rating** — query ordena apenas por `last_active DESC`. Falta `ORDER BY distance ASC, common_tags DESC, fame DESC`.
- [ ] **Bissexual por padrão** — query exige `gender = ANY($3)` com base no array `preferred_gender` armazenado; sem fallback quando o array está vazio/nulo.
- [ ] **Filtros/ordenação por query params** — handler não lê `?min_age`, `?max_age`, `?radius_km`, `?tags=`, `?sort=`.
- [ ] **Excluir usuários banidos** — query não filtra `users.banned = FALSE`.

### IV.4 Pesquisa (Research)
- [ ] **Endpoint de pesquisa avançada** — **não existe**. Falta rota tipo `GET /search` com `min_age`, `max_age`, `min_fame`, `max_fame`, `location`, `tags`, `sort`. Nada em [main.go](app/backend/main.go#L33-L60).

### IV.5 Visualização de Perfil
- [ ] **Persistir visitas em tabela** — ver item de "histórico de visitas" acima; necessário para a feature do visualizado.
- [ ] **Indicar relacionamento com o visualizador** — `GET /profiles/{id}` em [handle_profile.go:448-481](app/backend/handlers/handle_profile.go#L448-L481) não devolve `liked_by_me`, `match_status`, `is_blocked`, `is_online`.
- [ ] **Endpoint de unlike a partir do perfil** — `POST /unmatch` existe mas exige `target_profile_id`/`target_user_id` no body; conferir se cobre o caso de "remover like ainda pendente".
- [ ] **Omitir email/senha do response** — `GET /profiles/{id}` devolve o `Profile` model (não inclui email/password); confirmar quando o handler for ampliado para incluir dados de `users`.

### IV.6 Chat
- [ ] **Auth no WebSocket** — [handlers/chat.go:30-40](app/backend/handlers/chat.go#L30-L40) não valida JWT no upgrade; só checa `sender_id` vindo do payload da mensagem ([chat.go:67-80](app/backend/handlers/chat.go#L67-L80)) — cliente pode forjar `sender_id`. Extrair via `utils.GetUserIDFromRequest` no upgrade.
- [ ] **`CheckOrigin` aberto** — [chat.go:22-26](app/backend/handlers/chat.go#L22-L26) sempre retorna `true`; permite CSRF/WS de origens arbitrárias.
- [ ] **Estado in-memory não horizontal** — `matchConnections` em [chat.go:28](app/backend/handlers/chat.go#L28) é mapa por processo; quebra com restart e múltiplas réplicas. Mover para Redis pub/sub ou similar.
- [ ] **Atualizar `last_message`/`last_message_at`** — coluna existe ([0001_init.up.sql:41-42](app/backend/migrations/0001_init.up.sql#L41-L42)) e `ListMatches` ordena por ela, mas o handler de WS nunca grava.
- [ ] **Marcar mensagens como lidas** — `messages.read` existe mas não há endpoint `POST /messages/read?match_id=`.

### IV.7 Notificações
- [ ] **Push em tempo real** — sem WebSocket/SSE de notificação. Cliente faz polling de `/notifications`. Considerar canal dedicado ou broadcast pelo mesmo WS do chat.
- [ ] **Cobertura completa dos 5 tipos** — `like`, `match`, `view`, `message`, `unlike` são criados; conferir consistência com o ícone/cor no frontend e payload extra (id do sender/perfil) para clique navegável.
- [ ] **Dedupe de 10 minutos** — [handle_notification.go:14-39](app/backend/handlers/handle_notification.go#L14-L39) ignora notificações duplicadas no intervalo; útil contra spam, mas pode descartar uma segunda visita legítima que o spec considera relevante. Validar regra.
- [ ] **Trigger de "view"** — só dispara em [handle_profile.go:474-477](app/backend/handlers/handle_profile.go#L474-L477) (`GET /profiles/{id}`); como o frontend ainda não consome essa rota (ver lista de gaps do frontend), o evento de view nunca acontece end-to-end hoje.

### Segurança / Infra
- [ ] **CORS além de localhost** — [main.go:25](app/backend/main.go#L25) só aceita `http://localhost:5173`; precisará de URL de produção.
- [ ] **Rate limiting / brute force protection** — sem middleware em `/login`, `/register`, `/reports`.
- [ ] **Middleware de auth** — auth é repetida em cada handler via `utils.GetUserIDFromRequest`; considerar `chi` middleware aplicado em sub-router protegido (também simplifica logout invalidação futura).
- [ ] **HTTPS / TLS** — `http.ListenAndServe(":8080", r)` em [main.go:62](app/backend/main.go#L62); produção precisa de proxy TLS ou `ListenAndServeTLS`.
- [ ] **Validação de upload de imagens** — [handle_profile.go:347-424](app/backend/handlers/handle_profile.go#L347-L424) aceita qualquer arquivo até 20MB; sem checar MIME/extensão (`image/*` apenas) ou tamanho por foto, e mantém o nome de extensão do cliente.
- [ ] **Logs com dados sensíveis** — [auth.go:130](app/backend/handlers/auth.go#L130) loga `password` em texto claro quando falha login; remover.
