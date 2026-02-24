/**
 * JPOffice Theme definitions.
 *
 * Provides a complete design-token system for light and dark modes.
 * The `pageBg` color intentionally stays WHITE in both themes because
 * the canvas represents a physical document page.
 */

export interface JPTheme {
	readonly colors: {
		readonly background: string;
		readonly surface: string;
		readonly surfaceHover: string;
		readonly surfaceActive: string;
		readonly text: string;
		readonly textSecondary: string;
		readonly textDisabled: string;
		readonly primary: string;
		readonly primaryHover: string;
		readonly border: string;
		readonly borderLight: string;
		readonly divider: string;
		readonly toolbarBg: string;
		readonly menuBg: string;
		readonly menuHover: string;
		readonly dialogBg: string;
		readonly selection: string;
		readonly selectionText: string;
		readonly cursor: string;
		readonly pageBg: string;
		readonly workspaceBg: string;
		readonly error: string;
		readonly warning: string;
		readonly success: string;
		readonly scrollbarTrack: string;
		readonly scrollbarThumb: string;
		readonly tooltip: string;
		readonly tooltipText: string;
		readonly shadow: string;
	};
	readonly fonts: {
		readonly ui: string;
		readonly mono: string;
	};
	readonly spacing: {
		readonly xs: number;
		readonly sm: number;
		readonly md: number;
		readonly lg: number;
		readonly xl: number;
	};
	readonly borderRadius: {
		readonly sm: number;
		readonly md: number;
		readonly lg: number;
	};
}

/**
 * Light theme -- mirrors the existing hardcoded colors used throughout
 * the JPOffice React components (whites, grays, blue primary #1a73e8).
 */
export const lightTheme: JPTheme = {
	colors: {
		background: '#ffffff',
		surface: '#f9fbfd',
		surfaceHover: '#f1f3f4',
		surfaceActive: '#e8eaed',
		text: '#202124',
		textSecondary: '#5f6368',
		textDisabled: '#b0b0b0',
		primary: '#1a73e8',
		primaryHover: '#1765cc',
		border: '#dadce0',
		borderLight: '#e8eaed',
		divider: '#e0e0e0',
		toolbarBg: '#edf2fa',
		menuBg: '#ffffff',
		menuHover: '#f1f3f4',
		dialogBg: '#ffffff',
		selection: '#a8c7fa',
		selectionText: '#202124',
		cursor: '#000000',
		pageBg: '#ffffff',
		workspaceBg: '#f9fbfd',
		error: '#d93025',
		warning: '#f9ab00',
		success: '#1e8e3e',
		scrollbarTrack: '#f1f1f1',
		scrollbarThumb: '#c1c1c1',
		tooltip: '#3c4043',
		tooltipText: '#ffffff',
		shadow: 'rgba(0, 0, 0, 0.15)',
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

/**
 * Dark theme -- dark workspace/toolbar/menu backgrounds with light text.
 * Page background stays WHITE because the canvas represents a real document.
 */
export const darkTheme: JPTheme = {
	colors: {
		background: '#1e1e1e',
		surface: '#2d2d2d',
		surfaceHover: '#3c3c3c',
		surfaceActive: '#4a4a4a',
		text: '#e0e0e0',
		textSecondary: '#a0a0a0',
		textDisabled: '#616161',
		primary: '#8ab4f8',
		primaryHover: '#aecbfa',
		border: '#444444',
		borderLight: '#3a3a3a',
		divider: '#444444',
		toolbarBg: '#2d2d2d',
		menuBg: '#252525',
		menuHover: '#3c3c3c',
		dialogBg: '#2d2d2d',
		selection: '#394457',
		selectionText: '#e0e0e0',
		cursor: '#ffffff',
		pageBg: '#ffffff',
		workspaceBg: '#1e1e1e',
		error: '#f28b82',
		warning: '#fdd663',
		success: '#81c995',
		scrollbarTrack: '#2d2d2d',
		scrollbarThumb: '#5a5a5a',
		tooltip: '#e0e0e0',
		tooltipText: '#1e1e1e',
		shadow: 'rgba(0, 0, 0, 0.4)',
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
