import { NS } from '../xml/namespaces';
import { getFirstChild } from '../xml/xml-parser';

/** Theme color scheme extracted from word/theme/theme1.xml */
export interface ThemeColors {
	readonly dk1: string;
	readonly dk2: string;
	readonly lt1: string;
	readonly lt2: string;
	readonly accent1: string;
	readonly accent2: string;
	readonly accent3: string;
	readonly accent4: string;
	readonly accent5: string;
	readonly accent6: string;
	readonly hlink: string;
	readonly folHlink: string;
}

const DEFAULT_THEME_COLORS: ThemeColors = {
	dk1: '000000',
	dk2: '44546A',
	lt1: 'FFFFFF',
	lt2: 'E7E6E6',
	accent1: '4472C4',
	accent2: 'ED7D31',
	accent3: 'A5A5A5',
	accent4: 'FFC000',
	accent5: '5B9BD5',
	accent6: '70AD47',
	hlink: '0563C1',
	folHlink: '954F72',
};

/**
 * Parse word/theme/theme1.xml and extract the color scheme.
 */
export function parseTheme(doc: Document): ThemeColors {
	const root = doc.documentElement;
	if (!root) return DEFAULT_THEME_COLORS;

	// Navigate: a:theme > a:themeElements > a:clrScheme
	const themeElements = getFirstChild(root, NS.a, 'themeElements');
	if (!themeElements) return DEFAULT_THEME_COLORS;

	const clrScheme = getFirstChild(themeElements, NS.a, 'clrScheme');
	if (!clrScheme) return DEFAULT_THEME_COLORS;

	const colors: Record<string, string> = { ...DEFAULT_THEME_COLORS };

	for (const key of Object.keys(DEFAULT_THEME_COLORS)) {
		const el = getFirstChild(clrScheme, NS.a, key);
		if (!el) continue;

		// Color can be specified as a:sysClr or a:srgbClr
		const srgb = getFirstChild(el, NS.a, 'srgbClr');
		if (srgb) {
			const val = srgb.getAttribute('val');
			if (val) colors[key] = val;
			continue;
		}

		const sys = getFirstChild(el, NS.a, 'sysClr');
		if (sys) {
			// lastClr is the actual color used
			const lastClr = sys.getAttribute('lastClr');
			if (lastClr) colors[key] = lastClr;
		}
	}

	return colors as unknown as ThemeColors;
}

/**
 * Resolve a theme color reference to an RGB hex string.
 */
export function resolveThemeColor(
	themeColor: string,
	themeColors: ThemeColors,
): string | undefined {
	const mapping: Record<string, keyof ThemeColors> = {
		dark1: 'dk1',
		dark2: 'dk2',
		light1: 'lt1',
		light2: 'lt2',
		accent1: 'accent1',
		accent2: 'accent2',
		accent3: 'accent3',
		accent4: 'accent4',
		accent5: 'accent5',
		accent6: 'accent6',
		hyperlink: 'hlink',
		followedHyperlink: 'folHlink',
	};

	const key = mapping[themeColor];
	return key ? themeColors[key] : undefined;
}
