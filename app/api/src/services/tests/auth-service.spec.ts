import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../utils/app-error.js'
import {
	forgotPassword,
	login,
	logout,
	refresh,
	register,
	resetPassword,
	verifyEmail,
} from '../auth-service.js'
import { sendPasswordResetEmail, sendVerificationEmail } from '../email-service.js'
import { signAccess, signRefresh, verifyRefresh } from '../jwt-service.js'
import { assertStrongPassword } from '../password-policy.js'
import { hashPassword, verifyPassword } from '../password-service.js'
import {
	consumeEmailToken,
	consumePasswordResetToken,
	issueEmailToken,
	issuePasswordResetToken,
} from '../token-service.js'

// ── Collaborator mocks ────────────────────────────────────────────
vi.mock('../password-policy.js', () => ({
	assertStrongPassword: vi.fn(),
}))
vi.mock('../password-service.js', () => ({
	hashPassword: vi.fn(),
	verifyPassword: vi.fn(),
}))
vi.mock('../token-service.js', () => ({
	issueEmailToken: vi.fn(),
	consumeEmailToken: vi.fn(),
	issuePasswordResetToken: vi.fn(),
	consumePasswordResetToken: vi.fn(),
}))
vi.mock('../email-service.js', () => ({
	sendVerificationEmail: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
}))
vi.mock('../jwt-service.js', () => ({
	signAccess: vi.fn(),
	signRefresh: vi.fn(),
	verifyAccess: vi.fn(),
	verifyRefresh: vi.fn(),
}))

// `db` is a function returning a builder; we mock the builder and each test
// configures `where`/`first`/`insert`/`returning` in `beforeEach` or per case.
const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	first: vi.fn(),
	insert: vi.fn(),
	returning: vi.fn(),
	update: vi.fn(),
}))
const dbMock = vi.hoisted(() => vi.fn(() => dbBuilder))
vi.mock('../../config/db.js', () => ({ db: dbMock }))

const validInput = {
	email: 'new@matcha.local',
	username: 'newuser',
	firstName: 'New',
	lastName: 'User',
	password: 'Forte#2026!',
}

beforeEach(() => {
	vi.clearAllMocks()
	// Builder chain: where(...).first()  and  insert(...).returning(...)
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
	dbBuilder.insert.mockReturnValue(dbBuilder)
	dbBuilder.returning.mockResolvedValue([
		{
			id: 'user-123',
			email: validInput.email,
			username: validInput.username,
			email_verified: false,
		},
	])
	dbBuilder.update.mockResolvedValue(1)

	vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
	vi.mocked(verifyPassword).mockResolvedValue(true)
	vi.mocked(issueEmailToken).mockResolvedValue('email-token-abc')
	vi.mocked(consumeEmailToken).mockResolvedValue('user-123')
	vi.mocked(issuePasswordResetToken).mockResolvedValue('reset-token-xyz')
	vi.mocked(consumePasswordResetToken).mockResolvedValue('user-123')
	vi.mocked(sendVerificationEmail).mockResolvedValue(undefined)
	vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined)
	vi.mocked(assertStrongPassword).mockReturnValue(undefined)
	vi.mocked(signAccess).mockReturnValue('access-jwt')
	vi.mocked(signRefresh).mockReturnValue('refresh-jwt')
	vi.mocked(verifyRefresh).mockReturnValue({
		sub: 'user-123',
		jti: 'jti-1',
		aud: 'matcha:refresh',
	} as ReturnType<typeof verifyRefresh>)
})

