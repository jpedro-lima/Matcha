import type { z } from 'zod'
import type { genderSchema, sexualOrientationSchema } from '../schemas/profile.schemas.js'

export type Gender = z.infer<typeof genderSchema>
export type SexualOrientation = z.infer<typeof sexualOrientationSchema>

export type ProfileLocation = {
	latitude: number | null
	longitude: number | null
	city: string | null
	neighborhood: string | null
	consent: boolean | null
}

export type Profile = {
	bio: string | null
	gender: Gender | null
	sexualOrientation: SexualOrientation | null
	birthDate: string | null // ISO 'YYYY-MM-DD'
	location: ProfileLocation
	fameRating: number
	lastActive: string // ISO timestamp
	isOnline: boolean
	profileCompletedAt: string | null
	createdAt: string
	updatedAt: string
}

export type ProfileRow = {
	user_id: string
	bio: string | null
	gender: Gender | null
	sexual_orientation: SexualOrientation | null
	birth_date: Date | null
	latitude: string | null
	longitude: string | null
	city: string | null
	neighborhood: string | null
	location_consent: boolean | null
	fame_rating: number
	last_active: Date
	is_online: boolean
	profile_completed_at: Date | null
	created_at: Date
	updated_at: Date
}

const toIsoDate = (d: Date | null): string | null =>
	d ? d.toISOString().slice(0, 10) : null

const toIso = (d: Date | null): string | null => (d ? d.toISOString() : null)

const toNumber = (s: string | null): number | null => (s !== null ? Number(s) : null)

export function profileFromRow(row: ProfileRow): Profile {
	return {
		bio: row.bio,
		gender: row.gender,
		sexualOrientation: row.sexual_orientation,
		birthDate: toIsoDate(row.birth_date),
		location: {
			latitude: toNumber(row.latitude),
			longitude: toNumber(row.longitude),
			city: row.city,
			neighborhood: row.neighborhood,
			consent: row.location_consent,
		},
		fameRating: row.fame_rating,
		lastActive: row.last_active.toISOString(),
		isOnline: row.is_online,
		profileCompletedAt: toIso(row.profile_completed_at),
		createdAt: row.created_at.toISOString(),
		updatedAt: row.updated_at.toISOString(),
	}
}
