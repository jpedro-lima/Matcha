import { z } from 'zod'
import { tagNameSchema } from '../tag/tag.schemas.js'

// Express devolve query como string sempre, ou array de strings quando
// repetido (?tags=a&tags=b). Coerções via z.coerce + preprocess pra
// uniformizar array.
const tagsField = z.preprocess(
	(v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]),
	z.array(tagNameSchema).max(20).optional(),
)

const ageField = z.coerce.number().int().min(18).max(100)
const fameField = z.coerce.number().int().min(0).max(10_000)

export const browseQuerySchema = z
	.object({
		minAge: ageField.optional(),
		maxAge: ageField.optional(),
		minFame: fameField.optional(),
		maxFame: fameField.optional(),
		maxDistanceKm: z.coerce.number().positive().max(20_000).optional(),
		tags: tagsField,
		limit: z.coerce.number().int().min(1).max(50).default(10),
	})
	.strict()
	.refine(
		(d) => d.minAge === undefined || d.maxAge === undefined || d.minAge <= d.maxAge,
		{ message: 'minAge must be <= maxAge', path: ['minAge'] },
	)
	.refine(
		(d) => d.minFame === undefined || d.maxFame === undefined || d.minFame <= d.maxFame,
		{ message: 'minFame must be <= maxFame', path: ['minFame'] },
	)
export type BrowseQuery = z.infer<typeof browseQuerySchema>

// /search reaproveita o schema acima — o handler valida "≥ 1 critério"
// e lança SEARCH_NO_CRITERIA, não VALIDATION_ERROR.
export const searchQuerySchema = browseQuerySchema
export type SearchQuery = z.infer<typeof searchQuerySchema>

export const SEARCH_CRITERIA_KEYS = [
	'minAge',
	'maxAge',
	'minFame',
	'maxFame',
	'maxDistanceKm',
	'tags',
] as const
