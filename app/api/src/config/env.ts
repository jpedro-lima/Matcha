import { z } from 'zod'

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	API_PORT: z.coerce.number().int().positive().default(3000),
	APP_URL: z.url(),

	POSTGRES_USER: z.string().min(1),
	POSTGRES_PASSWORD: z.string().min(1),
	POSTGRES_DB: z.string().min(1),
	POSTGRES_HOST: z.string().min(1),
	POSTGRES_PORT: z.coerce.number().int().positive().default(5432),

	JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
	JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
	JWT_ACCESS_EXPIRES: z.string().default('15m'),
	JWT_REFRESH_EXPIRES: z.string().default('7d'),

	SMTP_DISABLED: z.stringbool().default(false),

	SMTP_HOST: z.string().min(1),
	SMTP_PORT: z.coerce.number().int().positive(),
	SMTP_USER: z.string().min(1),
	SMTP_PASS: z.string().min(1),
	SMTP_FROM: z.email(),

	// UPLOAD_DIR: z.string().min(1),
	// MAX_PHOTO_SIZE_MB: z.coerce.number().int().positive().default(5),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error('❌ Invalid environment variables:')
	for (const issue of parsed.error.issues) {
		console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
	}
	process.exit(1)
}

export const env = parsed.data
export type Env = z.infer<typeof envSchema>
