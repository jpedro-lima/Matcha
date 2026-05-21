import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { AccessPayload, RefreshPayload } from '../models/jwt.js'

const ACCESS_AUDIENCE = 'matcha:access'
const REFRESH_AUDIENCE = 'matcha:refresh'

type DecodedAccess = AccessPayload & jwt.JwtPayload
type DecodedRefresh = RefreshPayload & jwt.JwtPayload

const signOptions = (
	audience: string,
	expiresIn: string,
): SignOptions => ({
	audience,
	expiresIn: expiresIn as SignOptions['expiresIn'],
})

const verifyOptions = (audience: string): VerifyOptions => ({ audience })

export function signAccess(payload: AccessPayload): string {
	return jwt.sign(payload, env.JWT_ACCESS_SECRET, signOptions(ACCESS_AUDIENCE, env.JWT_ACCESS_EXPIRES))
}

export function signRefresh(payload: RefreshPayload): string {
	return jwt.sign(
		payload,
		env.JWT_REFRESH_SECRET,
		signOptions(REFRESH_AUDIENCE, env.JWT_REFRESH_EXPIRES),
	)
}

export function verifyAccess(token: string): DecodedAccess {
	return jwt.verify(token, env.JWT_ACCESS_SECRET, verifyOptions(ACCESS_AUDIENCE)) as DecodedAccess
}

export function verifyRefresh(token: string): DecodedRefresh {
	return jwt.verify(
		token,
		env.JWT_REFRESH_SECRET,
		verifyOptions(REFRESH_AUDIENCE),
	) as DecodedRefresh
}
