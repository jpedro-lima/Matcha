import { z } from 'zod'

// Schema único da política de senha do projeto. Reutilizado em:
//   - `validators/auth-schemas.ts` (registerBody.password, resetPassword.newPassword)
//     → falha vira 400 VALIDATION_ERROR no middleware `validate`.
//   - `services/password-policy.ts#assertStrongPassword`
//     → falha vira 422 WEAK_PASSWORD (defense-in-depth para entry points
//        que não passam pelo `validate`, ex.: jobs ou CLI futuras).
//
// Regras: mínimo 8 chars + letra + número + símbolo não-alfanumérico.

export const passwordSchema = z
	.string()
	.min(8, 'must be at least 8 characters long')
	.regex(/[A-Za-z]/, 'must contain at least one letter')
	.regex(/[0-9]/, 'must contain at least one number')
	.regex(/[^A-Za-z0-9]/, 'must contain at least one symbol')
