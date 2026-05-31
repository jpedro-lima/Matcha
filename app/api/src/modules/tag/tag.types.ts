export type TagRow = {
	id: number
	name: string
	created_at: Date | string
}

export type Tag = {
	id: number
	name: string
}

export function tagFromRow(row: Pick<TagRow, 'id' | 'name'>): Tag {
	return { id: row.id, name: row.name }
}
