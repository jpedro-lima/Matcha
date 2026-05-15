import express from 'express'
import { env } from './config/env.js'

const app = express()

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' })
})

app.listen(env.API_PORT, () => {
	console.info(`API listening on :${env.API_PORT} (${env.NODE_ENV})`)
})
