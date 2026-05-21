// ── User: entidade de domínio + shape de linha do banco ──────────
// `User` é a forma camelCase usada na aplicação. `UserRow` é o que o knex
// devolve direto do Postgres (snake_case). Sempre que um service ler do DB
// e for expor para outras camadas, use `userFromRow` para mapear.

export type User = {
	id: string
	email: string
	username: string
	firstName: string
	lastName: string
	emailVerified: boolean
	createdAt: Date
	updatedAt: Date
}

export type UserRow = {
	id: string
	email: string
	username: string
	first_name: string
	last_name: string
	password_hash: string
	email_verified: boolean
	created_at: Date
	updated_at: Date
}

// Subconjunto do `User` exposto em respostas públicas (sem campos sensíveis).
export type PublicUser = Pick<User, 'id' | 'email' | 'username' | 'emailVerified'>

export function userFromRow(row: UserRow): User {
	return {
		id: row.id,
		email: row.email,
		username: row.username,
		firstName: row.first_name,
		lastName: row.last_name,
		emailVerified: row.email_verified,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export function publicUserFromRow(row: Pick<UserRow, 'id' | 'email' | 'username' | 'email_verified'>): PublicUser {
	return {
		id: row.id,
		email: row.email,
		username: row.username,
		emailVerified: row.email_verified,
	}
}
