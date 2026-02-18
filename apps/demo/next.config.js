/** @type {import('next').NextConfig} */
const nextConfig = {
	transpilePackages: [
		'@jpoffice/model',
		'@jpoffice/engine',
		'@jpoffice/layout',
		'@jpoffice/renderer',
		'@jpoffice/react',
	],
};

module.exports = nextConfig;
