import { describe, expect, it } from 'vitest'
import { AppError } from '../../utils/app-error.js'
import { assertStrongPassword } from '../password-policy.js'

describe('passwordPolicy', () => {
	describe('rejeita senhas fracas', () => {
		it('lança WEAK_PASSWORD para senha curta (< 8 chars)', () => {
			expect(() => assertStrongPassword('Ab1!')).toThrow(AppError)
		})

		it('lança WEAK_PASSWORD para senha só com letras', () => {
			try {
				assertStrongPassword('apenasletras')
				expect.fail('deveria ter lançado')
			} catch (err) {
				expect(err).toBeInstanceOf(AppError)
				expect((err as AppError).code).toBe('WEAK_PASSWORD')
				expect((err as AppError).status).toBe(422)
			}
		})

		it('lança WEAK_PASSWORD quando falta número', () => {
			expect(() => assertStrongPassword('SemNumero!')).toThrow(AppError)
		})

		it('lança WEAK_PASSWORD quando falta símbolo', () => {
			expect(() => assertStrongPassword('SemSimbolo123')).toThrow(AppError)
		})

		it('lança WEAK_PASSWORD quando falta letra', () => {
			expect(() => assertStrongPassword('12345678!@')).toThrow(AppError)
		})

		it('expõe regras quebradas em `details`', () => {
			try {
				assertStrongPassword('abc')
				expect.fail('deveria ter lançado')
			} catch (err) {
				expect(err).toBeInstanceOf(AppError)
				const details = (err as AppError).details
				expect(Array.isArray(details)).toBe(true)
				expect((details as string[]).length).toBeGreaterThan(0)
			}
		})
	})

	describe('aceita senhas fortes', () => {
		it.each(['Forte#2026!', 'M@tcha2026!', 'P4ss!word-Ok', 'X#1aaaaaa'])(
			'aceita %s',
			(senha) => {
				expect(() => assertStrongPassword(senha)).not.toThrow()
			},
		)
	})
})