describe('authService.register', () => {
	it('validates password strength before anything else', async () => {
		vi.mocked(assertStrongPassword).mockImplementation(() => {
			throw new AppError('WEAK_PASSWORD', 422, 'weak')
		})

		await expect(register(validInput)).rejects.toMatchObject({ code: 'WEAK_PASSWORD' })

		expect(assertStrongPassword).toHaveBeenCalledWith(validInput.password)
		expect(hashPassword).not.toHaveBeenCalled()
		expect(dbBuilder.insert).not.toHaveBeenCalled()
	})

	it('rejects with EMAIL_EXISTS when the email is already registered', async () => {
		// First query (by email) finds someone; `where` returns the builder, and
		// `first` resolves with the existing row.
		dbBuilder.first.mockResolvedValueOnce({ id: 'existing', email: validInput.email })

		await expect(register(validInput)).rejects.toMatchObject({
			code: 'EMAIL_EXISTS',
			status: 409,
		} as Partial<AppError>)

		expect(dbBuilder.where).toHaveBeenCalledWith({ email: validInput.email })
		expect(hashPassword).not.toHaveBeenCalled()
	})

	it('rejects with USERNAME_EXISTS when the username is already taken', async () => {
		// First query (email) → undefined, second (username) → exists.
		dbBuilder.first
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ id: 'existing', username: validInput.username })

		await expect(register(validInput)).rejects.toMatchObject({
			code: 'USERNAME_EXISTS',
			status: 409,
		} as Partial<AppError>)

		expect(dbBuilder.where).toHaveBeenNthCalledWith(1, { email: validInput.email })
		expect(dbBuilder.where).toHaveBeenNthCalledWith(2, { username: validInput.username })
		expect(hashPassword).not.toHaveBeenCalled()
	})

	it('on success: hashes password, inserts user, issues token and sends email', async () => {
		const result = await register(validInput)

		// Collaborator order: hash → insert → issue token → send email
		expect(hashPassword).toHaveBeenCalledWith(validInput.password)
		expect(dbBuilder.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				email: validInput.email,
				username: validInput.username,
				first_name: validInput.firstName,
				last_name: validInput.lastName,
				password_hash: 'hashed-pw',
			}),
		)
		expect(issueEmailToken).toHaveBeenCalledWith('user-123')
		expect(sendVerificationEmail).toHaveBeenCalledWith(validInput.email, 'email-token-abc')

		expect(result).toEqual({
			id: 'user-123',
			email: validInput.email,
			username: validInput.username,
			emailVerified: false,
		})
	})

	it('does NOT store password_hash with the raw password value', async () => {
		await register(validInput)
		const insertArg = dbBuilder.insert.mock.calls[0]?.[0] as { password_hash: string }
		expect(insertArg.password_hash).not.toBe(validInput.password)
		expect(insertArg.password_hash).toBe('hashed-pw')
	})
})

describe('authService.verifyEmail', () => {
	it('consumes the token and sets email_verified=true', async () => {
		vi.mocked(consumeEmailToken).mockResolvedValueOnce('user-abc')

		await verifyEmail('valid-token')

		expect(consumeEmailToken).toHaveBeenCalledWith('valid-token')
		expect(dbMock).toHaveBeenCalledWith('users')
		expect(dbBuilder.where).toHaveBeenCalledWith({ id: 'user-abc' })
		expect(dbBuilder.update).toHaveBeenCalledWith({ email_verified: true })
	})

	it('propagates INVALID_TOKEN from tokenService', async () => {
		vi.mocked(consumeEmailToken).mockRejectedValueOnce(
			new AppError('INVALID_TOKEN', 400, 'invalid'),
		)

		await expect(verifyEmail('fake')).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})
})

describe('authService.login', () => {
	const loginRow = {
		id: 'user-123',
		username: 'ana',
		email: 'ana@matcha.local',
		password_hash: 'hashed-pw',
		email_verified: true,
	}

	it('rejects with INVALID_CREDENTIALS when username does not exist', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(login('nonexistent', 'whatever')).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
			status: 401,
		} as Partial<AppError>)

		// verifyPassword is not called if the user does not exist
		expect(verifyPassword).not.toHaveBeenCalled()
	})

	it('rejects with INVALID_CREDENTIALS when the password does not match', async () => {
		dbBuilder.first.mockResolvedValueOnce(loginRow)
		vi.mocked(verifyPassword).mockResolvedValueOnce(false)

		await expect(login('ana', 'wrongpassword')).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
			status: 401,
		} as Partial<AppError>)

		expect(signAccess).not.toHaveBeenCalled()
	})

	it('rejects with EMAIL_NOT_VERIFIED when the user has not confirmed email', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...loginRow, email_verified: false })

		await expect(login('ana', 'Forte#2026!')).rejects.toMatchObject({
			code: 'EMAIL_NOT_VERIFIED',
			status: 403,
		} as Partial<AppError>)

		expect(signAccess).not.toHaveBeenCalled()
	})

	it('on success returns { accessToken, refreshToken, user }', async () => {
		dbBuilder.first.mockResolvedValueOnce(loginRow)

		const result = await login('ana', 'Forte#2026!')

		expect(verifyPassword).toHaveBeenCalledWith('Forte#2026!', 'hashed-pw')
		expect(signAccess).toHaveBeenCalledWith(
			expect.objectContaining({ sub: 'user-123', username: 'ana' }),
		)
		expect(signRefresh).toHaveBeenCalledWith(
			expect.objectContaining({ sub: 'user-123' }),
		)
		expect(result).toEqual({
			accessToken: 'access-jwt',
			refreshToken: 'refresh-jwt',
			user: { id: 'user-123', username: 'ana', email: 'ana@matcha.local' },
		})
	})
})

