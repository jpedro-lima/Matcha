import { randomUUID } from 'node:crypto'
import { fileTypeFromBuffer } from 'file-type'
import {
	deleteObject,
	getRange,
	head,
	presignGet,
	presignPut,
} from '../../common/services/s3.service.js'
import { db } from '../../config/db.js'
import { AppError } from '../../utils/app-error.js'
import type { PresignBody } from './photo.schemas.js'
import type { Photo, PhotoRow } from './photo.types.js'
import { photoFromRow } from './photo.types.js'

const MAX_PHOTOS = 5
const ACTIVE_STATUSES = ['pending', 'ready'] as const

export type PresignResult = {
	photoId: string
	uploadUrl: string
	expiresAt: string
}

export async function presignPhoto(
	userId: string,
	input: PresignBody,
): Promise<PresignResult> {
	const row = await db('photos')
		.where({ user_id: userId })
		.whereIn('status', [...ACTIVE_STATUSES])
		.count<{ count: string }>({ count: '*' })
		.first()
	const count = Number(row?.count ?? 0)
	if (count >= MAX_PHOTOS) {
		throw new AppError('PHOTO_LIMIT_REACHED', 400, 'Maximum number of photos reached.')
	}

	const photoId = randomUUID()
	const key = `${userId}/${photoId}`
	const { uploadUrl, expiresAt } = await presignPut(key, input.contentType, input.size)

	await db('photos').insert({
		id: photoId,
		user_id: userId,
		key,
		mime: input.contentType,
		bytes: input.size,
		status: 'pending',
	})

	return { photoId, uploadUrl, expiresAt: expiresAt.toISOString() }
}

export async function confirmPhoto(userId: string, photoId: string): Promise<Photo> {
	const row = await db('photos').where({ id: photoId, user_id: userId }).first<PhotoRow>()
	if (!row) throw new AppError('PHOTO_NOT_FOUND', 404, 'Photo not found.')

	if (row.status === 'ready') {
		const url = await presignGet(row.key)
		return photoFromRow(row, url)
	}
	if (row.status === 'failed')
		throw new AppError('PHOTO_NOT_FOUND', 404, 'Photo not found.')

	const meta = await head(row.key)
	if (!meta) {
		await db('photos').where({ id: photoId }).update({ status: 'failed' })
		throw new AppError('PHOTO_NOT_UPLOADED', 404, 'Uploaded object not found.')
	}

	if (meta.contentLength !== row.bytes || meta.contentType !== row.mime) {
		await deleteObject(row.key)
		await db('photos').where({ id: photoId }).update({ status: 'failed' })
		throw new AppError(
			'INVALID_FILE_TYPE',
			400,
			'Uploaded file does not match declared metadata.',
		)
	}

	const head32 = await getRange(row.key, 32)
	const detected = await fileTypeFromBuffer(head32)
	if (!detected || detected.mime !== row.mime) {
		await deleteObject(row.key)
		await db('photos').where({ id: photoId }).update({ status: 'failed' })
		throw new AppError(
			'INVALID_FILE_TYPE',
			400,
			'File content does not match declared type.',
		)
	}

	await db('photos').where({ id: photoId }).update({ status: 'ready' })
	const url = await presignGet(row.key)
	return photoFromRow({ ...row, status: 'ready' }, url)
}

export async function deletePhoto(userId: string, photoId: string): Promise<void> {
	const row = await db('photos').where({ id: photoId, user_id: userId }).first<PhotoRow>()
	if (!row) throw new AppError('PHOTO_NOT_FOUND', 404, 'Photo not found.')

	await deleteObject(row.key)
	await db('photos').where({ id: photoId }).delete()
}

export async function listPhotos(userId: string): Promise<Photo[]> {
	const rows = await db('photos')
		.where({ user_id: userId })
		.whereNot({ status: 'failed' })
		.orderBy('created_at', 'asc')
		.select<PhotoRow[]>('*')

	const urls = await Promise.all(rows.map((r) => presignGet(r.key)))
	return rows.map((row, i) => photoFromRow(row, urls[i] as string))
}
