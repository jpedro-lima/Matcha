import { passwordSchema } from '../validators/password-schema.js'
import { AppError } from '../utils/app-error.js'

// Defense-in-depth: roda o mesmo `passwordSchema` que o `validate` middleware
// usa nos bodies de register/reset, mas mapeia falhas para `WEAK_PASSWORD` 422
// em vez de `VALIDATION_ERROR` 400. Necessário para entry points que NÃO
// passam pela camada HTTP (jobs, CLI, testes diretos do service).

export function assertStrongPassword(plain: string): void {
	const result = passwordSchema.safeParse(plain)
	if (result.success) return

	const details = result.error.issues.map((issue) => issue.message)
	throw new AppError(
		'WEAK_PASSWORD',
		422,
		'Password does not meet the security requirements.',
		details,
	)
}
