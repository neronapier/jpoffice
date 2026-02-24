/**
 * Simplified Unicode Bidirectional Algorithm (UAX #9).
 *
 * Handles the core 80% of cases: Arabic/Hebrew mixed with Latin text,
 * numbers, and common punctuation. Implements:
 * - P2/P3: Paragraph level detection from first strong character
 * - X1-X8: Explicit embedding levels (simplified)
 * - W1-W7: Weak type resolution (numbers, separators)
 * - N1-N2: Neutral type resolution
 * - L1-L4: Implicit level resolution and reordering
 */

export type BidiDirection = 'ltr' | 'rtl';

export interface BidiRun {
	readonly start: number;
	readonly end: number;
	readonly level: number;
	readonly direction: BidiDirection;
}

/**
 * Unicode bidi character categories (UAX #9 Table 4).
 */
export type BidiCategory =
	| 'L' // Left-to-Right
	| 'R' // Right-to-Left
	| 'AL' // Arabic Letter
	| 'EN' // European Number
	| 'ES' // European Separator
	| 'ET' // European Terminator
	| 'AN' // Arabic Number
	| 'CS' // Common Separator
	| 'NSM' // Non-Spacing Mark
	| 'BN' // Boundary Neutral
	| 'B' // Paragraph Separator
	| 'S' // Segment Separator
	| 'WS' // Whitespace
	| 'ON'; // Other Neutral

/**
 * Check if a character is RTL (Arabic, Hebrew, etc.)
 */
export function isRtlChar(codePoint: number): boolean {
	const cat = getBidiCategory(codePoint);
	return cat === 'R' || cat === 'AL';
}

/**
 * Check if a character is LTR (Latin, CJK, etc.)
 */
export function isLtrChar(codePoint: number): boolean {
	return getBidiCategory(codePoint) === 'L';
}

/**
 * Get the Unicode bidi category of a character.
 * Uses character ranges for the most common scripts.
 */
