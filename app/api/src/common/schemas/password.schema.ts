import { z } from 'zod'

export const passwordSchema = z
	.string()
	.min(8, 'must be at least 8 characters long')
	.regex(/[A-Za-z]/, 'must contain at least one letter')
	.regex(/[0-9]/, 'must contain at least one number')
	.regex(/[^A-Za-z0-9]/, 'must contain at least one symbol')
