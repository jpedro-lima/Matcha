import { api } from '@/lib/axios'

interface SignInProps {
	email: string
	password: string
	strategy?: string
}

export interface SignInResponse {
	accessToken: string
	user: {
		id: string
		name: string
	}
}

export async function signIn({ email, password, strategy = 'local' }: SignInProps) {
	const response = await api.post<SignInResponse>('/sign-in', {
		email,
		password,
		strategy,
	})
	return response.data
}
