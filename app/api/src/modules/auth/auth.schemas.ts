import { z } from 'zod'
import { passwordSchema } from '../../common/schemas/password.schema.js'

export const registerBodySchema = z.object({
	email: z.email(),
	username: z
		.string()
		.min(3)
		.max(50)
		.regex(/^[a-zA-Z0-9_]+$/, 'username must be alphanumeric or underscore'),
	firstName: z.string().min(1).max(100),
	lastName: z.string().min(1).max(100),
	password: passwordSchema,
})

export const loginBodySchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
})

export const verifyEmailParamsSchema = z.object({
	token: z.string().min(1),
})

export const forgotPasswordBodySchema = z.object({
	email: z.email(),
})

export const resetPasswordBodySchema = z.object({
	token: z.string().min(1),
	newPassword: passwordSchema,
})

export const resendVerificationBodySchema = z.object({
	email: z.email(),
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>