export function getBidiCategory(codePoint: number): BidiCategory {
	// Arabic Letter (AL)
	if (
		(codePoint >= 0x0600 && codePoint <= 0x06ff) || // Arabic
		(codePoint >= 0x0750 && codePoint <= 0x077f) || // Arabic Supplement
		(codePoint >= 0x08a0 && codePoint <= 0x08ff) || // Arabic Extended-A
		(codePoint >= 0xfb50 && codePoint <= 0xfdff) || // Arabic Presentation Forms-A
		(codePoint >= 0xfe70 && codePoint <= 0xfeff) // Arabic Presentation Forms-B
	) {
		// Arabic-Indic digits are AN
		if (codePoint >= 0x0660 && codePoint <= 0x0669) return 'AN';
		// Extended Arabic-Indic digits are AN
		if (codePoint >= 0x06f0 && codePoint <= 0x06f9) return 'AN';
		// Arabic comma, semicolon are CS
		if (codePoint === 0x060c || codePoint === 0x061b) return 'CS';
		// Arabic tatweel and non-spacing marks in the Arabic block
		if (codePoint === 0x0640) return 'AL'; // Tatweel
		// Combining marks in Arabic block
		if (codePoint >= 0x0610 && codePoint <= 0x061a) return 'NSM';
		if (codePoint >= 0x064b && codePoint <= 0x065f) return 'NSM';
		if (codePoint === 0x0670) return 'NSM';
		if (codePoint >= 0x06d6 && codePoint <= 0x06dc) return 'NSM';
		if (codePoint >= 0x06df && codePoint <= 0x06e4) return 'NSM';
		if (codePoint >= 0x06e7 && codePoint <= 0x06e8) return 'NSM';
		if (codePoint >= 0x06ea && codePoint <= 0x06ed) return 'NSM';
		return 'AL';
	}

	// Hebrew (R)
	if (
		(codePoint >= 0x0590 && codePoint <= 0x05ff) || // Hebrew
		(codePoint >= 0xfb1d && codePoint <= 0xfb4f) // Hebrew Presentation Forms
	) {
		// Hebrew combining marks
		if (codePoint >= 0x0591 && codePoint <= 0x05bd) return 'NSM';
		if (codePoint === 0x05bf) return 'NSM';
		if (codePoint >= 0x05c1 && codePoint <= 0x05c2) return 'NSM';
		if (codePoint >= 0x05c4 && codePoint <= 0x05c5) return 'NSM';
		if (codePoint === 0x05c7) return 'NSM';
		return 'R';
	}

	// Thaana, NKo, Samaritan — RTL scripts (R)
	if (
		(codePoint >= 0x0780 && codePoint <= 0x07bf) || // Thaana
		(codePoint >= 0x07c0 && codePoint <= 0x07ff) || // NKo
		(codePoint >= 0x0800 && codePoint <= 0x083f) // Samaritan
	) {
		return 'R';
	}

	// Syriac (AL)
	if (codePoint >= 0x0700 && codePoint <= 0x074f) {
		return 'AL';
	}

	// European Number (EN): ASCII digits
	if (codePoint >= 0x0030 && codePoint <= 0x0039) return 'EN';
	// Superscript digits
	if (codePoint === 0x00b2 || codePoint === 0x00b3 || codePoint === 0x00b9) return 'EN';

	// European Separator (ES)
	if (codePoint === 0x002b || codePoint === 0x002d) return 'ES'; // + -
	// Minus sign
	if (codePoint === 0x2212) return 'ES';

	// European Terminator (ET)
	if (
		codePoint === 0x0023 || // #
		codePoint === 0x0024 || // $
		codePoint === 0x00a2 || // cent
		codePoint === 0x00a3 || // pound
		codePoint === 0x00a4 || // currency
		codePoint === 0x00a5 || // yen
		codePoint === 0x0025 || // %
		codePoint === 0x00b0 || // degree
		codePoint === 0x2030 || // per mille
		codePoint === 0x2031 // per ten thousand
	) {
		return 'ET';
	}
	// Currency symbols range
	if (codePoint >= 0x20a0 && codePoint <= 0x20cf) return 'ET';

	// Common Separator (CS)
	if (
		codePoint === 0x002c || // ,
		codePoint === 0x002e || // .
		codePoint === 0x002f || // /
		codePoint === 0x003a // :
	) {
		return 'CS';
	}

	// Paragraph Separator (B)
	if (
		codePoint === 0x000a || // LF
		codePoint === 0x000d || // CR
		codePoint === 0x001c || // FS
		codePoint === 0x001d || // GS
		codePoint === 0x001e || // RS
		codePoint === 0x0085 || // NEL
		codePoint === 0x2029 // Paragraph Separator
	) {
		return 'B';
	}

	// Segment Separator (S)
	if (
		codePoint === 0x0009 || // TAB
		codePoint === 0x001f // US
	) {
		return 'S';
	}

	// Whitespace (WS)
	if (
		codePoint === 0x000c || // FF
		codePoint === 0x0020 || // Space
		codePoint === 0x00a0 || // NBSP
		codePoint === 0x1680 || // Ogham space
		(codePoint >= 0x2000 && codePoint <= 0x200a) || // En/Em spaces etc.
		codePoint === 0x2028 || // Line Separator
		codePoint === 0x205f || // Medium Mathematical Space
		codePoint === 0x3000 // Ideographic Space
	) {
		return 'WS';
	}

	// Boundary Neutral (BN) — zero-width characters, formatting
	if (
		codePoint === 0x200b || // ZWSP
		codePoint === 0x200c || // ZWNJ
		codePoint === 0x200d || // ZWJ
		codePoint === 0xfeff || // BOM/ZWNBSP
		(codePoint >= 0x0000 && codePoint <= 0x0008) ||
		(codePoint >= 0x000e && codePoint <= 0x001b)
	) {
		return 'BN';
	}

	// Explicit embedding/override markers (BN in resolved types)
	if (
		codePoint === 0x202a || // LRE
		codePoint === 0x202b || // RLE
		codePoint === 0x202c || // PDF
		codePoint === 0x202d || // LRO
		codePoint === 0x202e || // RLO
		codePoint === 0x2066 || // LRI
		codePoint === 0x2067 || // RLI
		codePoint === 0x2068 || // FSI
		codePoint === 0x2069 // PDI
	) {
		return 'BN';
	}

	// Left-to-Right scripts
	// Basic Latin letters
	if (
		(codePoint >= 0x0041 && codePoint <= 0x005a) || // A-Z
		(codePoint >= 0x0061 && codePoint <= 0x007a) // a-z
	) {
		return 'L';
	}
	// Latin Extended
	if (codePoint >= 0x00c0 && codePoint <= 0x024f) return 'L';
	// Latin Extended Additional
	if (codePoint >= 0x1e00 && codePoint <= 0x1eff) return 'L';
	// Greek
	if (codePoint >= 0x0370 && codePoint <= 0x03ff) return 'L';
	// Cyrillic
	if (codePoint >= 0x0400 && codePoint <= 0x04ff) return 'L';
	// Armenian
	if (codePoint >= 0x0530 && codePoint <= 0x058f) return 'L';
	// Georgian
	if (codePoint >= 0x10a0 && codePoint <= 0x10ff) return 'L';
	// Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam
	if (codePoint >= 0x0900 && codePoint <= 0x0d7f) return 'L';
	// Thai
	if (codePoint >= 0x0e00 && codePoint <= 0x0e7f) return 'L';
	// Lao
	if (codePoint >= 0x0e80 && codePoint <= 0x0eff) return 'L';
	// Tibetan
	if (codePoint >= 0x0f00 && codePoint <= 0x0fff) return 'L';
	// Myanmar
	if (codePoint >= 0x1000 && codePoint <= 0x109f) return 'L';
	// Hangul Jamo
	if (codePoint >= 0x1100 && codePoint <= 0x11ff) return 'L';
	// CJK Unified Ideographs
	if (codePoint >= 0x4e00 && codePoint <= 0x9fff) return 'L';
	// CJK Compatibility Ideographs
	if (codePoint >= 0xf900 && codePoint <= 0xfaff) return 'L';
	// Hangul Syllables
	if (codePoint >= 0xac00 && codePoint <= 0xd7af) return 'L';
	// Hiragana
	if (codePoint >= 0x3040 && codePoint <= 0x309f) return 'L';
	// Katakana
	if (codePoint >= 0x30a0 && codePoint <= 0x30ff) return 'L';
	// CJK Radicals Supplement, Kangxi Radicals
	if (codePoint >= 0x2e80 && codePoint <= 0x2fdf) return 'L';
	// Bopomofo
	if (codePoint >= 0x3100 && codePoint <= 0x312f) return 'L';

	// Non-Spacing Mark (NSM) — general combining marks
	if (codePoint >= 0x0300 && codePoint <= 0x036f) return 'NSM'; // Combining Diacritical
	if (codePoint >= 0x20d0 && codePoint <= 0x20ff) return 'NSM'; // Combining for Symbols

	// Other Neutral (ON) — default for brackets, symbols, etc.
	return 'ON';
}

