import { api } from '@/libs/axios'

export interface SuggestedProfile {
  id: number
  bio: string
  gender: string
  profile_photos: string // first photo url or empty
}

export async function getSuggestedProfile(token: string) {
  const res = await api.get<SuggestedProfile>('/matches', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}
