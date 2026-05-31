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
	it('marca profile_completed_at quando todos os sinais estão presentes', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE) // profiles row
			.mockResolvedValueOnce({ count: '1' }) // photos count
			.mockResolvedValueOnce({ count: '2' }) // user_tags count

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).toHaveBeenCalledWith({ profile_completed_at: 'NOW()' })
	})

	it('no-op quando já foi marcado antes (one-way)', async () => {
		dbBuilder.first.mockResolvedValueOnce({
			...COMPLETE_PROFILE,
			profile_completed_at: new Date('2026-01-01'),
		})

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op quando bio ausente', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...COMPLETE_PROFILE, bio: null })
		await recalculateCompleteness('user-1')
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op quando location_consent é null (nem GPS nem manual)', async () => {
		dbBuilder.first.mockResolvedValueOnce({ ...COMPLETE_PROFILE, location_consent: null })
		await recalculateCompleteness('user-1')
		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op quando location_consent=false (manual) mas todo resto OK — manual conta como location', async () => {
		dbBuilder.first
			.mockResolvedValueOnce({ ...COMPLETE_PROFILE, location_consent: false })
			.mockResolvedValueOnce({ count: '1' })
			.mockResolvedValueOnce({ count: '1' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).toHaveBeenCalledWith({ profile_completed_at: 'NOW()' })
	})

	it('no-op sem fotos ready', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE)
			.mockResolvedValueOnce({ count: '0' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op sem tags', async () => {
		dbBuilder.first
			.mockResolvedValueOnce(COMPLETE_PROFILE)
			.mockResolvedValueOnce({ count: '1' })
			.mockResolvedValueOnce({ count: '0' })

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('no-op quando profile row não existe', async () => {
		dbBuilder.first.mockResolvedValueOnce(undefined)

		await recalculateCompleteness('user-1')

		expect(dbBuilder.update).not.toHaveBeenCalled()
	})

	it('aceita executor (Knex.Transaction) opcional', async () => {
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
