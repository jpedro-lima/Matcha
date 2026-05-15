# Lista de Implementação — API Matcha (Node.js + Express + Knex)

Roteiro sequencial para construir do zero a API descrita em [DOC.md](DOC.md), atendendo [specifications.md](specifications.md). Cada etapa entrega algo testável antes da próxima.

---

## Fase 0 — Bootstrap do projeto

1. **Criar diretório `api/`** com `npm init -y` e ajustar `package.json` (nome, scripts `dev`, `build`, `start`, `lint`, `format`, `migrate`, `seed`).
2. **Instalar TypeScript + ferramentas base**: `typescript`, `tsx` (dev), `@types/node`, `eslint`, `prettier`, `eslint-config-prettier`. Gerar `tsconfig.json` com `strict: true`, `outDir: dist`, `rootDir: src`.
3. **Instalar runtime principal**: `express`, `cors`, `helmet`, `cookie-parser`, `express-rate-limit`, `compression`, `morgan` (+ `@types/*`).
4. **Estrutura de pastas** conforme seção 3 do [DOC.md](DOC.md): `src/{config,middlewares,routes,controllers,services,models,sockets,utils,validators}` e `database/{migrations,seeds}`.
5. **`.env.example`** com todas as variáveis da seção 4 do DOC; `.gitignore` cobrindo `.env`, `node_modules`, `dist`, `uploads`, `nginx/certs`.
6. **Carregar env com validação Zod** (`src/config/env.ts`) — falha rápido se faltar variável.

## Fase 1 — Infra local (Docker + Nginx + TLS)

7. **`api/Dockerfile`** (multi-stage: build TS → runtime node:lts-alpine).
8. **`docker-compose.yml`** na raiz com serviços `db` (postgres:16-alpine), `api`, `nginx`, volumes `matcha_db` e `matcha_uploads`, network `matcha_net`.
9. **`scripts/gen-certs.sh`** gerando `nginx/certs/server.{crt,key}` via OpenSSL.
10. **`nginx/nginx.conf`** com redirect 80→443, SPA root, proxy `/api/` e `/ws/`, location `/uploads/`.
11. **Healthcheck `GET /api/health`** retornando `{ status: "ok" }` para validar pipeline Nginx→API.

## Fase 2 — Banco de dados (Knex + PostgreSQL)

12. **Instalar Knex** + `pg` e configurar `database/knexfile.ts` (dev/test/prod lendo do env).
13. **Habilitar extensão `pgcrypto`** (para `gen_random_uuid()`) em migration inicial.
14. **Migrations na ordem**: `users` → `profiles` (1:1) → `photos` → `tags` + `user_tags` → `likes` → `visits` → `blocks` → `reports` → `messages` → `notifications` → `email_tokens` + `password_reset_tokens` → VIEW `matches`.
15. **CHECKs e índices** conforme seção 7 do DOC (`birth_date <= now - 18y`, `(gender, sexual_orientation)`, `(latitude, longitude)`, `fame_rating DESC`).
16. **Seeds básicos**: 10 usuários verificados, perfis completos, tags populares — para dev e testes.

## Fase 3 — Camadas transversais

17. **`src/app.ts`** centralizando Express: helmet, cors restrito ao frontend, cookie-parser, json, rate limit em `/auth/*`, montagem de rotas, error handler global.
18. **`src/server.ts`** iniciando HTTP server + Socket.IO no mesmo listener.
19. **Error handler** padronizando o formato `{ error: { code, message, details } }` (seção 9 do DOC) e classe `AppError` para erros tipados.
20. **Logger** (pino ou winston) com correlação por request id.
21. **Middleware `requireAuth`** que valida o access token JWT do header e injeta `req.user`.
22. **Helpers de validação Zod** + middleware `validate(schema)` para body/query/params.

## Fase 4 — Autenticação (`/auth`)

23. **Hashing** com `bcrypt` (≥ 12 rounds) — helper `hashPassword` / `verifyPassword`.
24. **Política de senha** com `zxcvbn` (score ≥ 3) + regex de complexidade — validator compartilhado por register e reset.
25. **JWT util** (`signAccess`, `signRefresh`, `verify`) lendo secrets/TTL do env; revogação de refresh via tabela `refresh_tokens` ou jti em blocklist.
26. **Serviço de e-mail** (Nodemailer) com templates simples para verificação e reset; em dev aponta para Mailtrap.
27. **`POST /auth/register`** — cria `users` + `profiles` (campos opcionais NULL) em transação + gera `email_token` e dispara e-mail.
28. **`GET /auth/verify-email/:token`** — consome token, marca `email_verified = true`.
29. **`POST /auth/login`** — verifica credenciais, exige `email_verified`, retorna access token + seta refresh cookie httpOnly/Secure/SameSite=Strict.
30. **`POST /auth/refresh`** — rotaciona refresh token.
31. **`POST /auth/logout`** — revoga refresh + limpa cookie.
32. **`POST /auth/forgot-password`** e **`POST /auth/reset-password`** — tokens em `password_reset_tokens`, expiração 1h.
33. **Rate limit específico** em login/register/forgot (5 / 15 min por IP).

## Fase 5 — Perfil (`/users/me` + uploads + tags)

