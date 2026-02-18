import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['cjs', 'esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	splitting: false,
	external: [
		'react',
		'react-dom',
		'@jpoffice/model',
		'@jpoffice/engine',
		'@jpoffice/layout',
		'@jpoffice/renderer',
	],
});
