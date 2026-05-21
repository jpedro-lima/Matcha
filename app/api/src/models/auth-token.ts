// Shape comum das tabelas `email_tokens` e `password_reset_tokens`.
// Mesma estrutura: token armazenado como sha256 hex (PK), FK para users
// com CASCADE, e janela de expiração.

export type AuthTokenRow = {
	token_hash: string
	user_id: string
	expires_at: Date
	created_at: Date
}
