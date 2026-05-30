import type { RequestHandler } from 'express'
import { AppError } from '../../utils/app-error.js'
import type { LocationBody, UpdateUserBody } from './user.schemas.js'
import { getProfile, updateLocation, updateUser } from './user.service.js'

export const getMe: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const result = await getProfile(req.user.id)
	res.json(result)
}

export const patchMe: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const result = await updateUser(req.user.id, req.body as UpdateUserBody)
	res.json(result)
}

export const patchLocation: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const result = await updateLocation(req.user.id, req.body as LocationBody)
	res.json(result)
}
