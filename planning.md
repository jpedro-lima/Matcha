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

## Fase 5 — Perfil (`/users/me`, fotos, tags, localização)

> Objetivo: usuário consegue completar perfil, subir/excluir/promover fotos, gerenciar tags reutilizáveis e atualizar localização (com consentimento ou manual).

> **TDD aplicado a cada service** desta fase (`profileService`, `photoService`, `tagService`, `locationService`): teste primeiro, implementação depois. Controllers são adapters HTTP — testar via `supertest` quando tiver lógica não trivial (ex.: validação de tipo de arquivo).

**Instalar (delta da fase):** `multer` + `@types/multer`, `sharp`, `file-type` (detecção por magic bytes).

41. **Migration `profiles`** (`npm run migrate:make -- profiles`) — tabela `profiles` 1:1 com `users` (PK = FK CASCADE), todos os campos da seção 7 do DOC; CHECKs `gender`, `sexual_orientation`, `birth_date <= now - 18 years`; índices `(gender, sexual_orientation)`, `(latitude, longitude)`, `fame_rating DESC`.
42. **Migration `photos_tags`** (`npm run migrate:make -- photos_tags`) — `photos`, `tags` (id serial, name UNIQUE lowercase), `user_tags` (PK composta). Trigger ou validação aplicativa para máximo 5 fotos e única `is_profile=true`.
43. **Atualizar `POST /auth/register`** para também criar a linha em `profiles` (campos opcionais NULL) na mesma transação.
44. **`GET /users/me`** e **`PATCH /users/me`** (nome, sobrenome, e-mail — se mudar, dispara novo fluxo de verificação —, gênero, orientação, bio, birthDate). Validação Zod.
45. **`PATCH /users/me/location`** com `consent` boolean; se `false`, `city`+`neighborhood` obrigatórios.
46. **Upload de fotos** — `multer` (storage em memória), validar mime + magic bytes via `file-type` (apenas `image/jpeg`, `image/png`, `image/webp`), `sharp` redimensiona para WebP máx 1024px lado maior, nome aleatório, salva em `/usr/src/app/uploads/<userId>/<uuid>.webp`. Reforçar limite ≤ 5 em transação.
47. **`POST /users/me/photos`**, **`DELETE /users/me/photos/:id`** (apaga arquivo do disco também), **`PATCH /users/me/photos/:id/profile`** (mantém invariante "apenas uma `is_profile=true`" em transação).
48. **`GET /users/me/tags`**, **`PUT /users/me/tags`** (substitui todas, cria as ausentes em lowercase sem `#`), **`GET /tags?query=`** autocomplete.
49. **`profile_completed_at`** marcado quando todos os campos obrigatórios (gender, orientation, bio, birthDate, location, ≥ 1 foto, ≥ 1 tag) estiverem presentes — checar no `PATCH`/upload e atualizar.

**Checkpoint:** completar um perfil end-to-end via curl, verificar `profile_completed_at` populado, visualizar foto em `https://localhost/uploads/<userId>/<file>.webp` servida pelo nginx.

---

## Fase 6 — Descoberta (`/browse` e `/search`)

> Objetivo: lista paginada de perfis sugeridos com ordenação inteligente e pesquisa avançada. Sem novas tabelas.

> **TDD aplicado:** `matchService` (engine de browsing/search) é o caso mais óbvio — escreva primeiro testes que descrevem cenários (ordenação por distância, filtros de tags, exclusão de bloqueados, bissexual default), depois a query única.

50. **Service de matching** — query Knex única consolidando:
    - filtro de orientação compatível (`COALESCE(profiles.sexual_orientation, 'bi')`),
    - exclusão de bloqueados (ambos sentidos), já curtidos, próprio usuário, perfis sem foto, contas não verificadas,
    - bounding box por lat/lng + distância em km (Haversine em SQL),
    - score ponderado (proximidade ↑, tags em comum ↑, fame ↑).
51. **`GET /browse`** com query params (`minAge`, `maxAge`, `minFame`, `maxFame`, `maxDistanceKm`, `tags`, `sortBy`, `order`, `page`, `limit`).
52. **`GET /search`** — mesma engine, exigindo ao menos um critério no body/query.
53. **Testes de regressão** para ordenação estável e prioridade de mesma área geográfica.

