import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../utils/AppError.js'

type Schemas = {
	body?: ZodType
	query?: ZodType
	params?: ZodType
}

type ZodIssue = {
	path: (string | number)[]
	message: string
	code: string
}

const formatIssues = (segment: string, issues: ZodIssue[]) =>
	issues.map((issue) => ({
		path: [segment, ...issue.path.map(String)].join('.'),
		message: issue.message,
		code: issue.code,
	}))

export const validate = (schemas: Schemas): RequestHandler => {
	return (req, _res, next) => {
		const details: ReturnType<typeof formatIssues> = []

		if (schemas.body) {
			const parsed = schemas.body.safeParse(req.body)
			if (!parsed.success) details.push(...formatIssues('body', parsed.error.issues as ZodIssue[]))
			else req.body = parsed.data
		}

		if (schemas.query) {
			const parsed = schemas.query.safeParse(req.query)
			if (!parsed.success) details.push(...formatIssues('query', parsed.error.issues as ZodIssue[]))
			else Object.assign(req.query as object, parsed.data as object)
		}

		if (schemas.params) {
			const parsed = schemas.params.safeParse(req.params)
			if (!parsed.success) details.push(...formatIssues('params', parsed.error.issues as ZodIssue[]))
			else Object.assign(req.params as object, parsed.data as object)
		}

		if (details.length > 0) {
			return next(
				new AppError('VALIDATION_ERROR', 400, 'Os dados enviados não passaram na validação.', details),
			)
		}

		return next()
	}
}
