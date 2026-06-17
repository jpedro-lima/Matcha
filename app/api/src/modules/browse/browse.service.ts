import { presignGet } from '../../common/services/s3.service.js'
import { db } from '../../config/db.js'
import { AppError } from '../../utils/app-error.js'
import type { BrowseQuery } from './browse.schemas.js'
import type { BrowseResult, BrowseRow } from './browse.types.js'

// Pesos do score. Constantes — afinar via PR, não env.
const W_DISTANCE = 1
const W_TAGS = 2
const W_FAME = 0.5

type MeProfile = {
	gender: string | null
	sexual_orientation: string | null
	latitude: number | null
	longitude: number | null
	profile_completed_at: Date | string | null
}

export async function browseFor(userId: string, filters: BrowseQuery): Promise<BrowseResult> {
	const me = await db('profiles')
		.where({ user_id: userId })
		.first<MeProfile>(
			'gender',
			'sexual_orientation',
			'latitude',
			'longitude',
			'profile_completed_at',
		)
	if (!me) throw new AppError('NOT_FOUND', 404, 'Profile not found.')
	if (!me.profile_completed_at) {
		throw new AppError(
			'PROFILE_INCOMPLETE',
			400,
			'Complete your profile before browsing.',
		)
	}

	const limit = filters.limit
	const hasGps = me.latitude !== null && me.longitude !== null
	// Quando o user não tem coords (location manual), passamos 0,0 mas o
	// haversine devolve NULL pra targets sem coord também — filtros de
	// distância são pulados.
	const myLat = me.latitude
	const myLng = me.longitude

	let query = db('users as u')
		.join('profiles as p', 'p.user_id', 'u.id')
		.where('u.id', '!=', userId)
		.where('u.email_verified', true)
		.whereNotNull('p.profile_completed_at')
		.whereNotExists(function () {
			this.select(db.raw('1'))
				.from('user_swipes')
				.whereRaw('swiper_id = ? AND target_id = u.id', [userId])
		})
		.whereNotExists(function () {
			this.select(db.raw('1'))
				.from('blocks')
				.whereRaw(
					'(blocker_id = ? AND blocked_id = u.id) OR (blocker_id = u.id AND blocked_id = ?)',
					[userId, userId],
				)
		})
		.whereRaw('is_orientation_compatible(?, ?, p.gender, p.sexual_orientation)', [
			me.gender,
			me.sexual_orientation,
		])

	if (filters.minAge !== undefined) {
		query = query.whereRaw(
			"p.birth_date <= (CURRENT_DATE - (? || ' years')::interval)",
			[filters.minAge],
		)
	}
	if (filters.maxAge !== undefined) {
		query = query.whereRaw(
			"p.birth_date >= (CURRENT_DATE - (? || ' years')::interval)",
			[filters.maxAge],
		)
	}
	if (filters.minFame !== undefined) {
		query = query.where('p.fame_rating', '>=', filters.minFame)
	}
	if (filters.maxFame !== undefined) {
		query = query.where('p.fame_rating', '<=', filters.maxFame)
	}
	if (filters.maxDistanceKm !== undefined && hasGps) {
		query = query.whereRaw('haversine_km(?, ?, p.latitude, p.longitude) <= ?', [
			myLat,
			myLng,
			filters.maxDistanceKm,
		])
	}
	if (filters.tags && filters.tags.length > 0) {
		const tags = filters.tags
		query = query.whereExists(function () {
			this.select(db.raw('1'))
				.from('user_tags as ut')
				.join('tags as t', 't.id', 'ut.tag_id')
				.whereRaw('ut.user_id = u.id')
				.whereIn('t.name', tags)
		})
	}

	const rows = await query
		.select(
			'u.id',
			'u.username',
			db.raw('EXTRACT(YEAR FROM AGE(p.birth_date))::int as age'),
			'p.gender',
			'p.sexual_orientation',
			'p.bio',
			'p.fame_rating',
			db.raw('haversine_km(?, ?, p.latitude, p.longitude) as distance_km', [myLat, myLng]),
			db.raw(
				`(SELECT COUNT(*)::int FROM user_tags ut1
				  JOIN user_tags ut2 ON ut1.tag_id = ut2.tag_id
				  WHERE ut1.user_id = ? AND ut2.user_id = u.id) as common_tags`,
				[userId],
			),
			// Score: distância vira NULL quando target/me sem coord → COALESCE 0.
			// Casts explícitos: pesos podem ser fracionários (W_FAME=0.5);
			// sem ::float PG infere integer e quebra.
			db.raw(
				`(COALESCE(?::float / (haversine_km(?, ?, p.latitude, p.longitude) + 1), 0)
				  + ?::float * (SELECT COUNT(*)::int FROM user_tags ut1
				         JOIN user_tags ut2 ON ut1.tag_id = ut2.tag_id
				         WHERE ut1.user_id = ? AND ut2.user_id = u.id)
				  + ?::float * p.fame_rating) as score`,
				[W_DISTANCE, myLat, myLng, W_TAGS, userId, W_FAME],
			),
		)
		.orderByRaw('score DESC, p.fame_rating DESC, u.id ASC')
		.limit(limit + 1)

	const hasMore = rows.length > limit
	const items = rows.slice(0, limit) as BrowseRow[]

	// Primeira foto ready de cada user (por created_at). Uma query só.
	const photoRows = await db('photos')
		.whereIn(
			'user_id',
			items.map((r) => r.id),
		)
		.where({ status: 'ready' })
		.orderBy('user_id')
		.orderBy('created_at', 'asc')
		.select<{ user_id: string; key: string }[]>('user_id', 'key')

	const photoKeyByUser = new Map<string, string>()
	for (const r of photoRows) {
		if (!photoKeyByUser.has(r.user_id)) photoKeyByUser.set(r.user_id, r.key)
	}

	const photoUrls = await Promise.all(
		items.map((r) => {
			const key = photoKeyByUser.get(r.id)
			return key ? presignGet(key) : Promise.resolve(null)
		}),
	)

	return {
		items: items.map((r, i) => ({
			id: r.id,
			username: r.username,
			age: r.age,
			gender: r.gender,
			sexualOrientation: r.sexual_orientation,
			bio: r.bio,
			distanceKm: r.distance_km !== null ? Number(r.distance_km) : null,
			commonTags: r.common_tags,
			fameRating: r.fame_rating,
			photoUrl: photoUrls[i] ?? null,
		})),
		hasMore,
	}
}
