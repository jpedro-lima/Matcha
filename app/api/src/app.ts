import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { httpLogger } from './middlewares/httpLogger.js'
import { healthRouter } from './routes/health.js'
import { testRouter } from './routes/_test.js'

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
	app.use(testRouter)

	app.use(notFoundHandler)
	app.use(errorHandler)

	return app
}

export const app = createApp()
