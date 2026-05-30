import { randomUUID } from 'node:crypto'
import {
	sendPasswordResetEmail,
	sendVerificationEmail,
} from '../../common/services/email.service.js'
import { hashPassword, verifyPassword } from '../../common/services/bcrypt.service.js'
import {
	signAccess,
	signRefresh,
	verifyRefresh,
} from '../../common/services/jwt.service.js'
import {
	consumeEmailToken,
	consumePasswordResetToken,
	issueEmailToken,
	issuePasswordResetToken,
} from '../../common/services/token.service.js'
import {
	publicUserFromRow,
	type PublicUser,
	type UserRow,
} from '../../common/types/user.types.js'
import { db } from '../../config/db.js'
import { logger } from '../../config/logger.js'
import { AppError } from '../../utils/app-error.js'
import type { RegisterBody } from './auth.schemas.js'
import type { LoginResult, RegisterResult } from './auth.types.js'

type AuthRow = Pick<
	UserRow,
	'id' | 'email' | 'username' | 'email_verified' | 'password_hash'
>

export async function register(input: RegisterBody): Promise<RegisterResult> {
	const existingEmail = await db('users').where({ email: input.email }).first<AuthRow>()
	if (existingEmail) {
		throw new AppError('EMAIL_EXISTS', 409, 'Email is already registered.')
	}

	const existingUsername = await db('users')
		.where({ username: input.username })
		.first<AuthRow>()
	if (existingUsername) {
		throw new AppError('USERNAME_EXISTS', 409, 'Username is already taken.')
	}

	const passwordHash = await hashPassword(input.password)

	const { user, token } = await db.transaction(async (trx) => {
		const [created] = await trx('users')
			.insert({
				email: input.email,
				username: input.username,
				first_name: input.firstName,
				last_name: input.lastName,
				password_hash: passwordHash,
			})
			.returning<AuthRow[]>(['id', 'email', 'username', 'email_verified'])

		if (!created) {
			throw new AppError('INTERNAL_ERROR', 500, 'Failed to create user.')
		}

		// Linha 1:1 em `profiles` com defaults. Campos opcionais (bio, gender,
		// birthDate, location…) são preenchidos depois via PATCH /users/me.
		// `.returning('user_id')` é só pra manter o builder thenable consistente
		// (mock do test depende disso).
		await trx('profiles').insert({ user_id: created.id }).returning('user_id')

		const emailToken = await issueEmailToken(created.id, trx)
		return { user: created, token: emailToken }
	})

	let emailSent = true
	try {
		await sendVerificationEmail(user.email, token)
	} catch (err) {
		emailSent = false
		logger.error(
			{ err, userId: user.id, email: user.email },
			'verification email send failed on register',
		)
	}

	return { user: publicUserFromRow(user), emailSent }
}

export async function verifyEmail(token: string): Promise<void> {
	const userId = await consumeEmailToken(token)
	await db('users').where({ id: userId }).update({ email_verified: true })
}

export async function resendVerificationEmail(email: string): Promise<void> {
	const user = await db('users')
		.where({ email })
		.first<AuthRow>(['id', 'email', 'email_verified'])
	if (!user || user.email_verified) return

	const token = await issueEmailToken(user.id)
	try {
		await sendVerificationEmail(user.email, token)
	} catch (err) {
		logger.error(
			{ err, userId: user.id, email: user.email },
			'verification email resend failed',
		)
	}
}

export async function login(username: string, password: string): Promise<LoginResult> {
	const user = await db('users').where({ username }).first<AuthRow>()

	const invalid = new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials.')
	if (!user) throw invalid

	const ok = await verifyPassword(password, user.password_hash)
	if (!ok) throw invalid

	if (!user.email_verified) {
		throw new AppError('EMAIL_NOT_VERIFIED', 403, 'Email is not verified.')
	}

	const accessToken = signAccess({ sub: user.id, username: user.username })
	const refreshToken = signRefresh({ sub: user.id, jti: randomUUID() })

	return {
		accessToken,
		refreshToken,
		user: { id: user.id, username: user.username, email: user.email },
	}
}

const REFRESH_INVALID = new AppError('REFRESH_INVALID', 401, 'Invalid refresh token.')

export async function refresh(refreshToken: string): Promise<LoginResult> {
	let decoded: ReturnType<typeof verifyRefresh>
	try {
		decoded = verifyRefresh(refreshToken)
	} catch {
		throw REFRESH_INVALID
	}

	const user = await db('users').where({ id: decoded.sub }).first<AuthRow>()
	if (!user) throw REFRESH_INVALID

	const newAccess = signAccess({ sub: user.id, username: user.username })
	const newRefresh = signRefresh({ sub: user.id, jti: randomUUID() })

	return {
		accessToken: newAccess,
		refreshToken: newRefresh,
		user: { id: user.id, username: user.username, email: user.email },
	}
}

export async function logout(_refreshToken: string): Promise<void> {
	// no-op por agora
}

export async function forgotPassword(email: string): Promise<void> {
	const user = await db('users').where({ email }).first<AuthRow>()
	if (!user) return

	const token = await issuePasswordResetToken(user.id)
	await sendPasswordResetEmail(user.email, token)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
	const userId = await consumePasswordResetToken(token)
	const passwordHash = await hashPassword(newPassword)
	await db('users').where({ id: userId }).update({ password_hash: passwordHash })
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
	const row = await db('users')
		.where({ id: userId })
		.first<AuthRow>(['id', 'email', 'username', 'email_verified'])

	if (!row) {
		throw new AppError('NOT_FOUND', 404, 'User not found.')
	}

	return publicUserFromRow(row)
}
