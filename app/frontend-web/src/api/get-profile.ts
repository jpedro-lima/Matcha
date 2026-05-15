import { api } from '@/libs/axios'

export async function getMyProfile() {
  const res = await api.get('/profiles/me')
  return res.data
}
