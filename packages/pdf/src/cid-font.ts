/**
 * CID Font writer for PDF.
 * Creates the Type0 -> CIDFontType2 -> FontDescriptor -> FontFile2 object chain
 * required for embedding TrueType fonts with full Unicode support.
 *
 * PDF structure for an embedded CID font:
 *
 *   Type0 Font (top-level, referenced by page resources)
 *     ├── /Encoding /Identity-H
 *     ├── /DescendantFonts [CIDFont]
 *     └── /ToUnicode CMap stream
 *
 *   CIDFont (CIDFontType2 for TrueType)
 *     ├── /CIDSystemInfo
 *     ├── /FontDescriptor -> FontDescriptor
 *     ├── /W [widths array]
 *     └── /CIDToGIDMap /Identity
 *
 *   FontDescriptor
 *     ├── /FontFile2 -> stream (the actual font data)
 *     └── metrics (Ascent, Descent, CapHeight, etc.)
 */

import { deflateSync } from 'fflate';
import type { SubsetResult } from './font-subsetter';
import type { PdfWriter } from './pdf-writer';
import { generateToUnicodeCMap } from './to-unicode-cmap';

export interface CidFontResult {
	/** Object ID of the Type0 font (to be referenced in page /Resources). */
	readonly fontRef: number;
	/** The PDF font resource name, e.g. '/F1'. */
	readonly fontName: string;
}

/**
 * Write a complete CID font to the PDF writer.
 * Creates all necessary PDF objects: Type0 font, CIDFont, FontDescriptor,
 * FontFile2 stream, and ToUnicode CMap.
 *
 * @param writer - The PdfWriter to add objects to.
 * @param fontName - The PDF resource name (e.g. '/F1').
 * @param subset - The subset result from subsetFont().
 * @param fontBuffer - The raw font file bytes to embed.
 * @param baseFontName - The PostScript name for the font.
 * @returns CidFontResult with the font object reference.
 */
export function writeCidFont(
	writer: PdfWriter,
	fontName: string,
	subset: SubsetResult,
	fontBuffer: Uint8Array,
	baseFontName: string,
): CidFontResult {
	// 1. Write the font file stream (FontFile2 for TrueType)
	const compressedFont = deflateSync(fontBuffer);
	const fontStreamRef = writer.addStream(
		compressedFont,
		`/Subtype /TrueType /Filter /FlateDecode /Length1 ${fontBuffer.length} `,
	);

	// 2. Write the FontDescriptor
	const { metrics } = subset;
	const flags = computeFontFlags(baseFontName);
	const [bboxX1, bboxY1, bboxX2, bboxY2] = metrics.bbox;

	const psName = sanitizePdfName(baseFontName);
	const descriptorRef = writer.addObject(
		`<< /Type /FontDescriptor /FontName /${psName} /Flags ${flags} /FontBBox [${bboxX1} ${bboxY1} ${bboxX2} ${bboxY2}] /ItalicAngle ${metrics.italicAngle} /Ascent ${metrics.ascent} /Descent ${metrics.descent} /CapHeight ${metrics.capHeight} /StemV ${metrics.stemV} /FontFile2 ${fontStreamRef} 0 R >>`,
	);

	// 3. Build the /W (widths) array
	const widthsArray = buildWidthsArray(subset.widths);

	// 4. Write the CIDFont (CIDFontType2)
	const cidFontRef = writer.addObject(
		`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${psName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorRef} 0 R /W ${widthsArray} /CIDToGIDMap /Identity >>`,
	);

	// 5. Write the ToUnicode CMap
	const cmapStr = generateToUnicodeCMap(subset.glyphMapping);
	const cmapRef = writer.addStream(cmapStr);

	// 6. Write the Type0 font (top-level)
	const type0Ref = writer.addObject(
		`<< /Type /Font /Subtype /Type0 /BaseFont /${psName} /Encoding /Identity-H /DescendantFonts [${cidFontRef} 0 R] /ToUnicode ${cmapRef} 0 R >>`,
	);

	return {
		fontRef: type0Ref,
		fontName,
	};
}

/**
 * Build the PDF /W (widths) array for a CID font.
 * Uses the compact format: [cid [w1 w2 ...]] for consecutive CIDs.
 *
 * Example output: [0 [500] 32 [250 333 408] 72 [722]]
 */
function buildWidthsArray(widths: Map<number, number>): string {
	if (widths.size === 0) return '[]';

	// Sort CIDs
	const sortedCids = Array.from(widths.keys()).sort((a, b) => a - b);

	const parts: string[] = [];

	let i = 0;
	while (i < sortedCids.length) {
		const startCid = sortedCids[i];
		const consecutiveWidths: number[] = [widths.get(startCid)!];

		// Collect consecutive CIDs
		while (i + 1 < sortedCids.length && sortedCids[i + 1] === sortedCids[i] + 1) {
			i++;
			consecutiveWidths.push(widths.get(sortedCids[i])!);
		}

		parts.push(`${startCid} [${consecutiveWidths.join(' ')}]`);
		i++;
	}

	return `[${parts.join(' ')}]`;
}

/**
 * Compute PDF font flags from the PostScript name.
 * Bit 6 (Nonsymbolic) = 32 is always set for standard text fonts.
 * Bit 1 (FixedPitch) = 1 for monospace.
 * Bit 2 (Serif) = 2 for serif fonts.
 * Bit 7 (Italic) = 64 for italic.
 */
function computeFontFlags(psName: string): number {
	let flags = 32; // Nonsymbolic (required for Identity-H encoding)
	const lower = psName.toLowerCase();

	if (lower.includes('mono') || lower.includes('courier') || lower.includes('consola')) {
		flags |= 1; // FixedPitch
	}
	if (
		(lower.includes('serif') && !lower.includes('sans')) ||
		lower.includes('times') ||
		lower.includes('georgia') ||
		lower.includes('garamond')
	) {
		flags |= 2; // Serif
	}
	if (lower.includes('italic') || lower.includes('oblique')) {
		flags |= 64; // Italic
	}

	return flags;
}

/**
 * Sanitize a font name for use in a PDF name object.
 * Removes characters that are not allowed in PDF name tokens.
 */
function sanitizePdfName(name: string): string {
	// PDF name objects: remove spaces and special chars
	return name.replace(/[^A-Za-z0-9+\-_.]/g, '');
}
