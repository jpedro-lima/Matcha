import { describe, expect, it } from 'vitest'
import {
	signAccess,
	signRefresh,
	verifyAccess,
	verifyRefresh,
} from '../services/jwt.service.js'

describe('JWT — access e refresh são tokens distintos', () => {
	it('verifyAccess rejeita um refresh token', () => {
		const refreshToken = signRefresh({ sub: 'user-1', jti: 'jti-1' })
		expect(() => verifyAccess(refreshToken)).toThrow()
	})

	it('verifyRefresh rejeita um access token', () => {
		const accessToken = signAccess({ sub: 'user-1', username: 'ana' })
		expect(() => verifyRefresh(accessToken)).toThrow()
	})
})
