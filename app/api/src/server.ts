import express from 'express'
import { env } from './config/env.js'
import { closeDb, db } from './config/db.js'

const app = express()

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' })
})

app.get('/db-health', async (_req, res, next) => {
	try {
		const { rows } = await db.raw<{ rows: { version: string }[] }>('select version()')
		res.json({ ok: true, version: rows[0]?.version ?? null })
	} catch (err) {
		next(err)
	}
})

const server = app.listen(env.API_PORT, () => {
	console.info(`API listening on :${env.API_PORT} (${env.NODE_ENV})`)
})

async function shutdown(signal: NodeJS.Signals): Promise<void> {
	console.info(`[shutdown] received ${signal}, closing server`)
	server.close((err) => {
		if (err) {
			console.error('[shutdown] error closing HTTP server', err)
			process.exit(1)
		}
	})
	try {
		await closeDb()
		console.info('[shutdown] db connection closed')
		process.exit(0)
	} catch (err) {
		console.error('[shutdown] error closing db', err)
		process.exit(1)
	}
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
