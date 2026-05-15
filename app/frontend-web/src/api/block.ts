import { api } from '@/libs/axios'

export async function blockUser(targetUserId: number) {
  const res = await api.post('/blocks', { target_user_id: targetUserId })
  return res.data
}
