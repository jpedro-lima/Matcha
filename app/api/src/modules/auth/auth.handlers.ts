import type { Request, RequestHandler } from 'express'
import { env } from '../../config/env.js'
import { AppError } from '../../utils/app-error.js'
import {
	forgotPassword as forgotPasswordService,
	getCurrentUser as getCurrentUserService,
	login as loginService,
	logout as logoutService,
	refresh as refreshService,
	register as registerService,
	resendVerificationEmail as resendVerificationEmailService,
	resetPassword as resetPasswordService,
	verifyEmail as verifyEmailService,
} from './auth.service.js'

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

export const register: RequestHandler = async (req, res) => {
	const { user, emailSent } = await registerService(req.body)

	if (emailSent) {
		res.status(201).json({ message: 'Account created. Please check your email.', user })
		return
	}

	res.status(202).json({
		message:
			'Account created, but we could not send the verification email. Please request a new one at /auth/resend-verification.',
		user,
	})
}

export const verifyEmail: RequestHandler = async (req, res) => {
	await verifyEmailService(req.params.token as string)
	res.status(200).json({ message: 'Email verified.' })
}

export const resendVerification: RequestHandler = async (req, res) => {
	const { email } = req.body as { email: string }
	await resendVerificationEmailService(email)
	res.status(200).json({
		message: 'If the email exists and is not verified, a new verification link was sent.',
	})
}

export const login: RequestHandler = async (req, res) => {
	const { username, password } = req.body as { username: string; password: string }
	const result = await loginService(username, password)

	res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions())
	res.status(200).json({ accessToken: result.accessToken, user: result.user })
}

export const refresh: RequestHandler = async (req, res) => {
	const refreshToken = readRefreshCookie(req)
	if (!refreshToken) {
		throw new AppError('REFRESH_INVALID', 401, 'Refresh token is missing.')
	}

	const result = await refreshService(refreshToken)
	res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions())
	res.status(200).json({ accessToken: result.accessToken })
}

export const logout: RequestHandler = async (req, res) => {
	const refreshToken = readRefreshCookie(req)
	if (refreshToken) await logoutService(refreshToken)
	res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
	res.status(204).send()
}

export const forgotPassword: RequestHandler = async (req, res) => {
	const { email } = req.body as { email: string }
	await forgotPasswordService(email)
	res.status(200).json({ message: 'If the email exists, we will send instructions.' })
}

export const resetPassword: RequestHandler = async (req, res) => {
	const { token, newPassword } = req.body as { token: string; newPassword: string }
	await resetPasswordService(token, newPassword)
	res.status(200).json({ message: 'Password reset successful.' })
}

export const me: RequestHandler = async (req, res) => {
	if (!req.user) {
		throw new AppError('MISSING_TOKEN', 401, 'Missing token.')
	}
	const user = await getCurrentUserService(req.user.id)
	res.json(user)
}
