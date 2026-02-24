'use client';

import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { highContrastTheme } from './high-contrast';
import { darkTheme, lightTheme } from './themes';
import type { JPTheme } from './themes';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'light' | 'dark' | 'high-contrast' | 'auto';

export interface ThemeProviderProps {
	/** The theme mode. 'auto' detects the system preference. Defaults to 'light'. */
	mode?: ThemeMode;
	/** Partial overrides merged on top of the resolved base theme. */
	customTheme?: Partial<JPTheme>;
	children: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export const ThemeContext = createContext<JPTheme | null>(null);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Deep-merge a partial JPTheme over a base JPTheme. */
function mergeTheme(base: JPTheme, partial: Partial<JPTheme>): JPTheme {
	return {
		colors: { ...base.colors, ...(partial.colors as Partial<JPTheme['colors']>) },
		fonts: { ...base.fonts, ...(partial.fonts as Partial<JPTheme['fonts']>) },
		spacing: { ...base.spacing, ...(partial.spacing as Partial<JPTheme['spacing']>) },
		borderRadius: {
			...base.borderRadius,
			...(partial.borderRadius as Partial<JPTheme['borderRadius']>),
		},
	};
}

/**
 * Detect system color scheme preference.
 * Returns 'dark' if the user prefers dark mode, 'light' otherwise.
 * Safe for SSR -- defaults to 'light' when `window` is not available.
 */
function detectSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ThemeProvider({ mode = 'light', customTheme, children }: ThemeProviderProps) {
	// Track the resolved mode for 'auto' (reacts to OS changes)
	const [systemMode, setSystemMode] = useState<'light' | 'dark'>(detectSystemTheme);

	useEffect(() => {
		if (mode !== 'auto') return;

		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
			setSystemMode(e.matches ? 'dark' : 'light');
		};

		// Sync on mount in case it changed between SSR and hydration
		setSystemMode(mql.matches ? 'dark' : 'light');

		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}, [mode]);

	const theme = useMemo<JPTheme>(() => {
		const resolvedMode = mode === 'auto' ? systemMode : mode;
		let base: JPTheme;
		if (resolvedMode === 'high-contrast') {
			base = highContrastTheme;
		} else if (resolvedMode === 'dark') {
			base = darkTheme;
		} else {
			base = lightTheme;
		}
		return customTheme ? mergeTheme(base, customTheme) : base;
	}, [mode, systemMode, customTheme]);

	return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
