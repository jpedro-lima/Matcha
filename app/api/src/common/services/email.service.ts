import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
	if (cachedTransporter) return cachedTransporter
	cachedTransporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_PORT === 465,
		auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
	})
	return cachedTransporter
}

type SendArgs = {
	to: string
	subject: string
	text: string
	html?: string
}

async function send({ to, subject, text, html }: SendArgs): Promise<void> {
	if (env.SMTP_DISABLED) {
		logger.warn({ to, subject, text }, 'SMTP_DISABLED: email NOT sent (dev)')
		return
	}
	const transporter = getTransporter()
	const info = await transporter.sendMail({
		from: 'jpedrones@hotmail.com',
		to,
		subject,
		text,
		html,
	})
	logger.info({ messageId: info.messageId, to, subject }, 'email sent')
}

const verifyUrl = (token: string): string =>
	`${env.APP_URL}/api/auth/verify-email/${token}`
const resetUrl = (token: string): string => `${env.APP_URL}/reset-password?token=${token}`

export function sendVerificationEmail(to: string, token: string): Promise<void> {
	const url = verifyUrl(token)
	return send({
		to,
		subject: 'Confirm your Matcha email',
		text: `Confirm your email by clicking the link: ${url}\n\nThe link expires in 24h.`,
		html: `<p>Confirm your email by clicking the link below.</p><p><a href="${url}">${url}</a></p><p>The link expires in 24h.</p>`,
	})
}

export function sendPasswordResetEmail(to: string, token: string): Promise<void> {
	const url = resetUrl(token)
	return send({
		to,
		subject: 'Matcha password reset',
		text: `To reset your password, open: ${url}\n\nThe link expires in 1h. If this was not you, ignore this email.`,
		html: `<p>To reset your password, open the link below.</p><p><a href="${url}">${url}</a></p><p>The link expires in 1h. If this was not you, ignore this email.</p>`,
	})
}
