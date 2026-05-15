import { api } from '@/libs/axios'

export async function reportUser(targetUserId: number, reason: string) {
  const res = await api.post('/reports', { target_user_id: targetUserId, reason })
  return res.data
}