**Checkpoint:** com os 5 usuários do seed + 5 perfis adicionais criados manualmente, validar que `/browse` para o usuário A retorna B–E ordenados por distância, e que filtrar `tags=vegan` reduz a lista corretamente.

---

## Fase 7 — Visualização de perfil e interações

> Objetivo: ver perfil alheio com flags de relacionamento, dar/remover like, reportar, bloquear.

> **TDD aplicado:** `likeService` (regra de match mútuo), `blockService`, `reportService`, `visitService` — testes primeiro.

54. **Migration `interactions`** (`npm run migrate:make -- interactions`) — `likes`, `visits`, `blocks`, `reports` e **VIEW `matches`** (seção 7 do DOC).
55. **`GET /users/:id`** — perfil público (sem `email`/`password_hash`); inclui `relationship: { iLiked, likedMe, matched, blocked }`; registra entrada em `visits` (exceto self) e enfileira notificação `visit` (a notificação real entra na Fase 9; por enquanto stub que apenas loga).
56. **`POST /users/:id/like`** — exige foto de perfil; detecta match mútuo (cria entrada/atualiza VIEW e enfileira notificação `match`) ou `like` simples.
57. **`DELETE /users/:id/like`** — remove like; se desfaz match, marca match removido e prepara hook para encerrar chat (Fase 8).
58. **`POST /users/:id/report`** (motivo `fake_account` apenas, conforme especificação mínima), **`POST /users/:id/block` / `DELETE /users/:id/block`**.

**Checkpoint:** com usuário A logado, `GET /users/<B>` → 200 com `relationship.iLiked=false`. Após `POST /users/<B>/like` por A e mesmo por B, `GET /users/<B>` por A devolve `matched=true`.

---

## Fase 8 — Chat (`/chats` + WebSocket)

> Objetivo: conversa em tempo real (≤ 10 s) entre usuários com match ativo.

> **TDD aplicado:** `messageService` (regra de envio: bloqueado/match-inativo recusa; persiste + atualiza `last_message_at`) testado isoladamente. Os handlers do Socket.IO viram thin wrappers que chamam o service. Adicional: instalar `socket.io-client` em dev para teste de integração end-to-end de WS.

**Instalar (delta da fase):** `socket.io` (runtime); `socket.io-client` (dev).

59. **Migration `messages`** (`npm run migrate:make -- messages`) — tabela `messages` (seção 7 do DOC) com `(sender_id, recipient_id)` indexado em ambos os sentidos e `read_at`.
60. **Setup do Socket.IO** anexado ao mesmo `httpServer` em `server.ts`; middleware de auth no handshake (token via query `?token=` ou header `Authorization`); rejeita conexão sem JWT válido.
61. **Mapa de presença em memória** (`userId → Set<Socket>`) + heartbeat `presence:ping` atualizando `last_seen_at` e `is_online` em `profiles`. Documentar limitação de scaling (não funciona com múltiplas réplicas — registrar no DOC como dívida).
62. **`GET /chats`** lista conversas (matches ativos) com `lastMessage` e `unreadCount`.
63. **`GET /chats/:matchId/messages?before=&limit=`** paginado por cursor; valida participação no match.
64. **`POST /chats/:matchId/messages`** (REST fallback) e evento WS `message:send` — ambos passam pelo mesmo service que persiste e emite `message:new` ao destinatário.
65. **`PATCH /chats/:matchId/read`** + evento `message:read` para echo no remetente.
66. **Typing indicators** (`typing:start/stop` → `typing`).
67. **Política de bloqueio**: service de mensagens recusa envio se houver `blocks` entre os pares ou match inativo.

**Checkpoint:** dois clientes (curl WS ou script Node) conectados como A e B em match ativo trocam mensagem em <1 s; após `POST /users/<B>/block` por A, novo `message:send` é rejeitado com `error` e a mensagem não aparece em `GET /chats/.../messages`.

---

## Fase 9 — Notificações

> Objetivo: notificações persistentes em tempo real para like, visit, message, match, unlike.

