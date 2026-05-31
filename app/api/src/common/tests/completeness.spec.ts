import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recalculateCompleteness } from '../services/completeness.service.js'

// Completeness é invariante crítica de domínio + ramificações de
// early-return — vale spec dedicado (não tem cobertura nos consumers
// porque eles mockam o hook).
const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	first: vi.fn(),
	count: vi.fn(),
	update: vi.fn(),
}))
const dbMock = vi.hoisted(() => {
	const fn = vi.fn() as ReturnType<typeof vi.fn> & { fn: { now: () => string } }
	fn.fn = { now: () => 'NOW()' }
	return fn
})
vi.mock('../../config/db.js', () => ({ db: dbMock }))

const COMPLETE_PROFILE = {
	bio: 'oi',
	gender: 'f',
	sexual_orientation: 'bi',
	birth_date: new Date('2000-01-01'),
	location_consent: true,
	profile_completed_at: null,
}

beforeEach(() => {
	vi.clearAllMocks()
	dbMock.mockReturnValue(dbBuilder)
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.count.mockReturnValue(dbBuilder)
	dbBuilder.first.mockResolvedValue(undefined)
	dbBuilder.update.mockResolvedValue(1)
})

describe('recalculateCompleteness', () => {
	it('marks profile_completed_at when every required signal is present', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE) // profiles row
			.mockResolvedValueOnce({ count: '1' }) // photos count
			.mockResolvedValueOnce({ count: '2' }) // user_tags count

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).toHaveBeenCalledWith({ profile_completed_at: 'NOW()' })
	})

	it('no-op when already marked previously (one-way)', async () => {
		dbBuilder.first.mockResolvedValueOnce({
			...COMPLETE_PROFILE,
			profile_completed_at: new Date('2026-01-01'),
		})

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op when bio is missing', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...COMPLETE_PROFILE, bio: null })
		await recalculateCompleteness('user-1')
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op when location_consent is null (neither GPS nor manual)', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...COMPLETE_PROFILE, location_consent: null })
		await recalculateCompleteness('user-1')
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('marks when location_consent=false (manual fallback counts as a location)', async () => {
		dbBuilder.first
			.mockResolvedValueOnce({ ...COMPLETE_PROFILE, location_consent: false })
			.mockResolvedValueOnce({ count: '1' })
			.mockResolvedValueOnce({ count: '1' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).toHaveBeenCalledWith({ profile_completed_at: 'NOW()' })
	})

	it('no-op when there are no ready photos', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE)
			.mockResolvedValueOnce({ count: '0' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op when the user has no tags', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE)
			.mockResolvedValueOnce({ count: '1' })
			.mockResolvedValueOnce({ count: '0' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op when the profile row does not exist', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('accepts an optional executor (Knex.Transaction)', async () => {
		const trxBuilder = {
			where: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValueOnce(COMPLETE_PROFILE),
			count: vi.fn().mockReturnThis(),
			update: vi.fn().mockResolvedValue(1),
		}
		const trxMock = vi.fn(() => trxBuilder) as unknown as Parameters<
			typeof recalculateCompleteness
		>[1] & { fn: { now: () => string } }
		;(trxMock as { fn: { now: () => string } }).fn = { now: () => 'NOW()' }
		trxBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE)
			.mockResolvedValueOnce({ count: '1' })
			.mockResolvedValueOnce({ count: '1' })

		await recalculateCompleteness('user-1', trxMock)

		// Quando recebe executor, o default `db` nem é invocado.
		expect(dbMock).not.toHaveBeenCalled()
		expect(trxMock).toHaveBeenCalledWith('profiles')
	})
})
