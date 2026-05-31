import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../tag.service.js', () => ({
	getUserTags: vi.fn(),
	replaceUserTags: vi.fn(),
	searchTags: vi.fn(),
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
const tagService = await import('../tag.service.js')
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

describe('GET /users/me/tags', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app).get('/users/me/tags')

		expect(res.status).toBe(401)
		expect(tagService.getUserTags).not.toHaveBeenCalled()
	})

	it('200 with { tags } when authenticated', async () => {
		vi.mocked(tagService.getUserTags).mockResolvedValueOnce([{ id: 1, name: 'music' }])

		const res = await request(app)
			.get('/users/me/tags')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ tags: [{ id: 1, name: 'music' }] })
		expect(tagService.getUserTags).toHaveBeenCalledWith('user-1')
	})
})

describe('PUT /users/me/tags', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app)
			.put('/users/me/tags')
			.send({ tags: ['music'] })

		expect(res.status).toBe(401)
		expect(tagService.replaceUserTags).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR when body is not { tags: [...] }', async () => {
		const res = await request(app)
			.put('/users/me/tags')
			.set(...authHeader())
			.send({ list: ['music'] })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 VALIDATION_ERROR for tag with invalid characters', async () => {
		const res = await request(app)
			.put('/users/me/tags')
			.set(...authHeader())
			.send({ tags: ['hello world'] })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('normalizes names (lowercase, strip #) before calling the service', async () => {
		vi.mocked(tagService.replaceUserTags).mockResolvedValueOnce([
			{ id: 7, name: 'music' },
			{ id: 8, name: 'vegan' },
		])

		const res = await request(app)
			.put('/users/me/tags')
			.set(...authHeader())
			.send({ tags: ['#Music', 'MUSIC', 'vegan'] })

		expect(res.status).toBe(200)
		// Service recebe nomes já normalizados — dedupe é feita lá dentro.
		expect(tagService.replaceUserTags).toHaveBeenCalledWith('user-1', [
			'music',
			'music',
			'vegan',
		])
	})

	it('200 with empty array clears the user tags', async () => {
		vi.mocked(tagService.replaceUserTags).mockResolvedValueOnce([])

		const res = await request(app)
			.put('/users/me/tags')
			.set(...authHeader())
			.send({ tags: [] })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ tags: [] })
	})
})

describe('GET /tags', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app).get('/tags?query=mu')

		expect(res.status).toBe(401)
		expect(tagService.searchTags).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR when query is missing', async () => {
		const res = await request(app)
			.get('/tags')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 VALIDATION_ERROR for query with LIKE wildcards (%, _)', async () => {
		const res = await request(app)
			.get('/tags?query=%25')
			.set(...authHeader())

		expect(res.status).toBe(400)
	})

	it('200 with autocomplete matches (normalized query)', async () => {
		vi.mocked(tagService.searchTags).mockResolvedValueOnce([{ id: 1, name: 'music' }])

		const res = await request(app)
			.get('/tags?query=MU')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ tags: [{ id: 1, name: 'music' }] })
		expect(tagService.searchTags).toHaveBeenCalledWith('mu')
	})
})
