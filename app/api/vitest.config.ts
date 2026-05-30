import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		// Convenção do projeto: testes co-localizados sob `tests/` em cada módulo,
		// com extensão `.spec.ts`. `.test.ts` na raiz também é aceito (legado).
		include: ['src/**/tests/*.spec.ts', 'src/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		setupFiles: ['src/config/test-setup.ts'],
		watch: false,
	},
})
