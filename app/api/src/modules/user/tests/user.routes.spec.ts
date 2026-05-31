import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../utils/app-error.js'

// Mock the whole user service — integration test focuses on HTTP wiring
// (validate, requireAuth, error handler, status codes).
vi.mock('../user.service.js', () => ({
	getProfile: vi.fn(),
	updateUser: vi.fn(),
	updateLocation: vi.fn(),
}))

// requireAuth uses jwt.service — mock para evitar assinatura real.
vi.mock('../../../common/services/jwt.service.js', () => ({
	signAccess: vi.fn(),
	signRefresh: vi.fn(),
	verifyAccess: vi.fn(),
	verifyRefresh: vi.fn(),
}))

// Disables rate limit (não há na rota de user mas o module-level mock
// vale para todas as integrações de http).
vi.mock('express-rate-limit', () => ({
	default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// db é usado por outras rotas montadas; só precisamos do mock pra não
// falhar o import de `app`.
const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	first: vi.fn(),
}))
const dbMock = vi.hoisted(() => vi.fn(() => dbBuilder))
vi.mock('../../../config/db.js', () => ({ db: dbMock, closeDb: vi.fn() }))

const { app } = await import('../../../app.js')
const userService = await import('../user.service.js')
const jwtService = await import('../../../common/services/jwt.service.js')

beforeEach(() => {
	vi.clearAllMocks()
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
})

const PROFILE_PAYLOAD = {
	user: { id: 'user-1', email: 'ana@x.com', username: 'ana', emailVerified: true },
	profile: {
		bio: 'oi',
		gender: 'f' as const,
		sexualOrientation: 'bi' as const,
		birthDate: '2000-01-15',
		location: {
			latitude: null,
			longitude: null,
			city: null,
			neighborhood: null,
			consent: null,
		},
		fameRating: 0,
		lastActive: '2026-05-30T12:00:00.000Z',
		isOnline: false,
		profileCompletedAt: null,
		createdAt: '2026-05-30T12:00:00.000Z',
		updatedAt: '2026-05-30T12:00:00.000Z',
	},
}

describe('GET /users/me', () => {
	it('401 MISSING_TOKEN when Authorization header is absent', async () => {
		const res = await request(app).get('/users/me')

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('MISSING_TOKEN')
		expect(userService.getProfile).not.toHaveBeenCalled()
	})

	it('200 with { user, profile } when token is valid', async () => {
		vi.mocked(jwtService.verifyAccess).mockReturnValueOnce({
			sub: 'user-1',
			username: 'ana',
			aud: 'matcha:access',
		} as ReturnType<typeof jwtService.verifyAccess>)
		vi.mocked(userService.getProfile).mockResolvedValueOnce(PROFILE_PAYLOAD)

		const res = await request(app)
			.get('/users/me')
			.set('Authorization', 'Bearer fake-jwt')

		expect(res.status).toBe(200)
		expect(res.body).toEqual(PROFILE_PAYLOAD)
		expect(userService.getProfile).toHaveBeenCalledWith('user-1')
	})
})

describe('PATCH /users/me', () => {
	const authHeader = (): [string, string] => {
		vi.mocked(jwtService.verifyAccess).mockReturnValueOnce({
			sub: 'user-1',
			username: 'ana',
			aud: 'matcha:access',
		} as ReturnType<typeof jwtService.verifyAccess>)
		return ['Authorization', 'Bearer fake-jwt']
	}

	it('401 MISSING_TOKEN when Authorization header is absent', async () => {
		const res = await request(app).patch('/users/me').send({ bio: 'oi' })

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('MISSING_TOKEN')
		expect(userService.updateUser).not.toHaveBeenCalled()
	})

	it('200 + updated profile when service resolves', async () => {
		vi.mocked(userService.updateUser).mockResolvedValueOnce(PROFILE_PAYLOAD)

		const res = await request(app)
			.patch('/users/me')
			.set(...authHeader())
			.send({ bio: 'novo' })

		expect(res.status).toBe(200)
		expect(res.body).toEqual(PROFILE_PAYLOAD)
		expect(userService.updateUser).toHaveBeenCalledWith('user-1', { bio: 'novo' })
	})

	it('400 VALIDATION_ERROR for unknown fields (strict schema)', async () => {
		const res = await request(app)
			.patch('/users/me')
			.set(...authHeader())
			.send({ unknownField: 'x' })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(userService.updateUser).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR for malformed birthDate', async () => {
		const res = await request(app)
			.patch('/users/me')
			.set(...authHeader())
			.send({ birthDate: '15/01/2000' })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('409 EMAIL_EXISTS when service throws AppError', async () => {
		vi.mocked(userService.updateUser).mockRejectedValueOnce(
			new AppError('EMAIL_EXISTS', 409, 'taken'),
		)

		const res = await request(app)
			.patch('/users/me')
			.set(...authHeader())
			.send({ email: 'taken@x.com' })

		expect(res.status).toBe(409)
		expect(res.body.error.code).toBe('EMAIL_EXISTS')
	})
})

describe('PATCH /users/me/location', () => {
	const authHeader = (): [string, string] => {
		vi.mocked(jwtService.verifyAccess).mockReturnValueOnce({
			sub: 'user-1',
			username: 'ana',
			aud: 'matcha:access',
		} as ReturnType<typeof jwtService.verifyAccess>)
		return ['Authorization', 'Bearer fake-jwt']
	}

	it('401 MISSING_TOKEN when Authorization header is absent', async () => {
		const res = await request(app)
			.patch('/users/me/location')
			.send({ consent: true, latitude: 0, longitude: 0 })

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('MISSING_TOKEN')
		expect(userService.updateLocation).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR when consent discriminator is missing', async () => {
		const res = await request(app)
			.patch('/users/me/location')
			.set(...authHeader())
			.send({ latitude: 0, longitude: 0 })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(userService.updateLocation).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR when consent=true and latitude is out of range', async () => {
		const res = await request(app)
			.patch('/users/me/location')
			.set(...authHeader())
			.send({ consent: true, latitude: 91, longitude: 0 })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 VALIDATION_ERROR when consent=false without city', async () => {
		const res = await request(app)
			.patch('/users/me/location')
			.set(...authHeader())
			.send({ consent: false, neighborhood: 'X' })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('200 with updated profile on consent=true (GPS)', async () => {
		vi.mocked(userService.updateLocation).mockResolvedValueOnce(PROFILE_PAYLOAD)

		const res = await request(app)
			.patch('/users/me/location')
			.set(...authHeader())
			.send({ consent: true, latitude: -23.55, longitude: -46.63 })

		expect(res.status).toBe(200)
		expect(res.body).toEqual(PROFILE_PAYLOAD)
		expect(userService.updateLocation).toHaveBeenCalledWith('user-1', {
			consent: true,
			latitude: -23.55,
			longitude: -46.63,
		})
	})

	it('200 with updated profile on consent=false (manual)', async () => {
		vi.mocked(userService.updateLocation).mockResolvedValueOnce(PROFILE_PAYLOAD)

		const res = await request(app)
			.patch('/users/me/location')
			.set(...authHeader())
			.send({ consent: false, city: 'Sao Paulo', neighborhood: 'Vila Madalena' })

		expect(res.status).toBe(200)
		expect(userService.updateLocation).toHaveBeenCalledWith('user-1', {
			consent: false,
			city: 'Sao Paulo',
			neighborhood: 'Vila Madalena',
		})
	})
})