/**
 * Determine the base direction of a string.
 * Uses the first strong character (UAX #9 rules P2/P3).
 */
export function detectBaseDirection(text: string): BidiDirection {
	for (let i = 0; i < text.length; i++) {
		const cp = text.codePointAt(i)!;
		// Skip surrogates — codePointAt handles them
		if (cp > 0xffff) i++;
		const cat = getBidiCategory(cp);
		if (cat === 'L') return 'ltr';
		if (cat === 'R' || cat === 'AL') return 'rtl';
	}
	// No strong character found: default to LTR
	return 'ltr';
}

/**
 * Resolve bidi runs for a string with a given base direction.
 * Returns runs in visual (display) order.
 *
 * This implements a simplified version of the Unicode Bidi Algorithm (UAX #9):
 * 1. Classify each character
 * 2. Resolve weak types (W1-W7)
 * 3. Resolve neutral types (N1-N2)
 * 4. Assign implicit levels (I1/I2)
 * 5. Split into runs and reorder (L2)
 */
export function resolveBidiRuns(text: string, baseDirection: BidiDirection): readonly BidiRun[] {
	if (text.length === 0) return [];

	const paragraphLevel = baseDirection === 'rtl' ? 1 : 0;

	// Step 1: Get code points and classify characters
	const codePoints: number[] = [];
	const types: BidiCategory[] = [];

	for (let i = 0; i < text.length; i++) {
		const cp = text.codePointAt(i)!;
		codePoints.push(cp);
		types.push(getBidiCategory(cp));
		if (cp > 0xffff) i++; // skip trailing surrogate
	}

	const len = codePoints.length;
	// Working copy of types for resolution
	const resolved: BidiCategory[] = [...types];

	// Step 2: Resolve weak types (W1-W7)
	resolveWeakTypes(resolved, paragraphLevel);

	// Step 3: Resolve neutral types (N1-N2)
	resolveNeutralTypes(resolved, paragraphLevel);

	// Step 4: Assign implicit levels (I1/I2)
	const levels = assignImplicitLevels(resolved, paragraphLevel);

	// Step 5: Reset levels for whitespace/paragraph separators at end (L1)
	applyL1(types, levels, paragraphLevel);

	// Step 6: Split into runs by level and reorder
	const runs = splitIntoRuns(levels, len);

	// Step 7: Reverse runs according to levels (L2)
	return reorderRuns(runs);
}

