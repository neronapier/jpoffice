import type { JPTheme } from './themes';

/**
 * High-contrast theme for accessibility.
 *
 * Uses maximum contrast (white on black) for users with visual impairments.
 * Selection is bright yellow for maximum visibility.
 * Page background stays WHITE because the canvas represents a real document.
 */
export const highContrastTheme: JPTheme = {
	colors: {
		background: '#000000',
		surface: '#1a1a1a',
		surfaceHover: '#333333',
		surfaceActive: '#555555',
		text: '#FFFFFF',
		textSecondary: '#CCCCCC',
		textDisabled: '#666666',
		primary: '#00FFFF',
		primaryHover: '#33FFFF',
		border: '#FFFFFF',
		borderLight: '#CCCCCC',
		divider: '#FFFFFF',
		toolbarBg: '#1a1a1a',
		menuBg: '#0a0a0a',
		menuHover: '#333333',
		dialogBg: '#0a0a0a',
		selection: '#FFFF00',
		selectionText: '#000000',
		cursor: '#FFFFFF',
		pageBg: '#ffffff',
		workspaceBg: '#000000',
		error: '#FF0000',
		warning: '#FFFF00',
		success: '#00FF00',
		scrollbarTrack: '#1a1a1a',
		scrollbarThumb: '#FFFFFF',
		tooltip: '#FFFFFF',
		tooltipText: '#000000',
		shadow: 'rgba(255, 255, 255, 0.3)',
	},
	fonts: {
		ui: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		mono: '"Roboto Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
	},
	spacing: {
		xs: 2,
		sm: 4,
		md: 8,
		lg: 16,
		xl: 24,
	},
	borderRadius: {
		sm: 4,
		md: 8,
		lg: 12,
	},
};
