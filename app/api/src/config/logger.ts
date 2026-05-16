import { pino, type LoggerOptions } from 'pino'
import { env } from './env.js'

const baseOptions: LoggerOptions = {
	level: env.NODE_ENV === 'production' ? 'info' : 'debug',
	redact: {
		paths: [
			'req.headers.authorization',
			'req.headers.cookie',
			'res.headers["set-cookie"]',
			'*.password',
			'*.password_hash',
			'*.token',
			'*.refreshToken',
			'*.accessToken',
		],
		remove: true,
	},
}

const prettyTransport =
	env.NODE_ENV === 'development'
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'SYS:HH:MM:ss',
					ignore: 'pid,hostname',
				},
			}
		: undefined

export const logger = pino({
	...baseOptions,
	...(prettyTransport ? { transport: prettyTransport } : {}),
})
