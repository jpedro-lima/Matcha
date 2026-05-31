import { recalculateCompleteness } from '../../common/services/completeness.service.js'
import { sendVerificationEmail } from '../../common/services/email.service.js'
import { issueEmailToken } from '../../common/services/token.service.js'
import { profileFromRow, type ProfileRow } from '../../common/types/profile.types.js'
import { publicUserFromRow, type UserRow } from '../../common/types/user.types.js'
import { db } from '../../config/db.js'
import { logger } from '../../config/logger.js'
import { AppError } from '../../utils/app-error.js'
import type { LocationBody, UpdateUserBody } from './user.schemas.js'
import type { UserWithProfile } from './user.types.js'

type UserSlim = Pick<UserRow, 'id' | 'email' | 'username' | 'email_verified'>

export async function getProfile(userId: string): Promise<UserWithProfile> {
	const user = await db('users')
		.where({ id: userId })
		.first<UserSlim>(['id', 'email', 'username', 'email_verified'])
	if (!user) throw new AppError('NOT_FOUND', 404, 'User not found.')

	const profile = await db('profiles').where({ user_id: userId }).first<ProfileRow>()
	if (!profile) throw new AppError('NOT_FOUND', 404, 'Profile not found.')

	return {
		user: publicUserFromRow({ ...user, email_verified: user.email_verified ?? false }),
		profile: profileFromRow(profile),
	}
}

export async function updateUser(
	userId: string,
	input: UpdateUserBody,
): Promise<UserWithProfile> {
	const userPatch: Record<string, unknown> = {}
	const profilePatch: Record<string, unknown> = {}

	if (input.firstName) userPatch.first_name = input.firstName
	if (input.lastName) userPatch.last_name = input.lastName

	if (input.bio) profilePatch.bio = input.bio
	if (input.gender) profilePatch.gender = input.gender
	if (input.sexualOrientation) profilePatch.sexual_orientation = input.sexualOrientation
	if (input.birthDate) profilePatch.birth_date = input.birthDate

	let emailToVerify: string | undefined
	if (input.email) {
		const taken = await db('users')
			.where({ email: input.email })
			.whereNot({ id: userId })
			.first()
		if (taken) throw new AppError('EMAIL_EXISTS', 409, 'Email is already registered.')

		userPatch.email = input.email
		userPatch.email_verified = false
		emailToVerify = input.email
	}

	const hasWork =
		Object.keys(userPatch).length > 0 ||
		Object.keys(profilePatch).length > 0 ||
		emailToVerify !== undefined

	if (!hasWork) return getProfile(userId)

	let issuedToken: string | undefined
	await db.transaction(async (trx) => {
		if (Object.keys(userPatch).length > 0) {
			await trx('users').where({ id: userId }).update(userPatch)
		}
		if (Object.keys(profilePatch).length > 0) {
			await trx('profiles').where({ user_id: userId }).update(profilePatch)
		}
		if (emailToVerify) {
			await trx('email_tokens').where({ user_id: userId }).delete()
			issuedToken = await issueEmailToken(userId, trx)
		}
	})

	if (emailToVerify && issuedToken) {
		try {
			await sendVerificationEmail(emailToVerify, issuedToken)
		} catch (err) {
			logger.error(
				{ err, userId, email: emailToVerify },
				'verification email send failed on email change',
			)
		}
	}

	await recalculateCompleteness(userId)
	return getProfile(userId)
}

export async function updateLocation(
	userId: string,
	input: LocationBody,
): Promise<UserWithProfile> {
	const patch: Record<string, unknown> =
		input.consent === true
			? {
					location_consent: true,
					latitude: input.latitude,
					longitude: input.longitude,
					city: null,
					neighborhood: null,
				}
			: {
					location_consent: false,
					latitude: null,
					longitude: null,
					city: input.city,
					neighborhood: input.neighborhood,
				}

	const updated = await db('profiles').where({ user_id: userId }).update(patch)
	if (updated === 0) {
		throw new AppError('NOT_FOUND', 404, 'Profile not found.')
	}

	await recalculateCompleteness(userId)
	return getProfile(userId)
}
