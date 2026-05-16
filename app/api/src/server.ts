import { app } from './app.js'
import { closeDb } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

const server = app.listen(env.API_PORT, () => {
	logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'API listening')
})

async function shutdown(signal: NodeJS.Signals): Promise<void> {
	logger.info({ signal }, 'shutdown: signal received, closing HTTP server')

	await new Promise<void>((resolve, reject) => {
		server.close((err) => (err ? reject(err) : resolve()))
	}).catch((err) => {
		logger.error({ err }, 'shutdown: error closing HTTP server')
		process.exit(1)
	})

	try {
		await closeDb()
		logger.info('shutdown: db connection closed')
		process.exit(0)
	} catch (err) {
		logger.error({ err }, 'shutdown: error closing db')
		process.exit(1)
	}
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
