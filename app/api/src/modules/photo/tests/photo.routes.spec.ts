import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../utils/app-error.js'

vi.mock('../photo.service.js', () => ({
	presignPhoto: vi.fn(),
	confirmPhoto: vi.fn(),
	deletePhoto: vi.fn(),
	listPhotos: vi.fn(),
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
const photoService = await import('../photo.service.js')
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

const PHOTO = {
	id: 'photo-1',
	url: 'https://cdn.test/uploads/user-1/photo-1',
	mime: 'image/webp',
	bytes: 120000,
	status: 'ready' as const,
}

describe('GET /users/me/photos', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app).get('/users/me/photos')

		expect(res.status).toBe(401)
		expect(res.body.error.code).toBe('MISSING_TOKEN')
		expect(photoService.listPhotos).not.toHaveBeenCalled()
	})

	it('200 with { photos } when authenticated', async () => {
		vi.mocked(photoService.listPhotos).mockResolvedValueOnce([PHOTO])

		const res = await request(app)
			.get('/users/me/photos')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ photos: [PHOTO] })
		expect(photoService.listPhotos).toHaveBeenCalledWith('user-1')
	})
})

describe('POST /users/me/photos/presign', () => {
	it('401 MISSING_TOKEN when Authorization is absent', async () => {
		const res = await request(app)
			.post('/users/me/photos/presign')
			.send({ contentType: 'image/webp', size: 120000 })

		expect(res.status).toBe(401)
		expect(photoService.presignPhoto).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR for disallowed contentType', async () => {
		const res = await request(app)
			.post('/users/me/photos/presign')
			.set(...authHeader())
			.send({ contentType: 'image/gif', size: 120000 })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(photoService.presignPhoto).not.toHaveBeenCalled()
	})

	it('400 VALIDATION_ERROR for size above the limit', async () => {
		const res = await request(app)
			.post('/users/me/photos/presign')
			.set(...authHeader())
			.send({ contentType: 'image/webp', size: 999999999 })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
	})

	it('400 PHOTO_LIMIT_REACHED when service rejects due to limit', async () => {
		vi.mocked(photoService.presignPhoto).mockRejectedValueOnce(
			new AppError('PHOTO_LIMIT_REACHED', 400, 'limit'),
		)

		const res = await request(app)
			.post('/users/me/photos/presign')
			.set(...authHeader())
			.send({ contentType: 'image/webp', size: 120000 })

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('PHOTO_LIMIT_REACHED')
	})

	it('201 with photoId/uploadUrl/expiresAt on the happy path', async () => {
		vi.mocked(photoService.presignPhoto).mockResolvedValueOnce({
			photoId: 'photo-1',
			uploadUrl: 'https://minio.test/x?sig=y',
			expiresAt: '2026-05-30T12:05:00.000Z',
		})

		const res = await request(app)
			.post('/users/me/photos/presign')
			.set(...authHeader())
			.send({ contentType: 'image/webp', size: 120000 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			photoId: 'photo-1',
			uploadUrl: 'https://minio.test/x?sig=y',
		})
		expect(photoService.presignPhoto).toHaveBeenCalledWith('user-1', {
			contentType: 'image/webp',
			size: 120000,
		})
	})
})

describe('POST /users/me/photos/:id/confirm', () => {
	it('400 VALIDATION_ERROR for non-uuid id', async () => {
		const res = await request(app)
			.post('/users/me/photos/not-a-uuid/confirm')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(res.body.error.code).toBe('VALIDATION_ERROR')
		expect(photoService.confirmPhoto).not.toHaveBeenCalled()
	})

	it('404 PHOTO_NOT_FOUND when service rejects', async () => {
		vi.mocked(photoService.confirmPhoto).mockRejectedValueOnce(
			new AppError('PHOTO_NOT_FOUND', 404, 'nope'),
		)

		const res = await request(app)
			.post('/users/me/photos/4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21/confirm')
			.set(...authHeader())

		expect(res.status).toBe(404)
		expect(res.body.error.code).toBe('PHOTO_NOT_FOUND')
	})

	it('200 with the photo when service resolves', async () => {
		vi.mocked(photoService.confirmPhoto).mockResolvedValueOnce(PHOTO)

		const res = await request(app)
			.post('/users/me/photos/4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21/confirm')
			.set(...authHeader())

		expect(res.status).toBe(200)
		expect(res.body).toEqual(PHOTO)
		expect(photoService.confirmPhoto).toHaveBeenCalledWith(
			'user-1',
			'4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21',
		)
	})
})

describe('DELETE /users/me/photos/:id', () => {
	it('400 VALIDATION_ERROR for non-uuid id', async () => {
		const res = await request(app)
			.delete('/users/me/photos/not-a-uuid')
			.set(...authHeader())

		expect(res.status).toBe(400)
		expect(photoService.deletePhoto).not.toHaveBeenCalled()
	})

	it('204 No Content when service resolves', async () => {
		vi.mocked(photoService.deletePhoto).mockResolvedValueOnce(undefined)

		const res = await request(app)
			.delete('/users/me/photos/4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21')
			.set(...authHeader())

		expect(res.status).toBe(204)
		expect(photoService.deletePhoto).toHaveBeenCalledWith(
			'user-1',
			'4ec77f4f-2c10-4b2e-bd9e-8b3b9c5e7b21',
		)
	})
})
