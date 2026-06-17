import { beforeEach, describe, expect, it, vi } from 'vitest'
import { presignGet } from '../../../common/services/s3.service.js'
import { AppError } from '../../../utils/app-error.js'
import { browseFor } from '../browse.service.js'

vi.mock('../../../common/services/s3.service.js', () => ({
	presignGet: vi.fn(async (key: string) => `https://cdn.test/${key}?sig=Z`),
}))

// Dois builders separados: um para a query principal (users join profiles)
// onde `select` é chainable, e um para a busca de fotos onde `select` é
// terminal (await resolve direto). dbMock roteia por nome da tabela.
const mainBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	whereNot: vi.fn(),
	whereIn: vi.fn(),
	whereNotNull: vi.fn(),
	whereNotExists: vi.fn(),
	whereExists: vi.fn(),
	whereRaw: vi.fn(),
	join: vi.fn(),
	first: vi.fn(),
	select: vi.fn(),
	orderBy: vi.fn(),
	orderByRaw: vi.fn(),
	limit: vi.fn(),
}))
const photosBuilder = vi.hoisted(() => ({
	whereIn: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	select: vi.fn(),
}))
const dbMock = vi.hoisted(() => {
	const fn = vi.fn() as ReturnType<typeof vi.fn> & { raw: ReturnType<typeof vi.fn> }
	fn.raw = vi.fn((sql: string) => ({ __raw: sql }))
	return fn
})
vi.mock('../../../config/db.js', () => ({ db: dbMock }))

const ME_PROFILE = {
	gender: 'm',
	sexual_orientation: 'hetero',
	latitude: -23.55,
	longitude: -46.63,
	profile_completed_at: new Date('2026-01-01'),
}

beforeEach(() => {
	vi.clearAllMocks()
	dbMock.mockImplementation((table: string) =>
		table === 'photos' ? photosBuilder : mainBuilder,
	)
	for (const m of [
		mainBuilder.where,
		mainBuilder.whereNot,
		mainBuilder.whereIn,
		mainBuilder.whereNotNull,
		mainBuilder.whereNotExists,
		mainBuilder.whereExists,
		mainBuilder.whereRaw,
		mainBuilder.join,
		mainBuilder.select,
		mainBuilder.orderBy,
		mainBuilder.orderByRaw,
	]) {
		m.mockReturnValue(mainBuilder)
	}
	mainBuilder.first.mockResolvedValue(ME_PROFILE)
	mainBuilder.limit.mockResolvedValue([])

	photosBuilder.whereIn.mockReturnValue(photosBuilder)
	photosBuilder.where.mockReturnValue(photosBuilder)
	photosBuilder.orderBy.mockReturnValue(photosBuilder)
	photosBuilder.select.mockResolvedValue([])
})

describe('browseFor — pre-conditions', () => {
	it('throws NOT_FOUND when the user has no profile row', async () => {
		mainBuilder.first.mockResolvedValueOnce(undefined)

		await expect(browseFor('ghost', { limit: 10 })).rejects.toMatchObject({
			code: 'NOT_FOUND',
			status: 404,
		} as Partial<AppError>)
	})

	it('throws PROFILE_INCOMPLETE when profile_completed_at is null', async () => {
		mainBuilder.first.mockResolvedValueOnce({ ...ME_PROFILE, profile_completed_at: null })

		await expect(browseFor('user-1', { limit: 10 })).rejects.toMatchObject({
			code: 'PROFILE_INCOMPLETE',
			status: 400,
		} as Partial<AppError>)
	})
})

describe('browseFor — exclusion filters wired correctly', () => {
	it('excludes self, unverified, incomplete, swiped, blocked, incompatible orient', async () => {
		await browseFor('user-1', { limit: 10 })

		// self
		expect(mainBuilder.where).toHaveBeenCalledWith('u.id', '!=', 'user-1')
		// verified
		expect(mainBuilder.where).toHaveBeenCalledWith('u.email_verified', true)
		// completed
		expect(mainBuilder.whereNotNull).toHaveBeenCalledWith('p.profile_completed_at')
		// swiped + blocked => 2 whereNotExists
		expect(mainBuilder.whereNotExists).toHaveBeenCalledTimes(2)
		// orientation
		expect(mainBuilder.whereRaw).toHaveBeenCalledWith(
			expect.stringContaining('is_orientation_compatible'),
			[ME_PROFILE.gender, ME_PROFILE.sexual_orientation],
		)
	})
})

