import { api } from '@/libs/axios'

export async function uploadProfilePhotos(files: FileList) {
  const fd = new FormData()
  Array.from(files).forEach((f) => fd.append('images', f))
  const res = await api.post('/profiles/photos', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
