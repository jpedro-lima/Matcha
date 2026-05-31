import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('photos', (table) => {
		table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
		table
			.uuid('user_id')
			.notNullable()
			.references('id')
			.inTable('users')
			.onDelete('CASCADE')
		table.text('key').notNullable().unique()
		table.string('mime', 32)
		table.integer('bytes')
		table.string('status', 16).notNullable().defaultTo('pending')
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
	})

	await knex.raw(`
		ALTER TABLE photos
		ADD CONSTRAINT photos_status_check
		CHECK (status IN ('pending', 'ready', 'failed'))
	`)

	await knex.schema.alterTable('photos', (table) => {
		table.index('user_id', 'photos_user_id_idx')
	})
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('photos')
}
