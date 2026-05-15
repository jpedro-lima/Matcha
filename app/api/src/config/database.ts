import type { Knex } from 'knex'
import { env } from './env.js'

const baseConnection: Knex.PgConnectionConfig = {
	host: env.POSTGRES_HOST,
	port: env.POSTGRES_PORT,
	user: env.POSTGRES_USER,
	password: env.POSTGRES_PASSWORD,
	database: env.POSTGRES_DB,
}

const basePool: Knex.PoolConfig = {
	min: 0,
	max: 10,
	idleTimeoutMillis: 30_000,
}

export const databaseConfig: Record<'development' | 'test' | 'production', Knex.Config> = {
	development: {
		client: 'pg',
		connection: baseConnection,
		pool: basePool,
	},
	test: {
		client: 'pg',
		connection: { ...baseConnection, database: `${env.POSTGRES_DB}_test` },
		pool: { ...basePool, max: 5 },
	},
	production: {
		client: 'pg',
		connection: baseConnection,
		pool: basePool,
	},
}

export const activeDatabaseConfig: Knex.Config = databaseConfig[env.NODE_ENV]
