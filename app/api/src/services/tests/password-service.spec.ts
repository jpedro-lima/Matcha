import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../password-service.js'

describe('passwordService', () => {
	describe('hashPassword', () => {
		it('returns a string different from the input', async () => {
			const plain = 'Forte#2026!'
			const hash = await hashPassword(plain)

			expect(hash).not.toBe(plain)
			expect(typeof hash).toBe('string')
			expect(hash.length).toBeGreaterThan(0)
		})

		it('uses bcrypt with cost >= 12 (prefix $2b$12$ or higher)', async () => {
			const hash = await hashPassword('Forte#2026!')
			// bcrypt format: $<algo>$<cost>$<salt+hash>
			// e.g.: $2b$12$abcdefg...
			const match = hash.match(/^\$2[aby]\$(\d{2})\$/)
			expect(match).not.toBeNull()
			const cost = Number(match?.[1])
			expect(cost).toBeGreaterThanOrEqual(12)
		})

		it('produces different hashes for the same input (distinct salts)', async () => {
			const plain = 'Forte#2026!'
			const [h1, h2] = await Promise.all([hashPassword(plain), hashPassword(plain)])
			expect(h1).not.toBe(h2)
		})
	})

	describe('verifyPassword', () => {
		it('returns true for the correct password', async () => {
			const plain = 'Forte#2026!'
			const hash = await hashPassword(plain)
			await expect(verifyPassword(plain, hash)).resolves.toBe(true)
		})

		it('returns false for a wrong password', async () => {
			const hash = await hashPassword('Forte#2026!')
			await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
		})
	})
})
