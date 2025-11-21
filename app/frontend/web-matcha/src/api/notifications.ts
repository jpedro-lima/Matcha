import { api } from '@/libs/axios'

export interface Notification {
  id: number
  user_id: number
  sender_id?: number
  type: string
  content: string
  read: boolean
  created_at: string
}

export async function getNotifications() {
  const response = await api.get<Notification[]>('/notifications')
  return response.data
}

export async function markNotificationsRead() {
  await api.post('/notifications/read')
}
