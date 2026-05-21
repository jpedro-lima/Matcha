import type { PublicUser } from './user.js'

// DTOs de entrada/saída do `auth-service`. Estão em `models/` para que
// controllers e (futuramente) clientes TS internos consumam sem cruzar a
// fronteira de service implementation.

export type RegisterInput = {
	email: string
	username: string
	firstName: string
	lastName: string
	password: string
}

export type LoginResult = {
	accessToken: string
	refreshToken: string
	user: Pick<PublicUser, 'id' | 'username' | 'email'>
}
