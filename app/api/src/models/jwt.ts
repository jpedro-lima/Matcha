// Payloads do JWT. Tipos consumidos por `jwt-service` (assinar/verificar) e
// por middlewares (require-auth) que decodificam access tokens.

export type AccessPayload = {
	sub: string
	username: string
}

export type RefreshPayload = {
	sub: string
	jti: string
}
