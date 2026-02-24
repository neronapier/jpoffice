import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['**/*.test.*', '**/*.spec.*', 'dist/**'],
			reporter: ['text', 'lcov'],
		},
	},
});
