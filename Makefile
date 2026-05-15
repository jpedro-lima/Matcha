# ─────────────────────────────────────────────────────────────
# Matcha — dev/ops shortcuts. Requires only Docker + Docker Compose.
# ─────────────────────────────────────────────────────────────

COMPOSE := docker compose

.PHONY: help up down restart logs ps build rebuild health access-db regen-certs clean nuke

help: ## Show this help
	@awk 'BEGIN{FS=":.*##"; printf "Targets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Build (if needed) and start all services in the background
	$(COMPOSE) up -d --build

down: ## Stop and remove containers + network (volumes kept)
	$(COMPOSE) down

restart: ## Restart the stack without rebuilding
	$(COMPOSE) restart

build: ## Build images without starting
	$(COMPOSE) build

rebuild: ## Force a clean rebuild of all images
	$(COMPOSE) build --no-cache

logs: ## Tail logs from all services (Ctrl+C to exit)
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

health: ## Hit the API healthcheck through nginx
	@curl -sk -w '\nHTTP %{http_code}\n' https://localhost/api/health

access-db: ## Open psql inside the db container using POSTGRES_USER/DB from the container env
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

regen-certs: ## Drop the cert volume so nginx regenerates on next `make up`
	$(COMPOSE) rm -sf nginx
	docker volume rm matcha_certs >/dev/null 2>&1 || true
	@echo "✓ certs volume removed — run \`make up\` to regenerate"

clean: ## Stop stack and remove its volumes (DB, uploads, certs)
	$(COMPOSE) down -v

nuke: ## clean + remove images built by this compose project
	$(COMPOSE) down -v --rmi local
