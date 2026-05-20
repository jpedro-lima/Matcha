/**
 * Seed de identidade — 5 usuários verificados para desenvolvimento e testes.
 *
 * Credenciais (todos compartilham a mesma senha para facilitar manual smoke):
 *   senha:    Test1234!
 *   usernames: ana / bruno / carla / diego / eva
 *   emails:   <username>@matcha.local
 *
 * Todos com `email_verified=true` (permitem login imediato sem fluxo de
 * verificação por e-mail). NÃO USAR EM PRODUÇÃO.
 */
import bcrypt from 'bcrypt'
import type { Knex } from 'knex'

const SHARED_PASSWORD = 'Test1234!'
const BCRYPT_ROUNDS = 12

type SeedUser = {
	email: string
	username: string
	first_name: string
	last_name: string
}

const users: SeedUser[] = [
	{ email: 'ana@matcha.local', username: 'ana', first_name: 'Ana', last_name: 'Souza' },
	{ email: 'bruno@matcha.local', username: 'bruno', first_name: 'Bruno', last_name: 'Lima' },
	{ email: 'carla@matcha.local', username: 'carla', first_name: 'Carla', last_name: 'Martins' },
	{ email: 'diego@matcha.local', username: 'diego', first_name: 'Diego', last_name: 'Pereira' },
	{ email: 'eva@matcha.local', username: 'eva', first_name: 'Eva', last_name: 'Costa' },
]

export async function seed(knex: Knex): Promise<void> {
	// Apaga apenas os e-mails que vamos inserir — não trunca a tabela inteira
	// para preservar contas criadas manualmente em dev.
	await knex('users')
		.whereIn(
			'email',
			users.map((u) => u.email),
		)
		.del()

	const password_hash = await bcrypt.hash(SHARED_PASSWORD, BCRYPT_ROUNDS)

	await knex('users').insert(
		users.map((u) => ({ ...u, password_hash, email_verified: true })),
	)
}