> **TDD aplicado:** `notificationService.createNotification` testado isoladamente (dedupe de 10 min, payload por tipo, mock do canal WS). Os hooks dos services das fases 7 e 8 que hoje são stubs viram chamadas reais — atualizar testes existentes.

68. **Migration `notifications`** (`npm run migrate:make -- notifications`) — tabela `notifications` da seção 7 do DOC.
69. **`services/notificationService.ts`** — `createNotification(userId, actorId, type, payload)` chamado por likes, matches, unlike, visits, messages; emite `notification:new` no Socket.IO se o destinatário tiver socket conectado. Substituir os stubs deixados nas Fases 7 e 8.
70. **`GET /notifications`** com `unreadOnly`, paginação e `unreadCount` agregado.
71. **`PATCH /notifications/:id/read`** e **`PATCH /notifications/read-all`**.
72. **Janela de dedupe** (ex.: não duplicar `visit` do mesmo `actor` em 10 minutos) — política explícita e documentada em comentário do service.

**Checkpoint:** disparar like de A → B; conectar B via WS; receber `notification:new` em menos de 10 s. `GET /notifications?unreadOnly=true` devolve a notificação; `PATCH /notifications/:id/read` zera o contador.

---

## Fase 10 — Segurança e GDPR

> Objetivo: endurecer aplicação para padrões mínimos de produção.

73. **Helmet com CSP** ajustada ao frontend; **HSTS** habilitado atrás do nginx em produção (não em dev com cert self-signed).
74. **Sanitização**: nunca confiar em IDs do cliente — sempre validar contra `req.user.id` em serviços de mutação.
75. **Rate limit global** (mais permissivo) + limites estritos em upload de fotos e endpoints de auth (já em Fase 4).
76. **`DELETE /users/me`** — apaga em cascata (likes, visits, messages, photos no disco, tokens, profile) em transação; exige confirmação por senha no body.
77. **Auditoria de tokens** — hash em DB para `email_tokens`/`password_reset_tokens` (já feito em Fase 4), uso único, TTL 24h verificação / 1h reset.
78. **Logs sem PII** — nunca logar senha, refresh token cru, ou conteúdo de mensagem. Definir redactors no pino.

**Checkpoint:** `DELETE /users/me` remove tudo associado ao usuário; `psql` confirma ausência de registros órfãos. Logs da aplicação inspecionados não contêm secrets nem corpos de mensagem.

---

## Fase 11 — Qualidade e entrega

> Objetivo: cobertura agregada, CI rodando a suíte completa, documentação final. Vitest, supertest e socket.io-client já foram instalados nas Fases 3/8; a maior parte dos testes já foi escrita ao longo das Fases 4–9 via TDD — esta fase consolida e automatiza.

**Instalar (delta da fase):** avaliar `@vitest/coverage-v8` (relatório de cobertura) e, se for o caso, `testcontainers` para postgres em CI (alternativa: service container do GitHub Actions).

79. **Coverage report** — habilitar `coverage` no `vitest.config.ts` com threshold mínimo (ex.: 80% statements/branches em `src/services/`). Falha do gate de cobertura quebra o CI.
80. **CI** (GitHub Actions): `lint` → `typecheck` → `migrate` em postgres ephemeral → `npm test -- --run --coverage` em paralelo. Cache de `node_modules` por `package-lock.json` hash.
81. **README atualizado** seguindo seção 13 do [DOC.md](DOC.md): `make up`, `make health`, fluxo de testes (`npm test`, `npm test -- --coverage`), troubleshooting.
82. **Checklist final** validando cada linha da [tabela de conformidade do DOC](DOC.md#-checklist-de-conformidade-com-os-requisitos) e do [checklist do specifications](specifications.md#checklist-rápido-de-implementação).

---

**Estratégia de execução:**

- Fases **0–3** são pré-requisito — não pular nem entregar parcialmente, porque tudo daqui em diante depende de Express composto + Knex + logger/error handler.
- Fases **4 → 9** entregam features de usuário, em ordem (cada uma destrava a próxima do ponto de vista do produto).
- Fases **10–11** são cross-cutting; não deixar para o final absoluto — segurança deve subir em paralelo com cada feature (rate limit, redação de logs, etc.), e testes devem acompanhar cada fase quando o tooling estiver pronto.
