import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifyAccess } from '../common/services/jwt.service.js'
import { AppError } from '../utils/app-error.js'

declare module 'express-serve-static-core' {
	interface Request {
		user?: { id: string; username: string }
	}
}

const BEARER_PREFIX = 'bearer '

export const requireAuth: RequestHandler = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const header = req.headers.authorization

	if (!header) {
		return next(new AppError('MISSING_TOKEN', 401, 'Authentication token is missing.'))
	}

	if (!header.toLowerCase().startsWith(BEARER_PREFIX)) {
		return next(
			new AppError('INVALID_TOKEN', 401, 'Authorization must use the Bearer scheme.'),
		)
	}

	const token = header.slice(BEARER_PREFIX.length).trim()

	try {
		const payload = verifyAccess(token)
		req.user = { id: payload.sub, username: payload.username }
		return next()
	} catch {
		return next(new AppError('INVALID_TOKEN', 401, 'Invalid or expired token.'))
	}
}
