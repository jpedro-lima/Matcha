FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY gen-certs.sh /docker-entrypoint.d/01-gen-certs.sh

RUN chmod +x /docker-entrypoint.d/01-gen-certs.sh