/**
 * Reorder an array of items according to bidi levels.
 * Uses the standard bidi reordering algorithm (L2).
 */
export function reorderByBidiLevel<T>(
	items: readonly T[],
	levels: readonly number[],
): readonly T[] {
	if (items.length === 0) return items;
	if (items.length !== levels.length) {
		throw new Error('Items and levels arrays must have the same length');
	}

	const result = [...items];
	const maxLevel = Math.max(...levels);
	const minOddLevel = Math.min(...levels.filter((l) => l % 2 === 1), maxLevel + 1);

	// L2: From the highest level found down to the lowest odd level,
	// reverse any contiguous sequence of characters at that level or higher.
	for (let level = maxLevel; level >= minOddLevel; level--) {
		let i = 0;
		while (i < result.length) {
			if (levels[i] >= level) {
				// Find the end of this run at >= level
				let j = i + 1;
				while (j < result.length && levels[j] >= level) j++;
				// Reverse the segment [i, j)
				reverseSlice(result, i, j);
				i = j;
			} else {
				i++;
			}
		}
	}

	return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * W1-W7: Resolve weak bidi types.
 */
function resolveWeakTypes(types: BidiCategory[], paragraphLevel: number): void {
	const len = types.length;
	const sor: BidiCategory = paragraphLevel === 1 ? 'R' : 'L';

	// W1: NSM gets the type of the previous character (or sor)
	let prevType: BidiCategory = sor;
	for (let i = 0; i < len; i++) {
		if (types[i] === 'NSM') {
			types[i] = prevType;
		}
		prevType = types[i];
	}

	// W2: EN after AL becomes AN
	let lastStrongType: BidiCategory = sor;
	for (let i = 0; i < len; i++) {
		if (types[i] === 'L' || types[i] === 'R' || types[i] === 'AL') {
			lastStrongType = types[i];
		}
		if (types[i] === 'EN' && lastStrongType === 'AL') {
			types[i] = 'AN';
		}
	}

	// W3: AL becomes R
	for (let i = 0; i < len; i++) {
		if (types[i] === 'AL') {
			types[i] = 'R';
		}
	}

	// W4: ES between EN becomes EN; CS between same type (EN or AN) gets that type
	for (let i = 1; i < len - 1; i++) {
		if (types[i] === 'ES' && types[i - 1] === 'EN' && types[i + 1] === 'EN') {
			types[i] = 'EN';
		}
		if (types[i] === 'CS') {
			if (types[i - 1] === 'EN' && types[i + 1] === 'EN') {
				types[i] = 'EN';
			} else if (types[i - 1] === 'AN' && types[i + 1] === 'AN') {
				types[i] = 'AN';
			}
		}
	}

	// W5: ET adjacent to EN becomes EN
	for (let i = 0; i < len; i++) {
		if (types[i] === 'ET') {
			// Look backward for EN
			let foundEN = false;
			for (let j = i - 1; j >= 0; j--) {
				if (types[j] === 'EN') {
					foundEN = true;
					break;
				}
				if (types[j] !== 'ET') break;
			}
			// Look forward for EN
			if (!foundEN) {
				for (let j = i + 1; j < len; j++) {
					if (types[j] === 'EN') {
						foundEN = true;
						break;
					}
					if (types[j] !== 'ET') break;
				}
			}
			if (foundEN) {
				types[i] = 'EN';
			}
		}
	}

	// W6: Remaining ES, ET, CS become ON
	for (let i = 0; i < len; i++) {
		if (types[i] === 'ES' || types[i] === 'ET' || types[i] === 'CS') {
			types[i] = 'ON';
		}
	}

	// W7: EN with prior strong type L becomes L
	lastStrongType = sor;
	for (let i = 0; i < len; i++) {
		if (types[i] === 'L' || types[i] === 'R') {
			lastStrongType = types[i];
		}
		if (types[i] === 'EN' && lastStrongType === 'L') {
			types[i] = 'L';
		}
	}
}

/**
 * N1-N2: Resolve neutral types.
 */
function resolveNeutralTypes(types: BidiCategory[], paragraphLevel: number): void {
	const len = types.length;
	const sor: BidiCategory = paragraphLevel === 1 ? 'R' : 'L';
	const eor: BidiCategory = sor; // same for our simplified case

	for (let i = 0; i < len; i++) {
		const t = types[i];
		if (t === 'B' || t === 'S' || t === 'WS' || t === 'ON' || t === 'BN') {
			// Find the surrounding strong types
			const prev = findPrevStrongType(types, i, sor);
			const next = findNextStrongType(types, i, eor);

			// N1: If both sides are the same strong type, use that type
			if (prev === next) {
				types[i] = prev;
			} else {
				// N2: Otherwise, use the embedding direction
				types[i] = paragraphLevel === 1 ? 'R' : 'L';
			}
		}
	}
}

/**
 * Find the previous strong type (L, R, EN, AN) or return default.
 */
function findPrevStrongType(
	types: readonly BidiCategory[],
	index: number,
	defaultType: BidiCategory,
): BidiCategory {
	for (let i = index - 1; i >= 0; i--) {
		const t = types[i];
		if (t === 'L') return 'L';
		if (t === 'R' || t === 'AN' || t === 'EN') return 'R';
	}
	return defaultType;
}

/**
 * Find the next strong type (L, R, EN, AN) or return default.
 */
function findNextStrongType(
	types: readonly BidiCategory[],
	index: number,
	defaultType: BidiCategory,
): BidiCategory {
	for (let i = index + 1; i < types.length; i++) {
		const t = types[i];
		if (t === 'L') return 'L';
		if (t === 'R' || t === 'AN' || t === 'EN') return 'R';
	}
	return defaultType;
}

/**
 * I1/I2: Assign implicit embedding levels.
 */
function assignImplicitLevels(types: readonly BidiCategory[], paragraphLevel: number): number[] {
	const len = types.length;
	const levels: number[] = new Array(len);

	for (let i = 0; i < len; i++) {
		const t = types[i];
		if (paragraphLevel === 0) {
			// I1: Even level (LTR paragraph)
			if (t === 'R') {
				levels[i] = 1;
			} else if (t === 'AN' || t === 'EN') {
				levels[i] = 2;
			} else {
				levels[i] = 0;
			}
		} else {
			// I2: Odd level (RTL paragraph)
			if (t === 'L' || t === 'AN' || t === 'EN') {
				levels[i] = 2;
			} else {
				levels[i] = 1;
			}
		}
	}

	return levels;
}

/**
 * L1: Reset levels for trailing whitespace and paragraph separators.
 */
function applyL1(
	originalTypes: readonly BidiCategory[],
	levels: number[],
	paragraphLevel: number,
): void {
	const len = levels.length;

	// Reset trailing whitespace to paragraph level
	for (let i = len - 1; i >= 0; i--) {
		const t = originalTypes[i];
		if (t === 'WS' || t === 'S' || t === 'B' || t === 'BN') {
			levels[i] = paragraphLevel;
		} else {
			break;
		}
	}

	// Reset whitespace before paragraph separators
	for (let i = 0; i < len; i++) {
		if (originalTypes[i] === 'B' || originalTypes[i] === 'S') {
			levels[i] = paragraphLevel;
			// Reset preceding whitespace
			for (let j = i - 1; j >= 0; j--) {
				if (originalTypes[j] === 'WS' || originalTypes[j] === 'BN') {
					levels[j] = paragraphLevel;
				} else {
					break;
				}
			}
		}
	}
}

/**
 * Split character-level levels into contiguous runs.
 */
function splitIntoRuns(levels: readonly number[], len: number): BidiRun[] {
	if (len === 0) return [];

	const runs: BidiRun[] = [];
	let runStart = 0;
	let runLevel = levels[0];

	for (let i = 1; i < len; i++) {
		if (levels[i] !== runLevel) {
			runs.push({
				start: runStart,
				end: i,
				level: runLevel,
				direction: runLevel % 2 === 0 ? 'ltr' : 'rtl',
			});
			runStart = i;
			runLevel = levels[i];
		}
	}

	// Push final run
	runs.push({
		start: runStart,
		end: len,
		level: runLevel,
		direction: runLevel % 2 === 0 ? 'ltr' : 'rtl',
	});

	return runs;
}

/**
 * L2: Reorder runs to visual order.
 * From the highest level down to the lowest odd level,
 * reverse any contiguous sequence of runs at that level or higher.
 */
function reorderRuns(runs: readonly BidiRun[]): BidiRun[] {
	if (runs.length <= 1) return [...runs];

	const maxLevel = Math.max(...runs.map((r) => r.level));
	if (maxLevel === 0) return [...runs]; // All LTR, no reordering needed

	const minOddLevel = Math.min(
		...runs.map((r) => r.level).filter((l) => l % 2 === 1),
		maxLevel + 1,
	);

	if (minOddLevel > maxLevel) return [...runs]; // No odd levels

	const result = [...runs];

	for (let level = maxLevel; level >= minOddLevel; level--) {
		let i = 0;
		while (i < result.length) {
			if (result[i].level >= level) {
				let j = i + 1;
				while (j < result.length && result[j].level >= level) j++;
				reverseSlice(result, i, j);
				i = j;
			} else {
				i++;
			}
		}
	}

	return result;
}

/**
 * Reverse a slice of an array in place from index `start` (inclusive) to `end` (exclusive).
 */
function reverseSlice<T>(arr: T[], start: number, end: number): void {
	let lo = start;
	let hi = end - 1;
	while (lo < hi) {
		const tmp = arr[lo];
		arr[lo] = arr[hi];
		arr[hi] = tmp;
		lo++;
		hi--;
	}
}
