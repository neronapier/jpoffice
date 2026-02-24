/**
 * Maps document font families to PDF fonts.
 *
 * Supports two modes:
 * 1. Standard 14 fonts (no embedding, WinAnsiEncoding, Latin-only)
 * 2. CID embedded fonts (full Unicode via Identity-H encoding)
 *
 * When custom font buffers are provided, the registry creates CID font entries.
 * Otherwise it falls back to Standard 14 fonts.
 */

export interface PdfFontInfo {
	/** PDF base font name, e.g. 'Helvetica-Bold' or the PostScript name of embedded font. */
	readonly baseName: string;
	/** PDF resource name, e.g. '/F1'. */
	readonly pdfName: string;
	/** Encoding: 'WinAnsiEncoding' for Standard 14, 'Identity-H' for CID. */
	readonly encoding: string;
	/** Whether this is an embedded CID font (requires hex text encoding). */
	readonly isCidFont: boolean;
	/**
	 * For CID fonts: the font lookup key used to find the font buffer.
	 * This is the key into the custom fonts map (family + variant descriptor).
	 */
	readonly fontKey?: string;
}

interface FontVariants {
	normal: string;
	bold: string;
	italic: string;
	boldItalic: string;
}

const HELVETICA: FontVariants = {
	normal: 'Helvetica',
	bold: 'Helvetica-Bold',
	italic: 'Helvetica-Oblique',
	boldItalic: 'Helvetica-BoldOblique',
};

const TIMES: FontVariants = {
	normal: 'Times-Roman',
	bold: 'Times-Bold',
	italic: 'Times-Italic',
	boldItalic: 'Times-BoldItalic',
};

const COURIER: FontVariants = {
	normal: 'Courier',
	bold: 'Courier-Bold',
	italic: 'Courier-Oblique',
	boldItalic: 'Courier-BoldOblique',
};

function classifyFamily(family: string): FontVariants {
	const lower = family.toLowerCase();
	if (lower.includes('mono') || lower.includes('courier') || lower.includes('consola')) {
		return COURIER;
	}
	if (
		(lower.includes('serif') && !lower.includes('sans')) ||
		lower.includes('times') ||
		lower.includes('georgia') ||
		lower.includes('cambria') ||
		lower.includes('garamond')
	) {
		return TIMES;
	}
	// Default: sans-serif -> Helvetica
	return HELVETICA;
}

function getVariantKey(bold: boolean, italic: boolean): keyof FontVariants {
	if (bold && italic) return 'boldItalic';
	if (bold) return 'bold';
	if (italic) return 'italic';
	return 'normal';
}

/**
 * Build a font lookup key from family name and style.
 * This is the key used to look up custom font buffers.
 */
export function buildFontKey(family: string, bold: boolean, italic: boolean): string {
	const parts = [family.toLowerCase().trim()];
	if (bold) parts.push('bold');
	if (italic) parts.push('italic');
	return parts.join(':');
}

export class FontRegistry {
	private fonts = new Map<string, PdfFontInfo>();
	private nextId = 1;
	/** Set of font keys for which custom buffers are available. */
	private customFontKeys: Set<string>;

	/**
	 * @param customFontKeys - Set of font keys (from buildFontKey) that have custom font buffers.
	 *   When a font matches one of these keys, it will be registered as a CID font.
	 */
	constructor(customFontKeys?: Set<string>) {
		this.customFontKeys = customFontKeys ?? new Set();
	}

	/** Register and return font info for a family+bold+italic combination. */
	getFont(family: string, bold = false, italic = false): PdfFontInfo {
		const fontKey = buildFontKey(family, bold, italic);

		// Check if we have a custom font for this exact combination
		if (this.customFontKeys.has(fontKey)) {
			return this.getCidFont(fontKey, family, bold, italic);
		}

		// Fall back to Standard 14
		return this.getStandard14Font(family, bold, italic);
	}

	/** Get all registered fonts (for writing PDF font resources). */
	getAllFonts(): Map<string, PdfFontInfo> {
		return new Map(this.fonts);
	}

	/** Get only Standard 14 fonts (no embedding needed). */
	getStandard14Fonts(): PdfFontInfo[] {
		return Array.from(this.fonts.values()).filter((f) => !f.isCidFont);
	}

	/** Get only CID fonts (need embedding). */
	getCidFonts(): PdfFontInfo[] {
		return Array.from(this.fonts.values()).filter((f) => f.isCidFont);
	}

	private getStandard14Font(family: string, bold: boolean, italic: boolean): PdfFontInfo {
		const variants = classifyFamily(family);
		const variantKey = getVariantKey(bold, italic);
		const baseName = variants[variantKey];

		const existing = this.fonts.get(baseName);
		if (existing) return existing;

		const info: PdfFontInfo = {
			baseName,
			pdfName: `/F${this.nextId++}`,
			encoding: 'WinAnsiEncoding',
			isCidFont: false,
		};
		this.fonts.set(baseName, info);
		return info;
	}

	private getCidFont(fontKey: string, family: string, bold: boolean, italic: boolean): PdfFontInfo {
		// Use fontKey as the map key for CID fonts
		const mapKey = `cid:${fontKey}`;
		const existing = this.fonts.get(mapKey);
		if (existing) return existing;

		// Build a descriptive base name
		const baseName = buildCidBaseName(family, bold, italic);

		const info: PdfFontInfo = {
			baseName,
			pdfName: `/F${this.nextId++}`,
			encoding: 'Identity-H',
			isCidFont: true,
			fontKey,
		};
		this.fonts.set(mapKey, info);
		return info;
	}
}

/**
 * Build a PostScript-style base name for a CID font.
 */
function buildCidBaseName(family: string, bold: boolean, italic: boolean): string {
	// Clean family name to be a valid PostScript name
	let name = family.replace(/[^A-Za-z0-9]/g, '');
	if (bold && italic) {
		name += '-BoldItalic';
	} else if (bold) {
		name += '-Bold';
	} else if (italic) {
		name += '-Italic';
	}
	return name;
}
