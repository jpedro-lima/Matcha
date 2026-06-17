import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../utils/app-error.js'

vi.mock('../browse.service.js', () => ({
	browseFor: vi.fn(),
}))

vi.mock('../../../common/services/jwt.service.js', () => ({
	signAccess: vi.fn(),
	signRefresh: vi.fn(),
	verifyAccess: vi.fn(),
	verifyRefresh: vi.fn(),
}))

vi.mock('express-rate-limit', () => ({
	default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	first: vi.fn(),
}))
const dbMock = vi.hoisted(() => vi.fn(() => dbBuilder))
vi.mock('../../../config/db.js', () => ({ db: dbMock, closeDb: vi.fn() }))

const { app } = await import('../../../app.js')
const browseService = await import('../browse.service.js')
const jwtService = await import('../../../common/services/jwt.service.js')

beforeEach(() => {
	vi.clearAllMocks()
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
})

const authHeader = (): [string, string] => {
	vi.mocked(jwtService.verifyAccess).mockReturnValueOnce({
		sub: 'user-1',
		username: 'ana',
		aud: 'matcha:access',
	} as ReturnType<typeof jwtService.verifyAccess>)
	return ['Authorization', 'Bearer fake-jwt']
}

const RESULT = {
	items: [
		{
			id: 'u-1',
			username: 'a',
			age: 30,
			gender: 'f' as const,
			sexualOrientation: 'hetero' as const,
			bio: null,
			distanceKm: 5,
			commonTags: 1,
			fameRating: 0,
			photoUrl: 'https://cdn.test/x?sig=1',
		},
	],
	hasMore: false,
}

describe('GET /browse', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app).get('/browse')

		expect(res.status).toBe(401)
		expect(browseService.browseFor).not.toHaveBeenCalled()
	})

	it('200 with { items, hasMore } when authenticated', async () => {
		vi.mocked(browseService.browseFor).mockResolvedValueOnce(RESULT)

		const res = await request(app)
			.get('/browse')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(res.body).toEqual(RESULT)
		expect(browseService.browseFor).toHaveBeenCalledWith('user-1', { limit: 10 })
	})

	it('coerces numeric query params via z.coerce', async () => {
		vi.mocked(browseService.browseFor).mockResolvedValueOnce(RESULT)

		await request(app)
			.get('/browse?minAge=25&maxAge=35&maxDistanceKm=50&limit=5')
			.set(...authHeader())

		expect(browseService.browseFor).toHaveBeenCalledWith('user-1', {
			minAge: 25,
			maxAge: 35,
			maxDistanceKm: 50,
			limit: 5,
		})
	})

	it('400 VALIDATION_ERROR for limit > 50', async () => {
		const res = await request(app)
			.get('/browse?limit=999')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 VALIDATION_ERROR when minAge > maxAge', async () => {
		const res = await request(app)
			.get('/browse?minAge=40&maxAge=25')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 VALIDATION_ERROR for tag with LIKE wildcard (%)', async () => {
		const res = await request(app)
			.get('/browse?tags=%25')
			.set(...authHeader())

		expect(res.status).toBe(400)
	})

	it('parses repeated ?tags=a&tags=b into array', async () => {
		vi.mocked(browseService.browseFor).mockResolvedValueOnce(RESULT)

		await request(app)
			.get('/browse?tags=vegan&tags=music')
			.set(...authHeader())

		expect(browseService.browseFor).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({ tags: ['vegan', 'music'] }),
		)
	})

	it('400 PROFILE_INCOMPLETE when service rejects', async () => {
		vi.mocked(browseService.browseFor).mockRejectedValueOnce(
			new AppError('PROFILE_INCOMPLETE', 400, 'nope'),
		)

		const res = await request(app)
			.get('/browse')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('PROFILE_INCOMPLETE')
	})
})

describe('GET /search', () => {
	it('401 without auth', async () => {
		const res = await request(app).get('/search?minAge=25')
		expect(res.status).toBe(401)
	})

	it('400 SEARCH_NO_CRITERIA when no filter is provided', async () => {
		const res = await request(app)
			.get('/search')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('SEARCH_NO_CRITERIA')
		expect(browseService.browseFor).not.toHaveBeenCalled()
	})

	it('200 with criterion present', async () => {
		vi.mocked(browseService.browseFor).mockResolvedValueOnce(RESULT)

		const res = await request(app)
			.get('/search?minAge=25')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(browseService.browseFor).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({ minAge: 25 }),
		)
	})
})
