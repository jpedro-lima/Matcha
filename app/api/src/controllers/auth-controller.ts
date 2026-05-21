import type { Request, RequestHandler } from 'express'
import { env } from '../config/env.js'
import {
	forgotPassword as forgotPasswordService,
	getCurrentUser as getCurrentUserService,
	login as loginService,
	logout as logoutService,
	refresh as refreshService,
	register as registerService,
	resetPassword as resetPasswordService,
	verifyEmail as verifyEmailService,
} from '../services/auth-service.js'
import { AppError } from '../utils/app-error.js'

// O refresh token vive num cookie httpOnly + SameSite=Strict; controllers
// abaixo só leem/setam esse cookie e delegam a regra ao authService.

const REFRESH_COOKIE = 'matcha_refresh'

function refreshCookieOptions() {
	const secure = env.APP_URL.startsWith('https://')
	return {
		httpOnly: true,
		secure,
		sameSite: 'strict' as const,
		path: '/api/auth',
	}
}

const readRefreshCookie = (req: Request): string | undefined => {
	const cookies = req.cookies as Record<string, string> | undefined
	return cookies?.[REFRESH_COOKIE]
}

// ── POST /auth/register ────────────────────────────────────────────
export const registerHandler: RequestHandler = async (req, res) => {
	const user = await registerService(req.body)
	res.status(201).json({ message: 'Account created. Please check your email.', user })
}

// ── GET /auth/verify-email/:token ──────────────────────────────────
export const verifyEmailHandler: RequestHandler = async (req, res) => {
	await verifyEmailService(req.params.token as string)
	res.status(200).json({ message: 'Email verified.' })
}

// ── POST /auth/login ───────────────────────────────────────────────
export const loginHandler: RequestHandler = async (req, res) => {
	const { username, password } = req.body as { username: string; password: string }
	const result = await loginService(username, password)

	res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions())
	res.status(200).json({ accessToken: result.accessToken, user: result.user })
}

// ── POST /auth/refresh ─────────────────────────────────────────────
export const refreshHandler: RequestHandler = async (req, res) => {
	const refreshToken = readRefreshCookie(req)
	if (!refreshToken) {
		throw new AppError('REFRESH_INVALID', 401, 'Refresh token is missing.')
	}

	const result = await refreshService(refreshToken)
	res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions())
	res.status(200).json({ accessToken: result.accessToken })
}

// ── POST /auth/logout ──────────────────────────────────────────────
export const logoutHandler: RequestHandler = async (req, res) => {
	const refreshToken = readRefreshCookie(req)
	if (refreshToken) await logoutService(refreshToken)
	res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
	res.status(204).send()
}

// ── POST /auth/forgot-password ─────────────────────────────────────
export const forgotPasswordHandler: RequestHandler = async (req, res) => {
	const { email } = req.body as { email: string }
	await forgotPasswordService(email)
	res.status(200).json({ message: 'If the email exists, we will send instructions.' })
}

// ── POST /auth/reset-password ──────────────────────────────────────
export const resetPasswordHandler: RequestHandler = async (req, res) => {
	const { token, newPassword } = req.body as { token: string; newPassword: string }
	await resetPasswordService(token, newPassword)
	res.status(200).json({ message: 'Password reset successful.' })
}

// ── GET /auth/me ───────────────────────────────────────────────────

export const meHandler: RequestHandler = async (req, res) => {
	if (!req.user) {
		throw new AppError('MISSING_TOKEN', 401, 'Missing token.')
	}

	const user = await getCurrentUserService(req.user.id)
	res.json(user)
}
