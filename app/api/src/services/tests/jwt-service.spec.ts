import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { env } from '../../config/env.js'
import type { AccessPayload, RefreshPayload } from '../../models/jwt.js'
import {
	signAccess,
	signRefresh,
	verifyAccess,
	verifyRefresh,
} from '../jwt-service.js'

const sampleAccess: AccessPayload = { sub: 'user-123', username: 'ana' }
const sampleRefresh: RefreshPayload = { sub: 'user-123', jti: 'jti-abc' }

describe('jwtService', () => {
	describe('signAccess + verifyAccess', () => {
		it('produces a decodable JWT that returns the original payload', () => {
			const token = signAccess(sampleAccess)
			expect(token.split('.')).toHaveLength(3)
			const decoded = verifyAccess(token)
			expect(decoded.sub).toBe(sampleAccess.sub)
			expect(decoded.username).toBe(sampleAccess.username)
		})

		it('includes `exp` and `iat` in the token', () => {
			const token = signAccess(sampleAccess)
			const decoded = verifyAccess(token)
			expect(decoded.exp).toBeGreaterThan(0)
			expect(decoded.iat).toBeGreaterThan(0)
		})

		it('rejects a token signed with a wrong secret', () => {
			const fake = jwt.sign(sampleAccess, 'wrong-secret-of-32-chars-min-len', {
				expiresIn: '15m',
			})
			expect(() => verifyAccess(fake)).toThrow()
		})

		it('rejects an expired token', () => {
			const expired = jwt.sign(sampleAccess, env.JWT_ACCESS_SECRET, { expiresIn: -1 })
			expect(() => verifyAccess(expired)).toThrow()
		})
	})

	describe('signRefresh + verifyRefresh', () => {
		it('produces a decodable JWT that returns the original payload', () => {
			const token = signRefresh(sampleRefresh)
			const decoded = verifyRefresh(token)
			expect(decoded.sub).toBe(sampleRefresh.sub)
			expect(decoded.jti).toBe(sampleRefresh.jti)
		})

		it('refresh has a longer TTL than access', () => {
			const access = jwt.decode(signAccess(sampleAccess)) as jwt.JwtPayload
			const refresh = jwt.decode(signRefresh(sampleRefresh)) as jwt.JwtPayload
			const accessTtl = (access.exp ?? 0) - (access.iat ?? 0)
			const refreshTtl = (refresh.exp ?? 0) - (refresh.iat ?? 0)
			expect(refreshTtl).toBeGreaterThan(accessTtl)
		})

		it('verifyAccess does not accept a refresh token (and vice-versa)', () => {
			const refreshToken = signRefresh(sampleRefresh)
			expect(() => verifyAccess(refreshToken)).toThrow()

			const accessToken = signAccess(sampleAccess)
			expect(() => verifyRefresh(accessToken)).toThrow()
		})
	})
})
