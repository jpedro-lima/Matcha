import type { Gender, SexualOrientation } from '../../common/types/profile.types.js'

export type BrowseItem = {
	id: string
	username: string
	age: number
	gender: Gender
	sexualOrientation: SexualOrientation | null
	bio: string | null
	distanceKm: number | null
	commonTags: number
	fameRating: number
	photoUrl: string | null
}

export type BrowseResult = {
	items: BrowseItem[]
	hasMore: boolean
}

// Shape cru que vem da query consolidada (snake_case do PG).
export type BrowseRow = {
	id: string
	username: string
	age: number
	gender: Gender
	sexual_orientation: SexualOrientation | null
	bio: string | null
	distance_km: number | null
	common_tags: number
	fame_rating: number
	score: number
}
