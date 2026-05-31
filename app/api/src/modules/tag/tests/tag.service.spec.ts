import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recalculateCompleteness } from '../../../common/services/completeness.service.js'
import { getUserTags, replaceUserTags, searchTags } from '../tag.service.js'

vi.mock('../../../common/services/completeness.service.js', () => ({
	recalculateCompleteness: vi.fn(),
}))

const dbBuilder = vi.hoisted(() => ({
	where: vi.fn(),
	whereIn: vi.fn(),
	join: vi.fn(),
	leftJoin: vi.fn(),
	groupBy: vi.fn(),
	orderBy: vi.fn(),
	orderByRaw: vi.fn(),
	limit: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	delete: vi.fn(),
	onConflict: vi.fn(),
	ignore: vi.fn(),
}))
const dbMock = vi.hoisted(() => {
	const fn = vi.fn() as ReturnType<typeof vi.fn> & {
		transaction: ReturnType<typeof vi.fn>
	}
	fn.transaction = vi.fn()
	return fn
})
vi.mock('../../../config/db.js', () => ({ db: dbMock }))

beforeEach(() => {
	vi.clearAllMocks()
	dbMock.mockReturnValue(dbBuilder)
	dbMock.transaction.mockImplementation(
		async (cb: (trx: typeof dbMock) => Promise<unknown>) => cb(dbMock),
	)
	dbBuilder.where.mockReturnValue(dbBuilder)
	dbBuilder.whereIn.mockReturnValue(dbBuilder)
	dbBuilder.join.mockReturnValue(dbBuilder)
	dbBuilder.leftJoin.mockReturnValue(dbBuilder)
	dbBuilder.groupBy.mockReturnValue(dbBuilder)
	dbBuilder.orderBy.mockReturnValue(dbBuilder)
	dbBuilder.orderByRaw.mockReturnValue(dbBuilder)
	dbBuilder.limit.mockReturnValue(dbBuilder)
	dbBuilder.select.mockResolvedValue([])
	dbBuilder.insert.mockReturnValue(dbBuilder)
	dbBuilder.delete.mockResolvedValue(0)
	dbBuilder.onConflict.mockReturnValue(dbBuilder)
	dbBuilder.ignore.mockResolvedValue(undefined)
})

describe('tagService.getUserTags', () => {
	it('lists user tags ordered by name', async () => {
		dbBuilder.select.mockResolvedValueOnce([
			{ id: 1, name: 'music' },
			{ id: 2, name: 'vegan' },
		])

		const tags = await getUserTags('user-1')

		expect(dbMock).toHaveBeenCalledWith('user_tags as ut')
		expect(dbBuilder.join).toHaveBeenCalledWith('tags as t', 't.id', 'ut.tag_id')
		expect(dbBuilder.where).toHaveBeenCalledWith('ut.user_id', 'user-1')
		expect(dbBuilder.orderBy).toHaveBeenCalledWith('t.name', 'asc')
		expect(tags).toEqual([
			{ id: 1, name: 'music' },
			{ id: 2, name: 'vegan' },
		])
	})

	it('returns an empty array when the user has no tags', async () => {
		dbBuilder.select.mockResolvedValueOnce([])
		const tags = await getUserTags('user-1')
		expect(tags).toEqual([])
	})
})

describe('tagService.replaceUserTags', () => {
	it('creates missing tags (onConflict ignore) and links them in a transaction', async () => {
		// Após o insert, query .whereIn devolve as rows criadas
		dbBuilder.select.mockResolvedValueOnce([
			{ id: 7, name: 'music' },
			{ id: 8, name: 'vegan' },
		])

		const result = await replaceUserTags('user-1', ['music', 'vegan'])

		expect(dbMock.transaction).toHaveBeenCalledTimes(1)
		expect(dbBuilder.insert).toHaveBeenCalledWith([{ name: 'music' }, { name: 'vegan' }])
		expect(dbBuilder.onConflict).toHaveBeenCalledWith('name')
		expect(dbBuilder.ignore).toHaveBeenCalled()

		// Deleta vínculos antigos
		expect(dbBuilder.delete).toHaveBeenCalled()
		// Insere os novos vínculos
		expect(dbBuilder.insert).toHaveBeenCalledWith([
			{ user_id: 'user-1', tag_id: 7 },
			{ user_id: 'user-1', tag_id: 8 },
		])

		expect(result).toEqual([
			{ id: 7, name: 'music' },
			{ id: 8, name: 'vegan' },
		])
	})

	it('dedupes identical names before insert', async () => {
		dbBuilder.select.mockResolvedValueOnce([{ id: 7, name: 'music' }])

		await replaceUserTags('user-1', ['music', 'music', 'music'])

		expect(dbBuilder.insert).toHaveBeenCalledWith([{ name: 'music' }])
		expect(dbBuilder.whereIn).toHaveBeenCalledWith('name', ['music'])
	})

	it('empty array: clears user links without touching tags', async () => {
		const result = await replaceUserTags('user-1', [])

		expect(dbBuilder.delete).toHaveBeenCalled()
		expect(dbBuilder.insert).not.toHaveBeenCalled()
		expect(result).toEqual([])
	})

	it('triggers recalculateCompleteness INSIDE the transaction (passes trx)', async () => {
		dbBuilder.select.mockResolvedValueOnce([{ id: 7, name: 'music' }])

		await replaceUserTags('user-1', ['music'])

		// O segundo arg passado é o executor — deve ser o próprio dbMock (que
		// faz papel de trx no nosso mock de transaction).
		expect(recalculateCompleteness).toHaveBeenCalledWith('user-1', dbMock)
	})
})

describe('tagService.searchTags', () => {
	it('searches by prefix, orders by usage desc + name, limit 20', async () => {
		dbBuilder.select.mockResolvedValueOnce([
			{ id: 1, name: 'music' },
			{ id: 2, name: 'mucho' },
		])

		const tags = await searchTags('mu')

		expect(dbMock).toHaveBeenCalledWith('tags as t')
		expect(dbBuilder.leftJoin).toHaveBeenCalledWith(
			'user_tags as ut',
			'ut.tag_id',
			't.id',
		)
		expect(dbBuilder.where).toHaveBeenCalledWith('t.name', 'like', 'mu%')
		expect(dbBuilder.groupBy).toHaveBeenCalledWith('t.id', 't.name')
		expect(dbBuilder.orderByRaw).toHaveBeenCalledWith('COUNT(ut.tag_id) DESC, t.name ASC')
		expect(dbBuilder.limit).toHaveBeenCalledWith(20)
		expect(tags).toEqual([
			{ id: 1, name: 'music' },
			{ id: 2, name: 'mucho' },
		])
	})
})
