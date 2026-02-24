'use client';

import { useContext } from 'react';
import { ThemeContext } from './theme-provider';
import type { JPTheme } from './themes';

/**
 * Hook that returns the current JPTheme from the nearest ThemeProvider.
 *
 * @throws if used outside a ThemeProvider.
 */
export function useTheme(): JPTheme {
	const theme = useContext(ThemeContext);
	if (!theme) {
		throw new Error('[JPOffice] useTheme must be used within a <ThemeProvider>.');
	}
	return theme;
}
