import type { RequestHandler } from 'express'
import { AppError } from '../../utils/app-error.js'
import type { PhotoIdParams, PresignBody } from './photo.schemas.js'
import { confirmPhoto, deletePhoto, listPhotos, presignPhoto } from './photo.service.js'

export const getPhotos: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const result = await listPhotos(req.user.id)
	res.json({ photos: result })
}

export const postPresign: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const result = await presignPhoto(req.user.id, req.body as PresignBody)
	res.status(201).json(result)
}

export const postConfirm: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const { id } = req.params as PhotoIdParams
	const result = await confirmPhoto(req.user.id, id)
	res.json(result)
}

export const deletePhotoHandler: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const { id } = req.params as PhotoIdParams
	await deletePhoto(req.user.id, id)
	res.status(204).end()
}
