import type { ErrorRequestHandler, RequestHandler } from 'express'
import { env } from '../config/env.js'
import { AppError, isAppError } from '../utils/AppError.js'

type ErrorBody = {
	error: {
		code: string
		message: string
		details?: unknown
	}
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
	next(new AppError('NOT_FOUND', 404, 'Recurso não encontrado.'))
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	const log = req.log ?? console

	if (isAppError(err)) {
		const body: ErrorBody = {
			error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
		}
		log.warn({ err: { code: err.code, status: err.status } }, 'handled AppError')
		res.status(err.status).json(body)
		return
	}

	log.error({ err }, 'unhandled error')

	const body: ErrorBody = {
		error: {
			code: 'INTERNAL_ERROR',
			message: 'Erro interno do servidor.',
			...(env.NODE_ENV !== 'production' && err instanceof Error
				? { details: { name: err.name, message: err.message } }
				: {}),
		},
	}
	res.status(500).json(body)
}