describe('browseFor — optional filters', () => {
	it('applies minAge / maxAge as birth_date interval', async () => {
		await browseFor('user-1', { limit: 10, minAge: 25, maxAge: 35 })

		const calls = mainBuilder.whereRaw.mock.calls
		expect(calls.some((c) => /birth_date <=/.test(c[0] as string))).toBe(true)
		expect(calls.some((c) => /birth_date >=/.test(c[0] as string))).toBe(true)
	})

	it('applies fame range via plain where', async () => {
		await browseFor('user-1', { limit: 10, minFame: 100, maxFame: 500 })

		expect(mainBuilder.where).toHaveBeenCalledWith('p.fame_rating', '>=', 100)
		expect(mainBuilder.where).toHaveBeenCalledWith('p.fame_rating', '<=', 500)
	})

	it('applies maxDistanceKm via haversine_km whereRaw', async () => {
		await browseFor('user-1', { limit: 10, maxDistanceKm: 50 })

		const calls = mainBuilder.whereRaw.mock.calls
		expect(
			calls.some(
				(c) => /haversine_km/.test(c[0] as string) && (c[1] as unknown[])?.includes(50),
			),
		).toBe(true)
	})

	it('skips maxDistanceKm when user has no GPS coords', async () => {
		mainBuilder.first.mockResolvedValueOnce({
			...ME_PROFILE,
			latitude: null,
			longitude: null,
		})

		await browseFor('user-1', { limit: 10, maxDistanceKm: 50 })

		const calls = mainBuilder.whereRaw.mock.calls
		// O `whereRaw` de filtro NUNCA deve incluir `<= 50` aqui.
		expect(calls.some((c) => /haversine_km.* <=/.test(c[0] as string))).toBe(false)
	})

	it('applies tags via whereExists subquery', async () => {
		await browseFor('user-1', { limit: 10, tags: ['vegan'] })

		expect(mainBuilder.whereExists).toHaveBeenCalled()
	})
})

const mkRow = (id: string) => ({
	id,
	username: `u${id}`,
	age: 30,
	gender: 'f',
	sexual_orientation: 'hetero',
	bio: null,
	fame_rating: 0,
	distance_km: 10,
	common_tags: 0,
	score: 0.1,
})

describe('browseFor — pagination + photo enrichment', () => {
	it('sets hasMore=true when row count exceeds limit', async () => {
		mainBuilder.limit.mockResolvedValueOnce(Array.from({ length: 11 }, (_, i) => mkRow(`u-${i}`)))

		const res = await browseFor('user-1', { limit: 10 })

		expect(res.items).toHaveLength(10)
		expect(res.hasMore).toBe(true)
	})

	it('attaches signed URL for the first ready photo per user', async () => {
		mainBuilder.limit.mockResolvedValueOnce([
			{ ...mkRow('u-1'), distance_km: 5.2, common_tags: 3 },
		])
		photosBuilder.select.mockResolvedValueOnce([{ user_id: 'u-1', key: 'u-1/photo-a' }])

		const res = await browseFor('user-1', { limit: 10 })

		expect(presignGet).toHaveBeenCalledWith('u-1/photo-a')
		expect(res.items[0]).toMatchObject({
			id: 'u-1',
			photoUrl: 'https://cdn.test/u-1/photo-a?sig=Z',
			distanceKm: 5.2,
			commonTags: 3,
		})
		expect(res.hasMore).toBe(false)
	})

	it('photoUrl is null when user has no ready photos', async () => {
		mainBuilder.limit.mockResolvedValueOnce([mkRow('u-2')])
		// photosBuilder.select default = []

		const res = await browseFor('user-1', { limit: 10 })

		expect(res.items[0]?.photoUrl).toBeNull()
		expect(presignGet).not.toHaveBeenCalled()
	})
})
