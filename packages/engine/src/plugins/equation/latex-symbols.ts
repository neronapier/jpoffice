/**
 * Common LaTeX symbols organized by category for use in equation editor UI.
 */

export interface LatexSymbol {
	/** Human-readable label (the rendered symbol character). */
	readonly label: string;
	/** LaTeX command to insert. */
	readonly latex: string;
	/** Symbol category for grouping. */
	readonly category: string;
}

export interface LatexSymbolGroup {
	/** Display name for the group. */
	readonly name: string;
	/** Symbols belonging to this group. */
	readonly symbols: readonly LatexSymbol[];
}

const GREEK_LOWERCASE: readonly LatexSymbol[] = [
	{ label: '\u03B1', latex: '\\alpha', category: 'greek' },
	{ label: '\u03B2', latex: '\\beta', category: 'greek' },
	{ label: '\u03B3', latex: '\\gamma', category: 'greek' },
	{ label: '\u03B4', latex: '\\delta', category: 'greek' },
	{ label: '\u03B5', latex: '\\epsilon', category: 'greek' },
	{ label: '\u03B6', latex: '\\zeta', category: 'greek' },
	{ label: '\u03B7', latex: '\\eta', category: 'greek' },
	{ label: '\u03B8', latex: '\\theta', category: 'greek' },
	{ label: '\u03B9', latex: '\\iota', category: 'greek' },
	{ label: '\u03BA', latex: '\\kappa', category: 'greek' },
	{ label: '\u03BB', latex: '\\lambda', category: 'greek' },
	{ label: '\u03BC', latex: '\\mu', category: 'greek' },
	{ label: '\u03BD', latex: '\\nu', category: 'greek' },
	{ label: '\u03BE', latex: '\\xi', category: 'greek' },
	{ label: '\u03C0', latex: '\\pi', category: 'greek' },
	{ label: '\u03C1', latex: '\\rho', category: 'greek' },
	{ label: '\u03C3', latex: '\\sigma', category: 'greek' },
	{ label: '\u03C4', latex: '\\tau', category: 'greek' },
	{ label: '\u03C6', latex: '\\phi', category: 'greek' },
	{ label: '\u03C7', latex: '\\chi', category: 'greek' },
	{ label: '\u03C8', latex: '\\psi', category: 'greek' },
	{ label: '\u03C9', latex: '\\omega', category: 'greek' },
];

const GREEK_UPPERCASE: readonly LatexSymbol[] = [
	{ label: '\u0393', latex: '\\Gamma', category: 'greek' },
	{ label: '\u0394', latex: '\\Delta', category: 'greek' },
	{ label: '\u0398', latex: '\\Theta', category: 'greek' },
	{ label: '\u039B', latex: '\\Lambda', category: 'greek' },
	{ label: '\u039E', latex: '\\Xi', category: 'greek' },
	{ label: '\u03A0', latex: '\\Pi', category: 'greek' },
	{ label: '\u03A3', latex: '\\Sigma', category: 'greek' },
	{ label: '\u03A6', latex: '\\Phi', category: 'greek' },
	{ label: '\u03A8', latex: '\\Psi', category: 'greek' },
	{ label: '\u03A9', latex: '\\Omega', category: 'greek' },
];

const OPERATORS: readonly LatexSymbol[] = [
	{ label: '\u00B1', latex: '\\pm', category: 'operator' },
	{ label: '\u2213', latex: '\\mp', category: 'operator' },
	{ label: '\u00D7', latex: '\\times', category: 'operator' },
	{ label: '\u00F7', latex: '\\div', category: 'operator' },
	{ label: '\u2260', latex: '\\neq', category: 'operator' },
	{ label: '\u2264', latex: '\\leq', category: 'operator' },
	{ label: '\u2265', latex: '\\geq', category: 'operator' },
	{ label: '\u2248', latex: '\\approx', category: 'operator' },
	{ label: '\u221D', latex: '\\propto', category: 'operator' },
	{ label: '\u221E', latex: '\\infty', category: 'operator' },
	{ label: '\u2218', latex: '\\circ', category: 'operator' },
	{ label: '\u22C5', latex: '\\cdot', category: 'operator' },
	{ label: '\u2217', latex: '\\ast', category: 'operator' },
	{ label: '\u2261', latex: '\\equiv', category: 'operator' },
	{ label: '\u2245', latex: '\\cong', category: 'operator' },
	{ label: '\u223C', latex: '\\sim', category: 'operator' },
];

