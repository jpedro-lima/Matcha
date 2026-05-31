import type { RequestHandler } from 'express'
import { AppError } from '../../utils/app-error.js'
import type { PutTagsBody, TagsQuery } from './tag.schemas.js'
import { getUserTags, replaceUserTags, searchTags } from './tag.service.js'

export const getMyTags: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const tags = await getUserTags(req.user.id)
	res.json({ tags })
}

export const putMyTags: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const body = req.body as PutTagsBody
	const tags = await replaceUserTags(req.user.id, body.tags)
	res.json({ tags })
}

export const getTagsAutocomplete: RequestHandler = async (req, res) => {
	const { query } = req.query as unknown as TagsQuery
	const tags = await searchTags(query)
	res.json({ tags })
}
