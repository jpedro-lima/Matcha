export type PhotoStatus = 'pending' | 'ready' | 'failed'

export type PhotoRow = {
	id: string
	user_id: string
	key: string
	mime: string | null
	bytes: number | null
	status: PhotoStatus
	created_at: Date | string
}

export type Photo = {
	id: string
	url: string
	mime: string | null
	bytes: number | null
	status: PhotoStatus
}

// Mapper puro: a URL é gerada pelo service (presignGet) e injetada
// aqui. Mantém esse arquivo livre de I/O — facilita testes e deixa o
// type sem dependência circular com s3.service.
export function photoFromRow(row: PhotoRow, url: string): Photo {
	return {
		id: row.id,
		url,
		mime: row.mime,
		bytes: row.bytes,
		status: row.status,
	}
}
