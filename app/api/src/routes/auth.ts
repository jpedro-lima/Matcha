import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
	forgotPasswordHandler,
	loginHandler,
	logoutHandler,
	meHandler,
	refreshHandler,
	registerHandler,
	resetPasswordHandler,
	verifyEmailHandler,
} from '../controllers/auth-controller.js'
import { requireAuth } from '../middlewares/require-auth.js'
import { validate } from '../middlewares/validate.js'
import {
	forgotPasswordBodySchema,
	loginBodySchema,
	registerBodySchema,
	resetPasswordBodySchema,
	verifyEmailParamsSchema,
} from '../validators/auth-schemas.js'

// Rate limit estrito para endpoints expostos a tentativas em massa.
// 5 requests / 15 min por IP, conforme planning item 40.
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		error: {
			code: 'RATE_LIMITED',
			message: 'Too many attempts. Please try again in 15 minutes.',
		},
	},
})

export const authRouter = Router()

authRouter.post('/register', authLimiter, validate({ body: registerBodySchema }), registerHandler)

authRouter.get(
	'/verify-email/:token',
	validate({ params: verifyEmailParamsSchema }),
	verifyEmailHandler,
)

authRouter.post('/login', authLimiter, validate({ body: loginBodySchema }), loginHandler)

authRouter.post('/refresh', refreshHandler)

authRouter.post('/logout', logoutHandler)

authRouter.post(
	'/forgot-password',
	authLimiter,
	validate({ body: forgotPasswordBodySchema }),
	forgotPasswordHandler,
)

authRouter.post(
	'/reset-password',
	authLimiter,
	validate({ body: resetPasswordBodySchema }),
	resetPasswordHandler,
)

authRouter.get('/me', requireAuth, meHandler)
