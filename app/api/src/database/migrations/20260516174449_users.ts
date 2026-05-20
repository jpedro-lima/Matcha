import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	// Helper compartilhado para auto-atualizar `updated_at` em toda tabela que
	// quiser usar o trigger. Outras migrations podem referenciar a função sem
	// recriá-la.
	await knex.raw(`
		CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`)

	await knex.schema.createTable('users', (table) => {
		table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
		table.string('email', 255).notNullable().unique()
		table.string('username', 50).notNullable().unique()
		table.string('first_name', 100).notNullable()
		table.string('last_name', 100).notNullable()
		table.string('password_hash', 255).notNullable()
		table.boolean('email_verified').notNullable().defaultTo(false)
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
	})

	await knex.raw(`
		CREATE TRIGGER users_set_updated_at
		BEFORE UPDATE ON users
		FOR EACH ROW EXECUTE FUNCTION set_updated_at()
	`)
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw('DROP TRIGGER IF EXISTS users_set_updated_at ON users')
	await knex.schema.dropTableIfExists('users')
	await knex.raw('DROP FUNCTION IF EXISTS set_updated_at()')
}
