import { api } from '@/libs/axios'

export interface UnmatchResponse { status: string }

export async function unmatchByProfile(token: string, targetProfileId: number) {
  const res = await api.post<UnmatchResponse>(
    '/unmatch',
    { target_profile_id: targetProfileId },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data
}
