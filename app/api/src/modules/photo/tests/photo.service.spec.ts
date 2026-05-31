import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	deleteObject,
	getRange,
	head,
	presignGet,
	presignPut,
} from '../../../common/services/s3.service.js'
import { AppError } from '../../../utils/app-error.js'
import { confirmPhoto, deletePhoto, listPhotos, presignPhoto } from '../photo.service.js'

vi.mock('../../../common/services/s3.service.js', () => ({
	presignPut: vi.fn(),
	presignGet: vi.fn(async (key: string) => `https://minio.test/${key}?sig=XYZ`),
	head: vi.fn(),
	getRange: vi.fn(),
	deleteObject: vi.fn(),
}))

vi.mock('file-type', () => ({
	fileTypeFromBuffer: vi.fn(),
}))

vi.mock('../../../common/services/completeness.service.js', () => ({
	recalculateCompleteness: vi.fn(),
}))

import { fileTypeFromBuffer } from 'file-type'
import { recalculateCompleteness } from '../../../common/services/completeness.service.js'

vi.mock('node:crypto', async () => {
	const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto')
	return { ...actual, randomUUID: vi.fn(() => 'photo-1') }
})

const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	whereIn: vi.fn(),
	whereNot: vi.fn(),
	orderBy: vi.fn(),
	select: vi.fn(),
	first: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	count: vi.fn(),
}))
const dbMock = vi.hoisted(() => {
	const fn = vi.fn() as ReturnType<typeof vi.fn> & {
		transaction: ReturnType<typeof vi.fn>
	}
	fn.transaction = vi.fn()
	return fn
})
vi.mock('../../../config/db.js', () => ({ db: dbMock }))

beforeEach(() => {
	vi.clearAllMocks()
	dbMock.mockReturnValue(dbBuilder)
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.whereIn.mockReturnValue(dbBuilder)
	dbBuilder.whereNot.mockReturnValue(dbBuilder)
	dbBuilder.orderBy.mockReturnValue(dbBuilder)
	dbBuilder.count.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
	dbBuilder.insert.mockResolvedValue([])
	dbBuilder.update.mockResolvedValue(1)
	dbBuilder.delete.mockResolvedValue(1)
	dbBuilder.select.mockResolvedValue([])

	vi.mocked(presignPut).mockResolvedValue({
		uploadUrl: 'https://minio.test/upload?sig=x',
		expiresAt: new Date('2026-05-30T12:05:00Z'),
	})
})

const PHOTO_ROW = {
	id: 'photo-1',
	user_id: 'user-1',
	key: 'user-1/photo-1',
	mime: 'image/webp',
	bytes: 120000,
	status: 'pending' as const,
	created_at: new Date('2026-05-30T12:00:00Z'),
}

describe('photoService.presignPhoto', () => {
	it('inserts a pending row and returns uploadUrl when user has fewer than 5 active photos', async () => {
		dbBuilder.first.mockResolvedValueOnce({ count: '2' })

		const res = await presignPhoto('user-1', { contentType: 'image/webp', size: 120000 })

		expect(presignPut).toHaveBeenCalledWith('user-1/photo-1', 'image/webp', 120000)
		expect(dbMock).toHaveBeenCalledWith('photos')
		expect(dbBuilder.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'photo-1',
				user_id: 'user-1',
				key: 'user-1/photo-1',
				mime: 'image/webp',
				bytes: 120000,
				status: 'pending',
			}),
		)
		expect(res).toEqual({
			photoId: 'photo-1',
			uploadUrl: 'https://minio.test/upload?sig=x',
			expiresAt: '2026-05-30T12:05:00.000Z',
		})
	})

	it('rejects with PHOTO_LIMIT_REACHED when user already has 5 active photos', async () => {
		dbBuilder.first.mockResolvedValueOnce({ count: '5' })

		await expect(
			presignPhoto('user-1', { contentType: 'image/webp', size: 120000 }),
		).rejects.toMatchObject({
			code: 'PHOTO_LIMIT_REACHED',
			status: 400,
		} as Partial<AppError>)

		expect(presignPut).not.toHaveBeenCalled()
		expect(dbBuilder.insert).not.toHaveBeenCalled()
	})
})

