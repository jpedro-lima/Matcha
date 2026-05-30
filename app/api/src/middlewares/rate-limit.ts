import rateLimit from 'express-rate-limit'

export const authLimiter = rateLimit({
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
