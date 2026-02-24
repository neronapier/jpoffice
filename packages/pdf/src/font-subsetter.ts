/**
 * Font subsetting using fontkit.
 * Opens a font buffer, extracts glyph metrics for used characters,
 * and builds a mapping from Unicode codepoints to CIDs (glyph indices).
 *
 * The full font buffer is passed through as the "subset" since implementing
 * proper TrueType table subsetting is very complex. PDF readers handle
 * full fonts without issue — subsetting is an optimization, not a requirement.
 */

import * as fontkit from 'fontkit';

export interface SubsetResult {
	/** The font buffer to embed (full font, or subsetted in future). */
	readonly subsetBuffer: Uint8Array;
	/** Maps unicode codepoint -> glyph index (CID) in the font. */
	readonly glyphMapping: Map<number, number>;
	/** Maps CID (glyph index) -> advance width in PDF units (1/1000 of font size). */
	readonly widths: Map<number, number>;
	/** Font-level metrics in PDF units. */
	readonly metrics: PdfFontMetrics;
}

export interface PdfFontMetrics {
	/** Ascent in PDF units (positive, above baseline). */
	readonly ascent: number;
	/** Descent in PDF units (negative, below baseline). */
	readonly descent: number;
	/** Cap height in PDF units. */
	readonly capHeight: number;
	/** Font bounding box [llx, lly, urx, ury] in PDF units. */
	readonly bbox: [number, number, number, number];
	/** Italic angle in degrees (0 for upright fonts). */
	readonly italicAngle: number;
	/** Stem vertical width estimate in PDF units. */
	readonly stemV: number;
	/** Units per em of the original font (before PDF scaling). */
	readonly unitsPerEm: number;
}

/**
 * Subset a font for the given set of used Unicode codepoints.
 * Returns the font buffer, glyph mapping, per-glyph widths, and font metrics.
 *
 * @param fontBuffer - The raw font file bytes (TTF/OTF/WOFF).
 * @param usedChars - Set of Unicode codepoints actually used in the document.
 * @returns SubsetResult with all data needed for CID font embedding.
 */
export function subsetFont(fontBuffer: Uint8Array, usedChars: Set<number>): SubsetResult {
	const result = fontkit.create(Buffer.from(fontBuffer));
	// fontkit.create() may return a FontCollection for .ttc files — use the first font
	const font = 'fonts' in result ? result.fonts[0] : result;

	const unitsPerEm = font.unitsPerEm;
	const scale = 1000 / unitsPerEm;

	// Build glyph mapping and widths
	const glyphMapping = new Map<number, number>();
	const widths = new Map<number, number>();

	// Always include .notdef (glyph 0) — required by PDF spec
	widths.set(0, Math.round((font.getGlyph(0)?.advanceWidth ?? 0) * scale));

	for (const codePoint of usedChars) {
		const glyph = font.glyphForCodePoint(codePoint);
		if (!glyph || glyph.id === 0) continue;

		glyphMapping.set(codePoint, glyph.id);
		if (!widths.has(glyph.id)) {
			widths.set(glyph.id, Math.round(glyph.advanceWidth * scale));
		}
	}

	// Extract font-level metrics
	const bbox = font.bbox;
	const metrics: PdfFontMetrics = {
		ascent: Math.round(font.ascent * scale),
		descent: Math.round(font.descent * scale),
		capHeight: Math.round((font.capHeight ?? font.ascent * 0.7) * scale),
		bbox: [
			Math.round(bbox.minX * scale),
			Math.round(bbox.minY * scale),
			Math.round(bbox.maxX * scale),
			Math.round(bbox.maxY * scale),
		],
		italicAngle: font.italicAngle ?? 0,
		stemV: estimateStemV(font.postscriptName ?? '', scale),
		unitsPerEm,
	};

	return {
		subsetBuffer: fontBuffer,
		glyphMapping,
		widths,
		metrics,
	};
}

/**
 * Estimate StemV from font name heuristic.
 * A more accurate approach would measure actual stem widths, but this
 * approximation is sufficient for PDF font descriptors.
 */
function estimateStemV(postscriptName: string, _scale: number): number {
	const lower = postscriptName.toLowerCase();
	if (lower.includes('bold') && lower.includes('black')) return 200;
	if (lower.includes('black') || lower.includes('heavy')) return 180;
	if (lower.includes('extrabold') || lower.includes('ultrabold')) return 160;
	if (lower.includes('bold') || lower.includes('demi')) return 120;
	if (lower.includes('medium')) return 100;
	if (lower.includes('light') || lower.includes('thin')) return 50;
	return 80; // Regular weight default
}
