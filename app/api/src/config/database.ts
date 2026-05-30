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

// Sem perfil `test` dedicado: a suíte é 100% mock ([[feedback-test-strategy]]),
// `config/db.ts` nunca é instanciado em testes. Se NODE_ENV=test for setado,
// caímos no perfil de development sem consequências.
export const databaseConfig: Record<'development' | 'production', Knex.Config> = {
	development: {
		client: 'pg',
		connection: baseConnection,
		pool: basePool,
	},
	production: {
		client: 'pg',
		connection: baseConnection,
		pool: basePool,
	},
}

export const activeDatabaseConfig: Knex.Config =
	databaseConfig[env.NODE_ENV === 'production' ? 'production' : 'development']