describe('authService.refresh', () => {
	it('issues new access + new refresh when the current refresh is valid', async () => {
		dbBuilder.first.mockResolvedValueOnce({
			id: 'user-123',
			username: 'ana',
			email: 'ana@matcha.local',
		})

		const result = await refresh('old-refresh-jwt')

		expect(verifyRefresh).toHaveBeenCalledWith('old-refresh-jwt')
		expect(signAccess).toHaveBeenCalledWith(
			expect.objectContaining({ sub: 'user-123', username: 'ana' }),
		)
		expect(signRefresh).toHaveBeenCalled()
		expect(result.accessToken).toBe('access-jwt')
		expect(result.refreshToken).toBe('refresh-jwt')
	})

	it('throws REFRESH_INVALID when the token is not valid', async () => {
		vi.mocked(verifyRefresh).mockImplementationOnce(() => {
			throw new Error('jwt expired')
		})

		await expect(refresh('expired')).rejects.toMatchObject({
			code: 'REFRESH_INVALID',
			status: 401,
		} as Partial<AppError>)
	})

	it('throws REFRESH_INVALID when the refresh user no longer exists', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(refresh('refresh-jwt')).rejects.toMatchObject({
			code: 'REFRESH_INVALID',
			status: 401,
		} as Partial<AppError>)
	})
})

describe('authService.logout', () => {
	it('accepts any valid refresh without throwing (revocation is the controller responsibility)', async () => {
		await expect(logout('refresh-jwt')).resolves.toBeUndefined()
	})
})

describe('authService.forgotPassword', () => {
	it('when the email exists: issues token and sends reset', async () => {
		dbBuilder.first.mockResolvedValueOnce({ id: 'user-123', email: 'ana@matcha.local' })

		await forgotPassword('ana@matcha.local')

		expect(issuePasswordResetToken).toHaveBeenCalledWith('user-123')
		expect(sendPasswordResetEmail).toHaveBeenCalledWith(
			'ana@matcha.local',
			'reset-token-xyz',
		)
	})

	it('when the email does NOT exist: does not throw and does not send email (avoids user enumeration)', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(forgotPassword('nonexistent@x.com')).resolves.toBeUndefined()
		expect(issuePasswordResetToken).not.toHaveBeenCalled()
		expect(sendPasswordResetEmail).not.toHaveBeenCalled()
	})
})

describe('authService.resetPassword', () => {
	it('validates strength → consumes token → updates password_hash', async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValueOnce('user-abc')

		await resetPassword('reset-token', 'NewForte#2026!')

		expect(assertStrongPassword).toHaveBeenCalledWith('NewForte#2026!')
		expect(consumePasswordResetToken).toHaveBeenCalledWith('reset-token')
		expect(hashPassword).toHaveBeenCalledWith('NewForte#2026!')
		expect(dbBuilder.where).toHaveBeenCalledWith({ id: 'user-abc' })
		expect(dbBuilder.update).toHaveBeenCalledWith({ password_hash: 'hashed-pw' })
	})

	it('rejects WEAK_PASSWORD before consuming the token', async () => {
		vi.mocked(assertStrongPassword).mockImplementation(() => {
			throw new AppError('WEAK_PASSWORD', 422, 'weak')
		})

		await expect(resetPassword('reset-token', '123')).rejects.toMatchObject({
			code: 'WEAK_PASSWORD',
		})
		expect(consumePasswordResetToken).not.toHaveBeenCalled()
	})

	it('propagates INVALID_TOKEN if the reset token is invalid', async () => {
		vi.mocked(consumePasswordResetToken).mockRejectedValueOnce(
			new AppError('INVALID_TOKEN', 400, 'invalid'),
		)

		await expect(resetPassword('fake', 'NewForte#2026!')).rejects.toMatchObject({
			code: 'INVALID_TOKEN',
		})
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})
})
