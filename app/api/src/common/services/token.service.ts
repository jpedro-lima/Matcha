import { createHash, randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { db } from '../../config/db.js'
import { AppError } from '../../utils/app-error.js'

type TokenTable = 'email_tokens' | 'password_reset_tokens'

type QueryExecutor = Knex | Knex.Transaction

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000 // 1h

const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex')

async function issueToken(
	table: TokenTable,
	userId: string,
	ttlMs: number,
	executor: QueryExecutor = db,
): Promise<string> {
	const token = randomBytes(32).toString('hex')
	const tokenHash = sha256(token)
	const expiresAt = new Date(Date.now() + ttlMs)

	await executor(table).insert({
		token_hash: tokenHash,
		user_id: userId,
		expires_at: expiresAt,
	})

	return token
}

async function consumeToken(table: TokenTable, token: string): Promise<string> {
	const tokenHash = sha256(token)
	const row = await db(table)
		.where({ token_hash: tokenHash })
		.first<{ user_id: string; expires_at: Date | string } | undefined>()

	if (!row) {
		throw new AppError('INVALID_TOKEN', 400, 'Invalid or already consumed token.')
	}

	const expiresAt =
		row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)
	if (expiresAt.getTime() <= Date.now()) {
		await db(table).where({ token_hash: tokenHash }).del()
		throw new AppError('EXPIRED_TOKEN', 400, 'Token has expired.')
	}

	await db(table).where({ token_hash: tokenHash }).del()
	return row.user_id
}

export const issueEmailToken = (
	userId: string,
	executor?: QueryExecutor,
): Promise<string> => issueToken('email_tokens', userId, EMAIL_TOKEN_TTL_MS, executor)

export const consumeEmailToken = (token: string): Promise<string> =>
	consumeToken('email_tokens', token)

export const issuePasswordResetToken = (
	userId: string,
	executor?: QueryExecutor,
): Promise<string> =>
	issueToken('password_reset_tokens', userId, PASSWORD_RESET_TTL_MS, executor)

export const consumePasswordResetToken = (token: string): Promise<string> =>
	consumeToken('password_reset_tokens', token)
