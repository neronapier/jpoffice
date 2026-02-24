/**
 * Generates a ToUnicode CMap for CID fonts.
 * This CMap allows PDF readers to extract text from the PDF,
 * mapping glyph indices (CIDs) back to Unicode codepoints.
 */

/**
 * Generate a ToUnicode CMap string that maps CIDs to Unicode codepoints.
 *
 * @param glyphMapping - Map of unicode codepoint -> glyph index (CID).
 *   We invert this to produce CID -> unicode mappings.
 * @returns The CMap as a string, ready to be embedded as a PDF stream.
 */
export function generateToUnicodeCMap(glyphMapping: Map<number, number>): string {
	// Invert the mapping: CID (glyph index) -> unicode codepoint
	// Multiple codepoints may map to the same glyph; keep all mappings
	const cidToUnicode = new Map<number, number>();
	for (const [codePoint, cid] of glyphMapping) {
		// If multiple codepoints map to same CID, keep the first one
		if (!cidToUnicode.has(cid)) {
			cidToUnicode.set(cid, codePoint);
		}
	}

	// Sort CIDs for deterministic output
	const sortedCids = Array.from(cidToUnicode.keys()).sort((a, b) => a - b);

	if (sortedCids.length === 0) {
		return buildCMap([]);
	}

	// Split into bfchar entries (max 100 per block per CMap spec)
	const entries: Array<{ cid: number; unicode: number }> = [];
	for (const cid of sortedCids) {
		const unicode = cidToUnicode.get(cid)!;
		entries.push({ cid, unicode });
	}

	return buildCMap(entries);
}

/**
 * Build the CMap string from a list of CID->Unicode entries.
 */
function buildCMap(entries: ReadonlyArray<{ cid: number; unicode: number }>): string {
	const lines: string[] = [];

	lines.push('/CIDInit /ProcSet findresource begin');
	lines.push('12 dict begin');
	lines.push('begincmap');
	lines.push('/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def');
	lines.push('/CMapName /Adobe-Identity-UCS def');
	lines.push('/CMapType 2 def');
	lines.push('1 begincodespacerange');
	lines.push('<0000> <FFFF>');
	lines.push('endcodespacerange');

	// Write bfchar blocks (max 100 entries per block per CMap spec)
	const chunkSize = 100;
	for (let i = 0; i < entries.length; i += chunkSize) {
		const chunk = entries.slice(i, i + chunkSize);
		lines.push(`${chunk.length} beginbfchar`);
		for (const entry of chunk) {
			const cidHex = toHex16(entry.cid);
			const unicodeHex = encodeUnicodeHex(entry.unicode);
			lines.push(`<${cidHex}> <${unicodeHex}>`);
		}
		lines.push('endbfchar');
	}

	lines.push('endcmap');
	lines.push('CMapSpaceUsed');
	lines.push('end end');

	return lines.join('\n');
}

/**
 * Encode a number as a 4-digit uppercase hex string.
 */
function toHex16(n: number): string {
	return n.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Encode a Unicode codepoint as hex for a CMap bfchar entry.
 * BMP characters (U+0000..U+FFFF) use 4 hex digits.
 * Supplementary characters (U+10000+) use a UTF-16 surrogate pair (8 hex digits).
 */
function encodeUnicodeHex(codePoint: number): string {
	if (codePoint <= 0xffff) {
		return toHex16(codePoint);
	}

	// Supplementary plane: encode as UTF-16 surrogate pair
	const highSurrogate = Math.floor((codePoint - 0x10000) / 0x400) + 0xd800;
	const lowSurrogate = ((codePoint - 0x10000) % 0x400) + 0xdc00;
	return toHex16(highSurrogate) + toHex16(lowSurrogate);
}
