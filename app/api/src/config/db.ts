import knex, { type Knex } from 'knex'
import { activeDatabaseConfig } from './database.js'

export const db: Knex = knex(activeDatabaseConfig)

export async function closeDb(): Promise<void> {
	await db.destroy()
}
