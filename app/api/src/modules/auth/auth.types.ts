import type { PublicUser } from '../../common/types/user.types.js'

// Outputs do auth.service. **Inputs** (corpos HTTP) vêm de `auth.schemas.ts`
// via `z.infer<typeof xxxBodySchema>` — não dupliquei aqui. Para o tipo do
// body do register, use `RegisterBody` exportado de `./auth.schemas.js`.

export type LoginResult = {
	accessToken: string
	refreshToken: string
	user: Pick<PublicUser, 'id' | 'username' | 'email'>
}

export type RegisterResult = {
	user: PublicUser
	emailSent: boolean
}
