import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../password-service.js'

describe('passwordService', () => {
	describe('hashPassword', () => {
		it('retorna string diferente do input', async () => {
			const plain = 'Forte#2026!'
			const hash = await hashPassword(plain)

			expect(hash).not.toBe(plain)
			expect(typeof hash).toBe('string')
			expect(hash.length).toBeGreaterThan(0)
		})

		it('usa bcrypt com cost ≥ 12 (prefixo $2b$12$ ou maior)', async () => {
			const hash = await hashPassword('Forte#2026!')
			// formato bcrypt: $<algo>$<cost>$<salt+hash>
			// ex.: $2b$12$abcdefg...
			const match = hash.match(/^\$2[aby]\$(\d{2})\$/)
			expect(match).not.toBeNull()
			const cost = Number(match?.[1])
			expect(cost).toBeGreaterThanOrEqual(12)
		})

		it('produz hashes diferentes para o mesmo input (salts distintos)', async () => {
			const plain = 'Forte#2026!'
			const [h1, h2] = await Promise.all([hashPassword(plain), hashPassword(plain)])
			expect(h1).not.toBe(h2)
		})
	})

	describe('verifyPassword', () => {
		it('retorna true para a senha correta', async () => {
			const plain = 'Forte#2026!'
			const hash = await hashPassword(plain)
			await expect(verifyPassword(plain, hash)).resolves.toBe(true)
		})

		it('retorna false para senha errada', async () => {
			const hash = await hashPassword('Forte#2026!')
			await expect(verifyPassword('outra-senha', hash)).resolves.toBe(false)
		})
	})
})
