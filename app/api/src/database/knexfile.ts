import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Knex } from 'knex'
import { databaseConfig } from '../config/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const migrationsDir = path.join(__dirname, 'migrations')
const seedsDir = path.join(__dirname, 'seeds')

const withFiles = (base: Knex.Config): Knex.Config => ({
	...base,
	migrations: {
		directory: migrationsDir,
		extension: 'ts',
		loadExtensions: ['.ts', '.js'],
		tableName: 'migrations',
	},
	seeds: {
		directory: seedsDir,
		extension: 'ts',
		loadExtensions: ['.ts', '.js'],
	},
})

const config: Record<string, Knex.Config> = {
	development: withFiles(databaseConfig.development),
	test: withFiles(databaseConfig.test),
	production: withFiles(databaseConfig.production),
}

export default config
