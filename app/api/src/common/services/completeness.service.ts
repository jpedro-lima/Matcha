import type { Knex } from 'knex'
import { db } from '../../config/db.js'

type Executor = Knex | Knex.Transaction

type ProfileSignals = {
	bio: string | null
	gender: string | null
	sexual_orientation: string | null
	birth_date: Date | string | null
	location_consent: boolean | null
	profile_completed_at: Date | string | null
}

// Hook idempotente + one-way: marca `profile_completed_at = now()` na
// primeira vez que TODOS os campos obrigatórios estão presentes. Se já
// foi marcado antes, não toca (perfil "completou" — não regredimos pra
// evitar UX confusa de timestamp pulando).
//
// Campos obrigatórios:
//   - users (via FK): n/a (não checado aqui — perfil só existe se o user existir)
//   - profiles: bio, gender, sexual_orientation, birth_date, location_consent (≠ null)
//   - photos: pelo menos 1 com status='ready'
//   - user_tags: pelo menos 1 vínculo
//
// `executor` opcional para participar de transações já abertas — segue
// o mesmo pattern de `issueEmailToken(userId, executor?)`.
export async function recalculateCompleteness(
	userId: string,
	executor: Executor = db,
): Promise<void> {
	const profile = await executor('profiles')
		.where({ user_id: userId })
		.first<ProfileSignals>(
			'bio',
			'gender',
			'sexual_orientation',
			'birth_date',
			'location_consent',
			'profile_completed_at',
		)

	if (!profile || profile.profile_completed_at) return

	if (
		!profile.bio ||
		!profile.gender ||
		!profile.sexual_orientation ||
		!profile.birth_date ||
		profile.location_consent === null
	) {
		return
	}

	const photoRow = await executor('photos')
		.where({ user_id: userId, status: 'ready' })
		.count<{ count: string }>({ count: '*' })
		.first()
	if (Number(photoRow?.count ?? 0) < 1) return

	const tagRow = await executor('user_tags')
		.where({ user_id: userId })
		.count<{ count: string }>({ count: '*' })
		.first()
	if (Number(tagRow?.count ?? 0) < 1) return

	await executor('profiles')
		.where({ user_id: userId })
		.update({ profile_completed_at: executor.fn.now() })
}
