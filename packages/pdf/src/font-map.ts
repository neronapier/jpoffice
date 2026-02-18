/**
 * Maps document font families to PDF Standard 14 fonts.
 * Standard 14 fonts don't require embedding — every PDF reader has them built in.
 */

export interface PdfFontInfo {
	/** PDF base font name, e.g. 'Helvetica-Bold' */
	readonly baseName: string;
	/** PDF resource name, e.g. '/F1' */
	readonly pdfName: string;
	/** Encoding */
	readonly encoding: string;
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
	// Default: sans-serif → Helvetica
	return HELVETICA;
}

function getVariantKey(bold: boolean, italic: boolean): keyof FontVariants {
	if (bold && italic) return 'boldItalic';
	if (bold) return 'bold';
	if (italic) return 'italic';
	return 'normal';
}

export class FontRegistry {
	private fonts = new Map<string, PdfFontInfo>();
	private nextId = 1;

	/** Register and return font info for a family+bold+italic combination. */
	getFont(family: string, bold = false, italic = false): PdfFontInfo {
		const variants = classifyFamily(family);
		const variantKey = getVariantKey(bold, italic);
		const baseName = variants[variantKey];

		const existing = this.fonts.get(baseName);
		if (existing) return existing;

		const info: PdfFontInfo = {
			baseName,
			pdfName: `/F${this.nextId++}`,
			encoding: 'WinAnsiEncoding',
		};
		this.fonts.set(baseName, info);
		return info;
	}

	/** Get all registered fonts (for writing PDF font resources). */
	getAllFonts(): Map<string, PdfFontInfo> {
		return new Map(this.fonts);
	}
}
