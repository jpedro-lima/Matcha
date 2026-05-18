import { api } from '@/libs/axios'

export interface SocialUser {
  sender_id: number
  name: string
  first_photo: string
  event_at: string
}

export async function getVisitors() {
  const response = await api.get<SocialUser[]>('/visitors')
  return response.data
}
