import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recalculateCompleteness } from '../../../common/services/completeness.service.js'
import { sendVerificationEmail } from '../../../common/services/email.service.js'
import { issueEmailToken } from '../../../common/services/token.service.js'
import { AppError } from '../../../utils/app-error.js'
import { getProfile, updateLocation, updateUser } from '../user.service.js'

vi.mock('../../../common/services/email.service.js', () => ({
	sendVerificationEmail: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
}))
vi.mock('../../../common/services/token.service.js', () => ({
	issueEmailToken: vi.fn(),
	consumeEmailToken: vi.fn(),
	issuePasswordResetToken: vi.fn(),
	consumePasswordResetToken: vi.fn(),
}))
vi.mock('../../../common/services/completeness.service.js', () => ({
	recalculateCompleteness: vi.fn(),
}))

// `dbBuilder` mocka o query-builder do knex. As mesmas funções respondem
// para `db('users')` e `db('profiles')` — cada teste configura o que
// `first` deve devolver e o que `update`/`insert` deve resolver.
const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	whereNot: vi.fn(),
	first: vi.fn(),
	insert: vi.fn(),
	returning: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}))
const dbMock = vi.hoisted(() => {
	const fn = vi.fn() as ReturnType<typeof vi.fn> & {
		transaction: ReturnType<typeof vi.fn>
	}
	fn.transaction = vi.fn()
	return fn
})
vi.mock('../../../config/db.js', () => ({ db: dbMock }))

const NOW = new Date('2026-05-30T12:00:00Z')

const userRow = {
	id: 'user-1',
	email: 'ana@matcha.local',
	username: 'ana',
	first_name: 'Ana',
	last_name: 'Silva',
	email_verified: true,
}

const profileRow = {
	user_id: 'user-1',
	bio: 'oi',
	gender: 'f' as const,
	sexual_orientation: 'bi' as const,
	birth_date: new Date('2000-01-15'),
	latitude: null,
	longitude: null,
	city: null,
	neighborhood: null,
	location_consent: null,
	fame_rating: 0,
	last_active: NOW,
	is_online: false,
	profile_completed_at: null,
	created_at: NOW,
	updated_at: NOW,
}

beforeEach(() => {
	vi.clearAllMocks()
	dbMock.mockReturnValue(dbBuilder)
	dbMock.transaction.mockImplementation(
		async (cb: (trx: typeof dbMock) => Promise<unknown>) => cb(dbMock),
	)
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.whereNot.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
	dbBuilder.insert.mockReturnValue(dbBuilder)
	dbBuilder.returning.mockResolvedValue([])
	dbBuilder.update.mockResolvedValue(1)
	dbBuilder.delete.mockResolvedValue(0)

	vi.mocked(issueEmailToken).mockResolvedValue('new-email-token')
	vi.mocked(sendVerificationEmail).mockResolvedValue(undefined)
})

describe('userService.getProfile', () => {
	it('returns { user, profile } when both rows exist', async () => {
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		const result = await getProfile('user-1')

		expect(dbMock).toHaveBeenCalledWith('users')
		expect(dbMock).toHaveBeenCalledWith('profiles')
		expect(result.user).toEqual({
			id: 'user-1',
			email: 'ana@matcha.local',
			username: 'ana',
			emailVerified: true,
		})
		expect(result.profile).toMatchObject({
			bio: 'oi',
			gender: 'f',
			sexualOrientation: 'bi',
			birthDate: '2000-01-15',
			fameRating: 0,
			isOnline: false,
		})
	})

	it('throws NOT_FOUND when the user does not exist', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await expect(getProfile('ghost')).rejects.toMatchObject({
			code: 'NOT_FOUND',
			status: 404,
		} as Partial<AppError>)
	})
})

