import type { Knex } from 'knex'

// Para `email_tokens` e `password_reset_tokens`: o `token_hash` (sha256 hex,
// 64 chars) é a PK natural — busca por hash é O(1) via PK index, e o token cru
// nunca toca o disco. Cada usuário pode ter múltiplos tokens vivos (várias
// trocas de e-mail, por exemplo); o índice em `user_id` permite invalidação em
// massa (`DELETE FROM ... WHERE user_id = $1`).

const createTokenTable = (knex: Knex, tableName: string) =>
	knex.schema.createTable(tableName, (table) => {
		table.string('token_hash', 64).primary()
		table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
		table.timestamp('expires_at', { useTz: true }).notNullable()
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.index('user_id', `${tableName}_user_id_index`)
	})

export async function up(knex: Knex): Promise<void> {
	await createTokenTable(knex, 'email_tokens')
	await createTokenTable(knex, 'password_reset_tokens')
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('password_reset_tokens')
	await knex.schema.dropTableIfExists('email_tokens')
}
