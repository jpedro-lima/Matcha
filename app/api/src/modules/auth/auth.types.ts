import type { PublicUser } from '../../common/types/user.types.js'

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

export type RegisterResult = {
	user: PublicUser
	emailSent: boolean
}
