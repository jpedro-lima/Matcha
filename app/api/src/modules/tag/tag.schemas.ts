import { z } from 'zod'

const MAX_TAGS_PER_USER = 20
const TAG_NAME_RE = /^[a-z0-9-]+$/

export const tagNameSchema = z
	.string()
	.trim()
	.transform((s) => s.replace(/^#+/, '').toLowerCase())
	.pipe(
		z
			.string()
			.min(1, 'Tag name must not be empty.')
			.max(40)
			.regex(TAG_NAME_RE, 'Tag name must be lowercase alphanumeric or hyphen.'),
	)

export const putTagsBodySchema = z
	.object({ tags: z.array(tagNameSchema).max(MAX_TAGS_PER_USER) })
	.strict()
export type PutTagsBody = z.infer<typeof putTagsBodySchema>

export const tagsQuerySchema = z.object({
	query: z
		.string()
		.trim()
		.transform((s) => s.replace(/^#+/, '').toLowerCase())
		.pipe(
			z
				.string()
				.min(1)
				.max(40)
				.regex(/^[a-z0-9-]+$/),
		),
})
export type TagsQuery = z.infer<typeof tagsQuerySchema>
