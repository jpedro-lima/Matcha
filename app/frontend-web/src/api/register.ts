import { api } from '@/libs/axios'

export interface RegisterPayload {
	username: string
	firstName: string
	lastName: string
	email: string
	password: string
	validatePassword: string
}

export interface RegisterResponse {
	id: string
	username: string
	email: string
}

export async function registerUser({
	username,
	firstName,
	lastName,
	email,
	password,
	validatePassword,
}: RegisterPayload) {
	const response = await api.post<RegisterResponse>('/register', {
		username,
		first_name: firstName,
		last_name: lastName,
		email,
		password,
		validate_password: validatePassword,
	})

	return response.data
}
