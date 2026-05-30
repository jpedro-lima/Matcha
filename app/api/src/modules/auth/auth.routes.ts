import { Router } from 'express'
import { authLimiter } from '../../middlewares/rate-limit.js'
import { requireAuth } from '../../middlewares/require-auth.js'
import { validate } from '../../middlewares/validate.js'
import {
	forgotPassword,
	login,
	logout,
	me,
	refresh,
	register,
	resendVerification,
	resetPassword,
	verifyEmail,
} from './auth.handlers.js'
import {
	forgotPasswordBodySchema,
	loginBodySchema,
	registerBodySchema,
	resendVerificationBodySchema,
	resetPasswordBodySchema,
	verifyEmailParamsSchema,
} from './auth.schemas.js'

export const authRoutes = Router()

authRoutes.post(
	'/register',
	authLimiter,
	validate({ body: registerBodySchema }),
	register,
)
authRoutes.get(
	'/verify-email/:token',
	validate({ params: verifyEmailParamsSchema }),
	verifyEmail,
)
authRoutes.post(
	'/resend-verification',
	authLimiter,
	validate({ body: resendVerificationBodySchema }),
	resendVerification,
)
authRoutes.post('/login', authLimiter, validate({ body: loginBodySchema }), login)
authRoutes.post('/refresh', refresh)
authRoutes.post('/logout', logout)
authRoutes.post(
	'/forgot-password',
	authLimiter,
	validate({ body: forgotPasswordBodySchema }),
	forgotPassword,
)
authRoutes.post(
	'/reset-password',
	authLimiter,
	validate({ body: resetPasswordBodySchema }),
	resetPassword,
)
authRoutes.get('/me', requireAuth, me)
