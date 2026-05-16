import { Router } from 'express'
import { db } from '../config/db.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
	res.json({ status: 'ok' })
})

healthRouter.get('/db-health', async (_req, res, next) => {
	try {
		const { rows } = await db.raw<{ rows: { version: string }[] }>('select version()')
		res.json({ ok: true, version: rows[0]?.version ?? null })
	} catch (err) {
		next(err)
	}
})
