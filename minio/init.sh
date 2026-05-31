#!/bin/sh
# Entrypoint wrapper do container `minio` do matcha. Sobe o servidor em
# background, aguarda readiness, garante o bucket (sem policy pública),
# e devolve o foreground para o processo do servidor (para que o
# `docker stop` envie SIGTERM ao minio, não ao wrapper).
#
# Idempotente: rodar várias vezes não recria nada — `mc mb -p` ignora
# bucket existente e `mc anonymous set none` é determinístico.
#
# Bucket é PRIVADO: clientes só conseguem GET/PUT via signed URLs
# emitidas pela API (TTL curto). Ver app/api/src/common/services/s3.service.ts.

set -e

BUCKET="${S3_BUCKET:-matcha-photos}"

# 1. Sobe o servidor MinIO em background com os args passados via CMD
#    (`server /data --console-address :9001` por padrão).
minio "$@" &
MINIO_PID=$!

# 2. Forwarding de sinais: docker stop → SIGTERM → wrapper → minio.
trap 'kill -TERM "$MINIO_PID" 2>/dev/null; wait "$MINIO_PID" 2>/dev/null' TERM INT

# 3. Aguarda readiness. Em vez de curl (que pode não estar na imagem),
#    tenta o `mc alias set` em loop — ele só sucede quando o endpoint
#    responde com 200 ao handshake.
echo "[minio] waiting for server to accept admin connections..."
until mc alias set local http://localhost:9000 \
		"$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
	sleep 1
done

# 4. Bootstrap idempotente: cria bucket (-p ignora se já existe) e
#    força policy "none" (privado). Acesso só via signed URLs da API.
mc mb -p "local/${BUCKET}" >/dev/null
mc anonymous set none "local/${BUCKET}" >/dev/null
echo "[minio] bucket '${BUCKET}' ready (private)"

# 5. Devolve o foreground ao servidor — bloqueia até ele sair.
wait "$MINIO_PID"
