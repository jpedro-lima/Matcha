import { api } from '@/libs/axios'

export interface SocialUser {
  sender_id: number
  name: string
  first_photo: string
  event_at: string
}

export async function getLikers() {
  const response = await api.get<SocialUser[]>('/likers')
  return response.data
}
