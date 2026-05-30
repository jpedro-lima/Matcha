import type { RequestHandler } from 'express'
import { db } from '../../config/db.js'

export const health: RequestHandler = (_req, res) => {
	res.json({ status: 'ok' })
}

export const dbHealth: RequestHandler = async (_req, res, next) => {
	try {
		const { rows } = await db.raw<{ rows: { version: string }[] }>('select version()')
		res.json({ ok: true, version: rows[0]?.version ?? null })
	} catch (err) {
		next(err)
	}
}
