import { z } from 'zod'
import {
	genderSchema,
	sexualOrientationSchema,
} from '../../common/schemas/profile.schemas.js'

export const updateUserBodySchema = z
	.object({
		email: z.email().optional(),
		firstName: z.string().min(1).max(100).optional(),
		lastName: z.string().min(1).max(100).optional(),
		bio: z.string().max(2000).nullable().optional(),
		gender: genderSchema.nullable().optional(),
		sexualOrientation: sexualOrientationSchema.nullable().optional(),
		birthDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be ISO date in format YYYY-MM-DD')
			.nullable()
			.optional(),
	})
	.strict()

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>

export const locationBodySchema = z.discriminatedUnion('consent', [
	z
		.object({
			consent: z.literal(true),
			latitude: z.number().min(-90).max(90),
			longitude: z.number().min(-180).max(180),
		})
		.strict(),
	z
		.object({
			consent: z.literal(false),
			city: z.string().min(1).max(120),
			neighborhood: z.string().min(1).max(120),
		})
		.strict(),
])

export type LocationBody = z.infer<typeof locationBodySchema>