describe('photoService.confirmPhoto', () => {
	it('rejects PHOTO_NOT_FOUND when the photoId does not belong to the user', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(confirmPhoto('user-1', 'ghost')).rejects.toMatchObject({
			code: 'PHOTO_NOT_FOUND',
			status: 404,
		} as Partial<AppError>)
		expect(head).not.toHaveBeenCalled()
	})

	it('idempotent: already-ready photo returns signed URL without re-validating', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...PHOTO_ROW, status: 'ready' })

		const res = await confirmPhoto('user-1', 'photo-1')

		expect(head).not.toHaveBeenCalled()
		expect(getRange).not.toHaveBeenCalled()
		expect(presignGet).toHaveBeenCalledWith('user-1/photo-1')
		expect(res.status).toBe('ready')
		expect(res.url).toContain('sig=XYZ')
	})

	it('marks as failed and rejects when head returns null (object never uploaded)', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)
		vi.mocked(head).mockResolvedValueOnce(null)

		await expect(confirmPhoto('user-1', 'photo-1')).rejects.toMatchObject({
			code: 'PHOTO_NOT_UPLOADED',
			status: 404,
		} as Partial<AppError>)
		expect(dbBuilder.update).toHaveBeenCalledWith({ status: 'failed' })
		expect(deleteObject).not.toHaveBeenCalled()
	})

	it('marks failed + INVALID_FILE_TYPE when object metadata differs from declared', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)
		vi.mocked(head).mockResolvedValueOnce({
			contentLength: 999999,
			contentType: 'image/webp',
		})

		await expect(confirmPhoto('user-1', 'photo-1')).rejects.toMatchObject({
			code: 'INVALID_FILE_TYPE',
			status: 400,
		} as Partial<AppError>)
		expect(deleteObject).toHaveBeenCalledWith('user-1/photo-1')
		expect(dbBuilder.update).toHaveBeenCalledWith({ status: 'failed' })
	})

	it('marks failed + INVALID_FILE_TYPE when magic bytes do not match declared MIME', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)
		vi.mocked(head).mockResolvedValueOnce({
			contentLength: 120000,
			contentType: 'image/webp',
		})
		vi.mocked(getRange).mockResolvedValueOnce(Buffer.from('GIF87a...'))
		vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
			mime: 'image/gif',
			ext: 'gif',
		})

		await expect(confirmPhoto('user-1', 'photo-1')).rejects.toMatchObject({
			code: 'INVALID_FILE_TYPE',
			status: 400,
		} as Partial<AppError>)
		expect(deleteObject).toHaveBeenCalledWith('user-1/photo-1')
	})

	it('triggers recalculateCompleteness after marking ready', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)
		vi.mocked(head).mockResolvedValueOnce({
			contentLength: 120000,
			contentType: 'image/webp',
		})
		vi.mocked(getRange).mockResolvedValueOnce(Buffer.from('RIFF....WEBP'))
		vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
			mime: 'image/webp',
			ext: 'webp',
		})

		await confirmPhoto('user-1', 'photo-1')

		expect(recalculateCompleteness).toHaveBeenCalledWith('user-1')
	})

	it('marks ready and returns photo with signed URL when everything matches', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)
		vi.mocked(head).mockResolvedValueOnce({
			contentLength: 120000,
			contentType: 'image/webp',
		})
		vi.mocked(getRange).mockResolvedValueOnce(Buffer.from('RIFF....WEBP'))
		vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
			mime: 'image/webp',
			ext: 'webp',
		})

		const res = await confirmPhoto('user-1', 'photo-1')

		expect(dbBuilder.update).toHaveBeenCalledWith({ status: 'ready' })
		expect(presignGet).toHaveBeenCalledWith('user-1/photo-1')
		expect(res).toEqual({
			id: 'photo-1',
			url: 'https://minio.test/user-1/photo-1?sig=XYZ',
			mime: 'image/webp',
			bytes: 120000,
			status: 'ready',
		})
	})
})

describe('photoService.deletePhoto', () => {
	it('rejects PHOTO_NOT_FOUND when id does not belong to the user', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(deletePhoto('user-1', 'ghost')).rejects.toMatchObject({
			code: 'PHOTO_NOT_FOUND',
			status: 404,
		} as Partial<AppError>)
		expect(deleteObject).not.toHaveBeenCalled()
	})

	it('calls s3.delete and removes the row', async () => {
		dbBuilder.first.mockResolvedValueOnce(PHOTO_ROW)

		await deletePhoto('user-1', 'photo-1')

		expect(deleteObject).toHaveBeenCalledWith('user-1/photo-1')
		expect(dbBuilder.delete).toHaveBeenCalled()
	})
})

describe('photoService.listPhotos', () => {
	it('returns user photos with per-item signed URL (excluding failed)', async () => {
		dbBuilder.select.mockResolvedValueOnce([
			{ ...PHOTO_ROW, status: 'ready' },
			{ ...PHOTO_ROW, id: 'photo-2', key: 'user-1/photo-2', status: 'pending' },
		])

		const res = await listPhotos('user-1')

		expect(dbBuilder.where).toHaveBeenCalledWith({ user_id: 'user-1' })
		expect(dbBuilder.whereNot).toHaveBeenCalledWith({ status: 'failed' })
		expect(res).toHaveLength(2)
		expect(presignGet).toHaveBeenCalledTimes(2)
		expect(presignGet).toHaveBeenCalledWith('user-1/photo-1')
		expect(presignGet).toHaveBeenCalledWith('user-1/photo-2')
		expect(res[0]?.url).toContain('sig=XYZ')
		expect(res[1]?.url).toContain('sig=XYZ')
	})
})
