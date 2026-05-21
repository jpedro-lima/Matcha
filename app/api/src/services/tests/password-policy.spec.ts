import { describe, expect, it } from 'vitest'
import { AppError } from '../../utils/app-error.js'
import { assertStrongPassword } from '../password-policy.js'

describe('passwordPolicy', () => {
	describe('rejects weak passwords', () => {
		it('throws WEAK_PASSWORD for short password (< 8 chars)', () => {
			expect(() => assertStrongPassword('Ab1!')).toThrow(AppError)
		})

		it('throws WEAK_PASSWORD for letters-only password', () => {
			try {
				assertStrongPassword('lettersonly')
				expect.fail('should have thrown')
			} catch (err) {
				expect(err).toBeInstanceOf(AppError)
				expect((err as AppError).code).toBe('WEAK_PASSWORD')
				expect((err as AppError).status).toBe(422)
			}
		})

		it('throws WEAK_PASSWORD when number is missing', () => {
			expect(() => assertStrongPassword('NoNumber!')).toThrow(AppError)
		})

		it('throws WEAK_PASSWORD when symbol is missing', () => {
			expect(() => assertStrongPassword('NoSymbol123')).toThrow(AppError)
		})

		it('throws WEAK_PASSWORD when letter is missing', () => {
			expect(() => assertStrongPassword('12345678!@')).toThrow(AppError)
		})

		it('exposes broken rules in `details`', () => {
			try {
				assertStrongPassword('abc')
				expect.fail('should have thrown')
			} catch (err) {
				expect(err).toBeInstanceOf(AppError)
				const details = (err as AppError).details
				expect(Array.isArray(details)).toBe(true)
				expect((details as string[]).length).toBeGreaterThan(0)
			}
		})
	})

	describe('accepts strong passwords', () => {
		it.each(['Forte#2026!', 'M@tcha2026!', 'P4ss!word-Ok', 'X#1aaaaaa'])(
			'accepts %s',
			(password) => {
				expect(() => assertStrongPassword(password)).not.toThrow()
			},
		)
	})
})
