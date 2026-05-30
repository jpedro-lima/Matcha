import type { Profile } from '../../common/types/profile.types.js'
import type { PublicUser } from '../../common/types/user.types.js'

export type UserWithProfile = {
	user: PublicUser
	profile: Profile
}