const RELATIONS: readonly LatexSymbol[] = [
	{ label: '\u2208', latex: '\\in', category: 'relation' },
	{ label: '\u2209', latex: '\\notin', category: 'relation' },
	{ label: '\u2282', latex: '\\subset', category: 'relation' },
	{ label: '\u2283', latex: '\\supset', category: 'relation' },
	{ label: '\u2286', latex: '\\subseteq', category: 'relation' },
	{ label: '\u2287', latex: '\\supseteq', category: 'relation' },
	{ label: '\u222A', latex: '\\cup', category: 'relation' },
	{ label: '\u2229', latex: '\\cap', category: 'relation' },
	{ label: '\u2205', latex: '\\emptyset', category: 'relation' },
	{ label: '\u2200', latex: '\\forall', category: 'relation' },
	{ label: '\u2203', latex: '\\exists', category: 'relation' },
	{ label: '\u2204', latex: '\\nexists', category: 'relation' },
	{ label: '\u2227', latex: '\\land', category: 'relation' },
	{ label: '\u2228', latex: '\\lor', category: 'relation' },
	{ label: '\u00AC', latex: '\\neg', category: 'relation' },
];

const ARROWS: readonly LatexSymbol[] = [
	{ label: '\u2192', latex: '\\rightarrow', category: 'arrow' },
	{ label: '\u2190', latex: '\\leftarrow', category: 'arrow' },
	{ label: '\u2194', latex: '\\leftrightarrow', category: 'arrow' },
	{ label: '\u21D2', latex: '\\Rightarrow', category: 'arrow' },
	{ label: '\u21D0', latex: '\\Leftarrow', category: 'arrow' },
	{ label: '\u21D4', latex: '\\Leftrightarrow', category: 'arrow' },
	{ label: '\u2191', latex: '\\uparrow', category: 'arrow' },
	{ label: '\u2193', latex: '\\downarrow', category: 'arrow' },
	{ label: '\u21A6', latex: '\\mapsto', category: 'arrow' },
	{ label: '\u27F6', latex: '\\longrightarrow', category: 'arrow' },
	{ label: '\u27F9', latex: '\\Longrightarrow', category: 'arrow' },
];

const STRUCTURES: readonly LatexSymbol[] = [
	{ label: 'a/b', latex: '\\frac{}{}', category: 'structure' },
	{ label: '\u221A', latex: '\\sqrt{}', category: 'structure' },
	{ label: '\u221B', latex: '\\sqrt[3]{}', category: 'structure' },
	{ label: '\u221C', latex: '\\sqrt[4]{}', category: 'structure' },
	{ label: '\u2211', latex: '\\sum', category: 'structure' },
	{ label: '\u220F', latex: '\\prod', category: 'structure' },
	{ label: '\u222B', latex: '\\int', category: 'structure' },
	{ label: '\u222C', latex: '\\iint', category: 'structure' },
	{ label: '\u222D', latex: '\\iiint', category: 'structure' },
	{ label: '\u222E', latex: '\\oint', category: 'structure' },
	{ label: 'lim', latex: '\\lim', category: 'structure' },
	{ label: 'x\u207F', latex: '{}^{}', category: 'structure' },
	{ label: 'x\u2099', latex: '{}_{}', category: 'structure' },
	{ label: 'matrix', latex: '\\begin{matrix}  \\\\  \\end{matrix}', category: 'structure' },
	{ label: 'pmatrix', latex: '\\begin{pmatrix}  \\\\  \\end{pmatrix}', category: 'structure' },
	{ label: 'bmatrix', latex: '\\begin{bmatrix}  \\\\  \\end{bmatrix}', category: 'structure' },
	{ label: 'cases', latex: '\\begin{cases}  \\\\  \\end{cases}', category: 'structure' },
	{ label: '\u2202', latex: '\\partial', category: 'structure' },
	{ label: '\u2207', latex: '\\nabla', category: 'structure' },
	{ label: 'log', latex: '\\log', category: 'structure' },
	{ label: 'ln', latex: '\\ln', category: 'structure' },
	{ label: 'sin', latex: '\\sin', category: 'structure' },
	{ label: 'cos', latex: '\\cos', category: 'structure' },
	{ label: 'tan', latex: '\\tan', category: 'structure' },
];

/**
 * All symbol groups organized for display in a symbol picker UI.
 */
export const LATEX_SYMBOL_GROUPS: readonly LatexSymbolGroup[] = [
	{
		name: 'Greek Letters',
		symbols: [...GREEK_LOWERCASE, ...GREEK_UPPERCASE],
	},
	{
		name: 'Operators',
		symbols: OPERATORS,
	},
	{
		name: 'Relations',
		symbols: RELATIONS,
	},
	{
		name: 'Arrows',
		symbols: ARROWS,
	},
	{
		name: 'Structures',
		symbols: STRUCTURES,
	},
];
