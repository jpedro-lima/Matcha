import { z } from 'zod'
import { env } from '../../config/env.js'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

export const presignBodySchema = z
	.object({
		contentType: z.enum(ALLOWED_MIME),
		size: z
			.number()
			.int()
			.positive()
			.max(env.MAX_PHOTO_SIZE_MB * 1024 * 1024),
	})
	.strict()
export type PresignBody = z.infer<typeof presignBodySchema>

export const photoIdParamsSchema = z.object({
	id: z.uuid(),
})
export type PhotoIdParams = z.infer<typeof photoIdParamsSchema>