34. **`GET /users/me`** e **`PATCH /users/me`** (nome, email — re-dispara verificação —, gênero, orientação, bio, birthDate).
35. **`PATCH /users/me/location`** com consentimento; se `consent=false`, exige `city`/`neighborhood`.
36. **Upload de fotos**: `multer` (memória) + `sharp` (redimensionar, normalizar para webp), validar mime + magic bytes, nome aleatório, máximo 5.
37. **`POST/DELETE /users/me/photos`** e **`PATCH /users/me/photos/:id/profile`** (mantendo invariante "apenas uma `is_profile=true`" em transação).
38. **`GET/PUT /users/me/tags`** + **`GET /tags?query=`** — criar tags ausentes em lowercase, sem `#`.
39. **`GET /users/me/visitors`** e **`GET /users/me/likes`** (paginação).
40. **Cálculo de `fame_rating`** — definir fórmula (ex.: peso de likes recebidos − reports + visitas únicas) e atualizar via trigger SQL ou job; expor read-only.
41. **`profile_completed_at`** preenchido quando todos os campos obrigatórios estão preenchidos.

## Fase 6 — Descoberta (`/browse` + `/search`)

42. **Serviço de matching** — query única com:
    - filtro de orientação compatível (`COALESCE(sexual_orientation, 'bi')`),
    - exclusão de bloqueados (ambos lados), já curtidos, próprio usuário, sem foto, não verificados,
    - bounding box por lat/lng + cálculo de distância em km,
    - score ponderado (proximidade, tags em comum, fame).
43. **`GET /browse`** com query params (`minAge`, `maxAge`, `minFame`, `maxFame`, `maxDistanceKm`, `tags`, `sortBy`, `order`, `page`, `limit`).
44. **`GET /search`** — mesma engine, exigindo pelo menos um critério.
45. **Testes de regressão** para garantir ordenação estável e prioridade da mesma área geográfica.

## Fase 7 — Visualização e interações (`/users/:id`)

46. **`GET /users/:id`** — perfil público + flags `relationship` (iLiked, likedMe, matched, blocked); registra `visit` (exceto self) e enfileira notificação `visit`.
47. **`POST /users/:id/like`** — exige foto de perfil; detecta match mútuo (cria notificação `match` para ambos) ou `like` simples.
48. **`DELETE /users/:id/like`** — remove like; se desfaz match, fecha chat e emite `match:removed` + `unlike`.
49. **`POST /users/:id/report`** (motivo `fake_account`) e **`POST /users/:id/block` / `DELETE`** — bloqueio derruba sessões de chat e oculta de buscas.

## Fase 8 — Chat (`/chats` + WebSocket)

50. **Setup Socket.IO** com auth no handshake (token via query ou header) — rejeita conexão sem JWT válido.
51. **Mapa de presença** `userId → socketSet` + heartbeat (`presence:ping`) atualizando `last_seen_at` e `is_online`.
52. **`GET /chats`** lista conversas com `lastMessage` e `unreadCount`.
53. **`GET /chats/:matchId/messages`** paginado por cursor (`before=<id>`), validando que o usuário pertence ao match.
54. **`POST /chats/:matchId/messages`** (REST fallback) e evento WS `message:send` — ambos passam pelo mesmo service que persiste e emite `message:new` ao destinatário.
55. **`PATCH /chats/:matchId/read`** + evento `message:read` para echo no remetente.
56. **Typing indicators** (`typing:start/stop` → `typing`).
57. **Política de bloqueio**: serviço de mensagens recusa envio se houver `blocks` entre os pares ou match inativo.

## Fase 9 — Notificações (`/notifications`)

58. **Service `createNotification(userId, actorId, type, payload)`** chamado por like, match, unlike, visit, message; emite `notification:new` via WS se o destinatário estiver conectado.
59. **`GET /notifications`** com `unreadOnly`, paginação e `unreadCount` agregado.
60. **`PATCH /notifications/:id/read`** e **`/notifications/read-all`**.
61. **Janela de dedupe configurável** (ex.: não duplicar `visit` do mesmo actor em 10 minutos) — política explícita, documentada.

## Fase 10 — Segurança e GDPR

62. **Helmet com CSP** ajustada ao frontend; HSTS atrás do Nginx.
63. **Sanitização**: nunca confiar em IDs do cliente — sempre checar `req.user.id`.
64. **Rate limit global** + limites mais estritos em auth e upload.
65. **`DELETE /users/me`** — apaga em cascata (likes, visits, messages, photos do disco, tokens) dentro de transação; confirma com senha.
66. **Auditoria de tokens**: hash em DB para `email_tokens`/`password_reset_tokens`, uso único, TTL (24h verificação / 1h reset).
67. **Logs sem PII**: nunca logar senha, token ou conteúdo de mensagem.

## Fase 11 — Qualidade e entrega

68. **Testes**: Vitest/Jest + Supertest para handlers; testcontainers (ou DB de teste dedicado) para integração de Knex; testes de socket com cliente Socket.IO.
69. **CI** (GitHub Actions): lint, typecheck, migrations + testes em Postgres ephemeral.
70. **README/Setup** seguindo a seção 13 do DOC, incluindo `gen-certs.sh`, `docker compose up`, `knex migrate:latest`, `knex seed:run`.
71. **Checklist final** validando cada linha da tabela de conformidade ao fim do [DOC.md](DOC.md#-checklist-de-conformidade-com-os-requisitos) e do [specifications.md](specifications.md#checklist-rápido-de-implementação).

---

**Recomendação de execução:** entregar Fase 0–3 antes de qualquer feature de negócio, depois seguir Fases 4 → 9 em ordem (cada uma destrava a próxima do ponto de vista do usuário). Fases 10 e 11 atravessam todo o desenvolvimento — não deixar para o fim.
