#!/bin/sh
set -eu

# Bootstrap a self-signed TLS cert for local development on first container
# start. Runs from the nginx image's /docker-entrypoint.d/ — exits fast if the
# cert files are already present (the next container start is a no-op).

CERT_DIR=/etc/nginx/certs

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
	echo "[gen-certs] certs already present, skipping"
	exit 0
fi

mkdir -p "$CERT_DIR"

echo "[gen-certs] generating self-signed certificate for localhost"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	-keyout "$CERT_DIR/server.key" \
	-out    "$CERT_DIR/server.crt" \
	-subj   "/C=BR/ST=SP/L=SP/O=Matcha/CN=localhost" \
	-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
	>/dev/null 2>&1

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "[gen-certs] done"
