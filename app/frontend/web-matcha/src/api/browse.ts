import { api } from '@/libs/axios'

export interface BrowseProfile {
  id: number
  bio: string
  gender: string
  profile_photos: string
  fame_rating: number
  tags: string[]
}

export interface BrowseParams {
  min_age?: number
  max_age?: number
  min_fame?: number
  max_fame?: number
  sort_by?: 'age' | 'fame' | 'location' | 'tags'
  sort_dir?: 'asc' | 'desc'
  tags?: string
}

export async function browseProfiles(params: BrowseParams = {}) {
  const response = await api.get<BrowseProfile[]>('/browse', { params })
  return response.data
}

export async function searchProfiles(params: BrowseParams = {}) {
  const response = await api.get<BrowseProfile[]>('/search', { params })
  return response.data
}
