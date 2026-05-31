import { describe, expect, it } from 'vitest'
import {
	signAccess,
	signRefresh,
	verifyAccess,
	verifyRefresh,
} from '../services/jwt.service.js'

describe('JWT — access and refresh are distinct tokens', () => {
	it('verifyAccess rejects a refresh token', () => {
		const refreshToken = signRefresh({ sub: 'user-1', jti: 'jti-1' })
		expect(() => verifyAccess(refreshToken)).toThrow()
	})

	it('verifyRefresh rejects an access token', () => {
		const accessToken = signAccess({ sub: 'user-1', username: 'ana' })
		expect(() => verifyRefresh(accessToken)).toThrow()
	})
})
