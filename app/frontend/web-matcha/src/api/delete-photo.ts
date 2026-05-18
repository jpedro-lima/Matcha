import { api } from '@/libs/axios'

export async function deleteProfilePhoto(url: string) {
  const response = await api.delete('/profiles/photos', { data: { url } })
  return response.data as { profile_photos: string[] }
}
