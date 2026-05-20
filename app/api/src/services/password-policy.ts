import { z } from 'zod'
import { AppError } from '../utils/app-error.js'

// Política de senha: mínimo 8 chars + ao menos uma letra, um número e um
// símbolo (qualquer não-alfanumérico). Sem dicionário/zxcvbn — validação 100%
// regex via Zod, conforme convenção do projeto.

const passwordSchema = z
	.string()
	.min(8, 'must be at least 8 characters long')
	.regex(/[A-Za-z]/, 'must contain at least one letter')
	.regex(/[0-9]/, 'must contain at least one number')
	.regex(/[^A-Za-z0-9]/, 'must contain at least one symbol')

export function assertStrongPassword(plain: string): void {
	const result = passwordSchema.safeParse(plain)
	if (result.success) return

	const details = result.error.issues.map((issue) => issue.message)
	throw new AppError(
		'WEAK_PASSWORD',
		422,
		'A senha não atende aos requisitos de segurança.',
		details,
	)
}
