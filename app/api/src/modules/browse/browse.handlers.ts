import type { RequestHandler } from 'express'
import { AppError } from '../../utils/app-error.js'
import {
	SEARCH_CRITERIA_KEYS,
	type BrowseQuery,
	type SearchQuery,
} from './browse.schemas.js'
import { browseFor } from './browse.service.js'

export const getBrowse: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const filters = req.query as unknown as BrowseQuery
	const result = await browseFor(req.user.id, filters)
	res.json(result)
}

export const getSearch: RequestHandler = async (req, res) => {
	if (!req.user) throw new AppError('MISSING_TOKEN', 401, 'Missing token.')

	const filters = req.query as unknown as SearchQuery
	const hasCriterion = SEARCH_CRITERIA_KEYS.some((k) => filters[k] !== undefined)
	if (!hasCriterion) {
		throw new AppError(
			'SEARCH_NO_CRITERIA',
			400,
			'At least one search criterion is required.',
		)
	}

	const result = await browseFor(req.user.id, filters)
	res.json(result)
}
