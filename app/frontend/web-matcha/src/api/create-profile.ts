import { api } from '@/libs/axios';

export interface ProfilePayload {
  bio: string;
  gender: string;
  preferred_gender: string[];
  birth_date: string;
  search_radius: number;
  tags: string[];
  attributes: Record<string, string>;
  looking_for: {
    relationship_type: string;
    interests: string[];
  };
  profile_photos: string[];
}

export async function createProfile(data: ProfilePayload, token: string) {
  const response = await api.post('/profiles', data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}
