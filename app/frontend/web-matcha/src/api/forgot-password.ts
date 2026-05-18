import { api } from '@/libs/axios'

export async function forgotPassword(email: string) {
  const response = await api.post('/forgot-password', { email })
  return response.data as { message: string }
}
