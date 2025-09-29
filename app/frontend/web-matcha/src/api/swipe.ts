import { api } from '@/libs/axios'

export interface SwipeResponse { status: string }

export async function swipeLike(token: string, targetProfileId: number) {
  const res = await api.post<SwipeResponse>(
    '/swipe',
    { target_profile_id: targetProfileId },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data
}
