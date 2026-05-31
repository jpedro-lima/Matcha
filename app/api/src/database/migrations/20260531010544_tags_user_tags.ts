import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('tags', (table) => {
		table.increments('id').primary()
		table.string('name', 40).notNullable().unique()
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
	})

	await knex.schema.createTable('user_tags', (table) => {
		table
			.uuid('user_id')
			.notNullable()
			.references('id')
			.inTable('users')
			.onDelete('CASCADE')
		table
			.integer('tag_id')
			.notNullable()
			.references('id')
			.inTable('tags')
			.onDelete('CASCADE')
		table.primary(['user_id', 'tag_id'])

		table.index('tag_id', 'user_tags_tag_id_idx')
	})
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('user_tags')
	await knex.schema.dropTableIfExists('tags')
}