describe('userService.updateUser', () => {
	beforeEach(() => {
		// Reads de pós-update (getProfile no fim) — `first` é chamado 2 vezes.
		// Configuramos para retornar user + profile padrão.
		dbBuilder.first
			.mockReset()
			.mockResolvedValue(undefined)
			.mockImplementation(() => {
				// Padrão: `getProfile` no fim do updateUser dispara 2 chamadas
				// (users, profiles) — ordem dependente do código.
				return Promise.resolve(undefined)
			})
	})

	it('updates only users.first_name when only firstName changes', async () => {
		// updateUser ainda chama getProfile no fim → mocka as duas reads.
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateUser('user-1', { firstName: 'Annie' })

		expect(dbMock).toHaveBeenCalledWith('users')
		expect(dbBuilder.update).toHaveBeenCalledWith(
			expect.objectContaining({ first_name: 'Annie' }),
		)
		// Não tocou em profiles.
		expect(dbBuilder.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ bio: expect.anything() }),
		)
	})

	it('updates only profiles.bio when only bio changes', async () => {
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateUser('user-1', { bio: 'novo bio' })

		expect(dbMock).toHaveBeenCalledWith('profiles')
		expect(dbBuilder.update).toHaveBeenCalledWith(
			expect.objectContaining({ bio: 'novo bio' }),
		)
	})

	it('updates both tables in a single transaction when fields span users + profiles', async () => {
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateUser('user-1', { firstName: 'Annie', bio: 'novo' })

		expect(dbMock.transaction).toHaveBeenCalledTimes(1)
		expect(dbBuilder.update).toHaveBeenCalledWith(
			expect.objectContaining({ first_name: 'Annie' }),
		)
		expect(dbBuilder.update).toHaveBeenCalledWith(
			expect.objectContaining({ bio: 'novo' }),
		)
	})

	it('on email change: rejects EMAIL_EXISTS when new email belongs to another user', async () => {
		dbBuilder.first.mockResolvedValueOnce({ id: 'other-user' })

		await expect(updateUser('user-1', { email: 'taken@x.com' })).rejects.toMatchObject({
			code: 'EMAIL_EXISTS',
			status: 409,
		} as Partial<AppError>)

		expect(dbMock.transaction).not.toHaveBeenCalled()
	})

	it('on email change: resets email_verified, drops old tokens, issues new one and sends email', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({
				...userRow,
				email: 'new@matcha.local',
				email_verified: false,
			})
			.mockResolvedValueOnce(profileRow)

		await updateUser('user-1', { email: 'new@matcha.local' })

		expect(dbMock.transaction).toHaveBeenCalledTimes(1)
		expect(dbBuilder.update).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'new@matcha.local', email_verified: false }),
		)
		expect(dbMock).toHaveBeenCalledWith('email_tokens')
		expect(dbBuilder.delete).toHaveBeenCalled()
		expect(issueEmailToken).toHaveBeenCalledWith('user-1', dbMock)
		expect(sendVerificationEmail).toHaveBeenCalledWith(
			'new@matcha.local',
			'new-email-token',
		)
	})

	it('on email change: SMTP failure is logged silently (not propagated)', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({
				...userRow,
				email: 'new@matcha.local',
				email_verified: false,
			})
			.mockResolvedValueOnce(profileRow)
		vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error('smtp down'))

		await expect(
			updateUser('user-1', { email: 'new@matcha.local' }),
		).resolves.toBeDefined()
	})

	it('no-op patch (empty body): does not touch db.transaction nor any update', async () => {
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateUser('user-1', {})

		expect(dbMock.transaction).not.toHaveBeenCalled()
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})
})

describe('userService.updateLocation', () => {
	it('on consent=true: persists lat/lng and clears city/neighborhood', async () => {
		dbBuilder.update.mockResolvedValueOnce(1)
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateLocation('user-1', {
			consent: true,
			latitude: -23.55,
			longitude: -46.63,
		})

		expect(dbMock).toHaveBeenCalledWith('profiles')
		expect(dbBuilder.where).toHaveBeenCalledWith({ user_id: 'user-1' })
		expect(dbBuilder.update).toHaveBeenCalledWith({
			location_consent: true,
			latitude: -23.55,
			longitude: -46.63,
			city: null,
			neighborhood: null,
		})
	})

	it('on consent=false: persists city/neighborhood and clears lat/lng', async () => {
		dbBuilder.update.mockResolvedValueOnce(1)
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateLocation('user-1', {
			consent: false,
			city: 'Sao Paulo',
			neighborhood: 'Vila Madalena',
		})

		expect(dbBuilder.update).toHaveBeenCalledWith({
			location_consent: false,
			latitude: null,
			longitude: null,
			city: 'Sao Paulo',
			neighborhood: 'Vila Madalena',
		})
	})

	it('throws NOT_FOUND when no profile row matches the userId', async () => {
		dbBuilder.update.mockResolvedValueOnce(0)

		await expect(
			updateLocation('ghost', { consent: true, latitude: 0, longitude: 0 }),
		).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 } as Partial<AppError>)
	})

	it('does not start a transaction (single UPDATE)', async () => {
		dbBuilder.update.mockResolvedValueOnce(1)
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateLocation('user-1', { consent: true, latitude: 0, longitude: 0 })

		expect(dbMock.transaction).not.toHaveBeenCalled()
	})

	it('triggers recalculateCompleteness after the update', async () => {
		dbBuilder.update.mockResolvedValueOnce(1)
		dbBuilder.first.mockResolvedValueOnce(userRow).mockResolvedValueOnce(profileRow)

		await updateLocation('user-1', { consent: true, latitude: 0, longitude: 0 })

		expect(recalculateCompleteness).toHaveBeenCalledWith('user-1')
	})
})
