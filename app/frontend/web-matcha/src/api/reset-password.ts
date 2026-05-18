import { api } from '@/libs/axios'

export async function resetPassword(token: string, newPassword: string) {
  const response = await api.post('/reset-password', {
    token,
    new_password: newPassword,
  })
  return response.data as { message: string }
}
