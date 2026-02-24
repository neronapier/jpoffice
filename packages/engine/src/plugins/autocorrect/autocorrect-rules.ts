/**
 * AutoCorrect rule definition and default built-in rules.
 */

export interface AutoCorrectRule {
	readonly trigger: string;
	readonly replacement: string;
	readonly category: 'symbol' | 'smart-quote' | 'fraction' | 'arrow' | 'custom';
	readonly enabled: boolean;
}

/**
 * Default set of auto-correct rules that ship with the editor.
 * Sorted by trigger length descending so longer matches are tested first.
 */
export const DEFAULT_AUTOCORRECT_RULES: readonly AutoCorrectRule[] = [
	// Arrows (longest first)
	{ trigger: '<->', replacement: '\u2194', category: 'arrow', enabled: true },
	{ trigger: '->', replacement: '\u2192', category: 'arrow', enabled: true },
	{ trigger: '<-', replacement: '\u2190', category: 'arrow', enabled: true },
	{ trigger: '=>', replacement: '\u21D2', category: 'arrow', enabled: true },
	{ trigger: '<=', replacement: '\u21D0', category: 'arrow', enabled: true },

	// Symbols
	{ trigger: '(tm)', replacement: '\u2122', category: 'symbol', enabled: true },
	{ trigger: '(c)', replacement: '\u00A9', category: 'symbol', enabled: true },
	{ trigger: '(r)', replacement: '\u00AE', category: 'symbol', enabled: true },
	{ trigger: '...', replacement: '\u2026', category: 'symbol', enabled: true },
	{ trigger: '--', replacement: '\u2014', category: 'symbol', enabled: true },

	// Fractions
	{ trigger: '1/2', replacement: '\u00BD', category: 'fraction', enabled: true },
	{ trigger: '1/4', replacement: '\u00BC', category: 'fraction', enabled: true },
	{ trigger: '3/4', replacement: '\u00BE', category: 'fraction', enabled: true },
	{ trigger: '1/3', replacement: '\u2153', category: 'fraction', enabled: true },
	{ trigger: '2/3', replacement: '\u2154', category: 'fraction', enabled: true },
];
