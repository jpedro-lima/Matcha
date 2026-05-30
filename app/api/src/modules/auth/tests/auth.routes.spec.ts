import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../utils/app-error.js'

// Mocks the whole auth service — integration test focuses on the HTTP path
// (validate, error handler, cookies, status codes). Business logic is already
// covered by `auth.service.spec.ts`.
vi.mock('../auth.service.js', () => ({
	register: vi.fn(),
	verifyEmail: vi.fn(),
	login: vi.fn(),
	refresh: vi.fn(),
	logout: vi.fn(),
	forgotPassword: vi.fn(),
	resetPassword: vi.fn(),
	resendVerificationEmail: vi.fn(),
	getCurrentUser: vi.fn(),
}))

// requireAuth depends on jwt-service; we mock it to avoid real JWT signing
vi.mock('../../../common/services/jwt.service.js', () => ({
	signAccess: vi.fn(),
	signRefresh: vi.fn(),
	verifyAccess: vi.fn(),
	verifyRefresh: vi.fn(),
}))

// Disables rate limit for the integration test: 5 calls/15 min would
// accumulate between `it`s (same loopback IP). Limit coverage will live in
// its own spec.
vi.mock('express-rate-limit', () => ({
	default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// db is only used by `/auth/me` — we return a fake user
const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	first: vi.fn(),
}))
const dbMock = vi.hoisted(() => vi.fn(() => dbBuilder))
vi.mock('../../../config/db.js', () => ({ db: dbMock, closeDb: vi.fn() }))

const { app } = await import('../../../app.js')
const authService = await import('../auth.service.js')
const jwtService = await import('../../../common/services/jwt.service.js')

beforeEach(() => {
	vi.clearAllMocks()
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
})

const validRegister = {
	email: 'new@matcha.local',
	username: 'newuser',
	firstName: 'New',
	lastName: 'User',
	password: 'Forte#2026!',
}

describe('POST /auth/register', () => {
	it('400 VALIDATION_ERROR when the body is empty', async () => {
		const res = await request(app).post('/auth/register').send({})

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(Array.isArray(res.body.error.details)).toBe(true)
		expect(authService.register).not.toHaveBeenCalled()
	})

	it('201 + user in the body when the service resolves with emailSent=true', async () => {
		vi.mocked(authService.register).mockResolvedValueOnce({
			user: {
				id: 'user-1',
				email: validRegister.email,
				username: validRegister.username,
				emailVerified: false,
			},
			emailSent: true,
		})

		const res = await request(app).post('/auth/register').send(validRegister)

		expect(res.status).toBe(201)
		expect(res.body.user).toEqual({
			id: 'user-1',
			email: validRegister.email,
			username: validRegister.username,
			emailVerified: false,
		})
		expect(authService.register).toHaveBeenCalledWith(validRegister)
	})

	it('202 with hint to resend when SMTP failed but the user was created', async () => {
		vi.mocked(authService.register).mockResolvedValueOnce({
			user: {
				id: 'user-1',
				email: validRegister.email,
				username: validRegister.username,
				emailVerified: false,
			},
			emailSent: false,
		})

		const res = await request(app).post('/auth/register').send(validRegister)

		expect(res.status).toBe(202)
		expect(res.body.user.id).toBe('user-1')
		expect(res.body.message).toMatch(/resend-verification/)
	})

	it('409 EMAIL_EXISTS when service throws AppError', async () => {
		vi.mocked(authService.register).mockRejectedValueOnce(
			new AppError('EMAIL_EXISTS', 409, 'already exists'),
		)

		const res = await request(app).post('/auth/register').send(validRegister)

		expect(res.status).toBe(409)
		expect(res.body.error.code).toBe('EMAIL_EXISTS')
	})
})

