import { recalculateCompleteness } from '../../common/services/completeness.service.js'
import { db } from '../../config/db.js'
import type { Tag, TagRow } from './tag.types.js'
import { tagFromRow } from './tag.types.js'

const AUTOCOMPLETE_LIMIT = 20

export async function getUserTags(userId: string): Promise<Tag[]> {
	const rows = await db('user_tags as ut')
		.join('tags as t', 't.id', 'ut.tag_id')
		.where('ut.user_id', userId)
		.orderBy('t.name', 'asc')
		.select<Pick<TagRow, 'id' | 'name'>[]>('t.id', 't.name')
	return rows.map(tagFromRow)
}

export async function replaceUserTags(userId: string, names: string[]): Promise<Tag[]> {
	const unique = [...new Set(names)]

	return db.transaction(async (trx) => {
		if (unique.length === 0) {
			await trx('user_tags').where({ user_id: userId }).delete()

			await recalculateCompleteness(userId, trx)
			return []
		}

		await trx('tags')
			.insert(unique.map((name) => ({ name })))
			.onConflict('name')
			.ignore()

		const tagRows = await trx('tags')
			.whereIn('name', unique)
			.select<Pick<TagRow, 'id' | 'name'>[]>('id', 'name')

		await trx('user_tags').where({ user_id: userId }).delete()
		await trx('user_tags').insert(tagRows.map((t) => ({ user_id: userId, tag_id: t.id })))

		await recalculateCompleteness(userId, trx)

		return tagRows.sort((a, b) => a.name.localeCompare(b.name)).map(tagFromRow)
	})
}

export async function searchTags(query: string): Promise<Tag[]> {
	const rows = await db('tags as t')
		.leftJoin('user_tags as ut', 'ut.tag_id', 't.id')
		.where('t.name', 'like', `${query}%`)
		.groupBy('t.id', 't.name')
		.orderByRaw('COUNT(ut.tag_id) DESC, t.name ASC')
		.limit(AUTOCOMPLETE_LIMIT)
		.select<Pick<TagRow, 'id' | 'name'>[]>('t.id', 't.name')
	return rows.map(tagFromRow)
}
