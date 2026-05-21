import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js'
import { httpLogger } from './middlewares/http-logger.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'

export const createApp = (): express.Express => {
	const app = express()

	app.disable('x-powered-by')

	app.use(httpLogger)
	app.use(helmet())
	app.use(cors({ origin: env.APP_URL, credentials: true }))
	app.use(cookieParser())
	app.use(compression())
	app.use(express.json({ limit: '1mb' }))
	app.use(express.urlencoded({ extended: false }))

	app.use(healthRouter)
	app.use('/auth', authRouter)

	app.use(notFoundHandler)
	app.use(errorHandler)

	return app
}

export const app = createApp()
