import { api } from '@/libs/axios'

interface SignInProps {
	username: string
	password: string
	strategy?: string
}

export interface SignInResponse {
	token: string
	user: {
		id: string
		name: string
	}
}

export async function signIn({ username, password, strategy = 'local' }: SignInProps) {
	const response = await api.post<SignInResponse>('/login', {
		username,
		password,
		strategy,
	})
	return response.data
}