describe('POST /auth/resend-verification', () => {
	it('400 VALIDATION_ERROR when the email field is missing', async () => {
		const res = await request(app).post('/auth/resend-verification').send({})

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(authService.resendVerificationEmail).not.toHaveBeenCalled()
	})

	it('200 with a neutral message when the service resolves', async () => {
		vi.mocked(authService.resendVerificationEmail).mockResolvedValueOnce(undefined)

		const res = await request(app)
			.post('/auth/resend-verification')
			.send({ email: 'anyone@x.com' })

		expect(res.status).toBe(200)
		expect(res.body.message).toMatch(/verification link/i)
		expect(authService.resendVerificationEmail).toHaveBeenCalledWith('anyone@x.com')
	})
})

describe('POST /auth/login', () => {
	it('200 + accessToken in the body and refresh in httpOnly cookie', async () => {
		vi.mocked(authService.login).mockResolvedValueOnce({
			accessToken: 'access-jwt',
			refreshToken: 'refresh-jwt',
			user: { id: 'u1', username: 'ana', email: 'ana@x.com' },
		})

		const res = await request(app)
			.post('/auth/login')
			.send({ username: 'ana', password: 'Forte#2026!' })

		expect(res.status).toBe(200)
		expect(res.body.accessToken).toBe('access-jwt')
		expect(res.body.user.username).toBe('ana')

		const setCookie = res.headers['set-cookie'] as unknown as string[]
		expect(setCookie.some((c) => c.startsWith('matcha_refresh=refresh-jwt'))).toBe(true)
		expect(setCookie.some((c) => c.toLowerCase().includes('httponly'))).toBe(true)
	})

	it('401 INVALID_CREDENTIALS when service throws', async () => {
		vi.mocked(authService.login).mockRejectedValueOnce(
			new AppError('INVALID_CREDENTIALS', 401, 'invalid'),
		)

		const res = await request(app)
			.post('/auth/login')
			.send({ username: 'x', password: 'y' })

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
	})
})

describe('POST /auth/refresh', () => {
	it('401 REFRESH_INVALID when the cookie is missing', async () => {
		const res = await request(app).post('/auth/refresh')

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('REFRESH_INVALID')
		expect(authService.refresh).not.toHaveBeenCalled()
	})

	it('200 with new accessToken when service resolves', async () => {
		vi.mocked(authService.refresh).mockResolvedValueOnce({
			accessToken: 'new-access',
			refreshToken: 'new-refresh',
			user: { id: 'u1', username: 'ana', email: 'ana@x.com' },
		})

		const res = await request(app)
			.post('/auth/refresh')
			.set('Cookie', ['matcha_refresh=old-refresh'])

		expect(res.status).toBe(200)
		expect(res.body.accessToken).toBe('new-access')
		expect(authService.refresh).toHaveBeenCalledWith('old-refresh')
	})
})

describe('POST /auth/logout', () => {
	it('204 and clears the cookie', async () => {
		const res = await request(app)
			.post('/auth/logout')
			.set('Cookie', ['matcha_refresh=whatever'])

		expect(res.status).toBe(204)
		const setCookie = res.headers['set-cookie'] as unknown as string[]
		expect(setCookie.some((c) => c.startsWith('matcha_refresh=;'))).toBe(true)
	})
})

describe('POST /auth/forgot-password', () => {
	it('200 even when the service throws nothing', async () => {
		vi.mocked(authService.forgotPassword).mockResolvedValueOnce(undefined)

		const res = await request(app)
			.post('/auth/forgot-password')
			.send({ email: 'anyone@x.com' })

		expect(res.status).toBe(200)
	})
})

describe('GET /auth/me', () => {
	it('401 MISSING_TOKEN when Authorization is missing', async () => {
		const res = await request(app).get('/auth/me')

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('MISSING_TOKEN')
	})

	it('200 with user when the token is valid', async () => {
		vi.mocked(jwtService.verifyAccess).mockReturnValueOnce({
			sub: 'user-1',
			username: 'ana',
			aud: 'matcha:access',
		} as ReturnType<typeof jwtService.verifyAccess>)

		vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({
			id: 'user-1',
			username: 'ana',
			email: 'ana@x.com',
			emailVerified: true,
		})

		const res = await request(app).get('/auth/me').set('Authorization', 'Bearer fake-jwt')

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: 'user-1',
			username: 'ana',
			email: 'ana@x.com',
			emailVerified: true,
		})
		expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1')
	})
})
