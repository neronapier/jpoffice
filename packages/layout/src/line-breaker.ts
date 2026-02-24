import type { JPPath } from '@jpoffice/model';
import type { BidiDirection } from './bidi';
import { resolveBidiRuns } from './bidi';
import type { PositionedFloat } from './float-layout';
import { getLineExclusions, isBlockedByFloat } from './float-layout';
import { fragmentsToKPItems, knuthPlassBreak } from './knuth-plass';
import type { TextMeasurer } from './text-measurer';
import type { LayoutFragment, LayoutLine, LayoutRect, ResolvedRunStyle } from './types';

/**
 * Input for line breaking: a sequence of inline items to lay out.
 */
export interface InlineImage {
	readonly src: string;
	readonly width: number; // px
	readonly height: number; // px
	readonly nodeId: string;
}

export interface InlineItem {
	readonly text: string;
	readonly style: ResolvedRunStyle;
	readonly runPath: JPPath;
	readonly runOffset: number; // start offset in the run's text
	readonly inlineImage?: InlineImage; // for inline images
	readonly href?: string; // hyperlink URL if inside a hyperlink node
}

/** Line breaking strategy: 'greedy' (fast) or 'optimal' (Knuth-Plass, better for justified text). */
export type LineBreakingStrategy = 'greedy' | 'optimal';

/**
 * Break a sequence of inline items into lines.
 *
 * When `lineBreaking` is 'optimal' and `alignment` is 'justify', the
 * Knuth-Plass algorithm is used for globally optimal line breaks.
 * Falls back to greedy if no feasible solution is found or if floats
 * are present (since varying line widths complicate optimal breaking).
 *
 * Returns laid-out lines with positioned fragments.
 */
export function breakIntoLines(
	items: readonly InlineItem[],
	measurer: TextMeasurer,
	availableWidth: number,
	firstLineIndent: number,
	alignment: 'left' | 'center' | 'right' | 'justify',
	lineSpacing: number,
	paragraphPath: JPPath,
	startY: number,
	positionedFloats?: readonly PositionedFloat[],
	contentLeft?: number,
	contentRight?: number,
	direction?: BidiDirection,
	lineBreaking?: LineBreakingStrategy,
): readonly LayoutLine[] {
	if (items.length === 0) {
		// Empty paragraph: still creates one empty line
		const metrics = measurer.getFontMetrics({
			fontFamily: 'Calibri',
			fontSize: 14.67,
			bold: false,
			italic: false,
			underline: false,
			strikethrough: false,
			doubleStrikethrough: false,
			superscript: false,
			subscript: false,
			color: '#000000',
			backgroundColor: null,
			highlight: null,
			allCaps: false,
			smallCaps: false,
			letterSpacing: 0,
		});
		const lineHeight = metrics.lineHeight * lineSpacing;
		return [
			{
				rect: { x: 0, y: startY, width: availableWidth, height: lineHeight },
				baseline: metrics.ascent,
				fragments: [],
				paragraphPath,
				lineIndex: 0,
			},
		];
	}

	// Expand all items into words with measurements
	const words = expandToWords(items, measurer);

	const hasFloats = positionedFloats && positionedFloats.length > 0;

	// Try optimal (Knuth-Plass) line breaking for justified text without floats
	if (
		lineBreaking === 'optimal' &&
		alignment === 'justify' &&
		!hasFloats &&
		words.length > 0 &&
		!words.some((w) => w.isNewline)
	) {
		const optimalLines = tryOptimalBreak(
			words,
			measurer,
			availableWidth,
			firstLineIndent,
			alignment,
			lineSpacing,
			paragraphPath,
			startY,
			direction,
		);
		if (optimalLines) {
			return optimalLines;
		}
		// Fall through to greedy if optimal failed
	}

	// Greedy line breaking (default path)
	return breakIntoLinesGreedy(
		words,
		measurer,
		availableWidth,
		firstLineIndent,
		alignment,
		lineSpacing,
		paragraphPath,
		startY,
		positionedFloats,
		contentLeft,
		contentRight,
		direction,
	);
}

/**
 * Greedy line breaking implementation (original algorithm).
 */
function breakIntoLinesGreedy(
	words: readonly MeasuredWord[],
	measurer: TextMeasurer,
	availableWidth: number,
	firstLineIndent: number,
	alignment: 'left' | 'center' | 'right' | 'justify',
	lineSpacing: number,
	paragraphPath: JPPath,
	startY: number,
	positionedFloats?: readonly PositionedFloat[],
	contentLeft?: number,
	contentRight?: number,
	direction?: BidiDirection,
): readonly LayoutLine[] {
	const lines: LayoutLine[] = [];
	let wordIdx = 0;
	let lineY = startY;

	const hasFloats = positionedFloats && positionedFloats.length > 0;
	const cLeft = contentLeft ?? 0;
	const cRight = contentRight ?? availableWidth;

	while (wordIdx < words.length) {
		const isFirstLine = lines.length === 0;
		const lineIndent = isFirstLine ? firstLineIndent : 0;

		// Estimate line height for float exclusion check
		const estimatedMetrics = measurer.getFontMetrics(words[wordIdx].style);
		const estimatedLineHeight = (estimatedMetrics.ascent + estimatedMetrics.descent) * lineSpacing;

		// Check if this Y range is completely blocked by a topAndBottom float
		if (hasFloats) {
			const blockCheck = isBlockedByFloat(positionedFloats, lineY, estimatedLineHeight);
			if (blockCheck.blocked) {
				lineY = blockCheck.nextY;
				continue;
			}
		}

		// Compute effective line width considering float exclusions
		let effectiveLineWidth = availableWidth - lineIndent;
		let effectiveLineX = lineIndent;

		if (hasFloats) {
			const exclusion = getLineExclusions(
				positionedFloats,
				lineY,
				estimatedLineHeight,
				cLeft,
				cRight,
			);
			const excludedWidth = exclusion.left - cLeft + (cRight - exclusion.right);
			effectiveLineWidth = availableWidth - lineIndent - excludedWidth;
			if (exclusion.left > cLeft) {
				effectiveLineX = lineIndent + (exclusion.left - cLeft);
			}
		}

		if (effectiveLineWidth <= 0) {
			// No space on this line, skip down
			lineY += estimatedLineHeight;
			continue;
		}

		const { fragments, nextWordIdx, maxAscent, maxDescent } = fillLine(
			words,
			wordIdx,
			effectiveLineWidth,
			measurer,
		);

		const lineHeight = (maxAscent + maxDescent) * lineSpacing;

		// Apply BiDi reordering when direction is RTL or auto-detected as RTL
		const reorderedFragments = applyBidiReorder(fragments, direction);

		// Position fragments horizontally based on alignment
		const totalFragWidth = reorderedFragments.reduce((s, f) => s + f.width, 0);
		const positionedFragments = positionFragments(
			reorderedFragments,
			effectiveLineX,
			lineY,
			maxAscent,
			totalFragWidth,
			effectiveLineWidth,
			alignment,
			nextWordIdx >= words.length, // isLastLine
			direction,
		);

		lines.push({
			rect: { x: effectiveLineX, y: lineY, width: effectiveLineWidth, height: lineHeight },
			baseline: maxAscent,
			fragments: positionedFragments,
			paragraphPath,
			lineIndex: lines.length,
		});

		lineY += lineHeight;
		wordIdx = nextWordIdx;
	}

	return lines;
}

/**
 * Try optimal line breaking using the Knuth-Plass algorithm.
 * Returns null if no feasible solution is found.
 */
function tryOptimalBreak(
	words: readonly MeasuredWord[],
	measurer: TextMeasurer,
	availableWidth: number,
	firstLineIndent: number,
	alignment: 'left' | 'center' | 'right' | 'justify',
	lineSpacing: number,
	paragraphPath: JPPath,
	startY: number,
	direction?: BidiDirection,
): readonly LayoutLine[] | null {
	// Filter out pure newline words (handled by greedy path)
	// Build KP items from measured words
	const spaceWidth = measurer.measureWord(' ', words[0].style);
	const kpFragments: { width: number; isSpace: boolean; content: unknown }[] = [];

	for (let i = 0; i < words.length; i++) {
		kpFragments.push({
			width: words[i].width,
			isSpace: words[i].isSpace,
			content: i, // store word index as content reference
		});
	}

	const kpItems = fragmentsToKPItems(kpFragments, spaceWidth);

	// Compute line widths: first line may be shorter due to indent
	const firstLineWidth = availableWidth - firstLineIndent;
	const lineWidths = firstLineIndent !== 0 ? [firstLineWidth, availableWidth] : availableWidth;

	const result = knuthPlassBreak(kpItems, {
		lineWidths,
		tolerance: 2, // slightly relaxed tolerance for practical use
		fitness: true,
	});

	if (!result || result.breakpoints.length === 0) {
		return null;
	}

	// Convert KP breakpoints back to lines of words.
	// Each breakpoint.index refers to the index in the kpItems array.
	// We need to map back to word indices.
	const lines: LayoutLine[] = [];
	let lineY = startY;

	// Collect word index ranges for each line
	const lineWordRanges: { start: number; end: number }[] = [];
	let currentWordStart = 0;

	for (const bp of result.breakpoints) {
		// Find the last word index included before this breakpoint.
		// The breakpoint index is in the kpItems array. We need to find
		// which words fall before this breakpoint.
		let lastWordIdx = currentWordStart;

		// Walk through kpItems from our current position to the breakpoint
		// and identify word boundaries
		for (let ki = 0; ki <= bp.index && ki < kpItems.length; ki++) {
			const item = kpItems[ki];
			if (item.type === 'box') {
				const wordIndex = item.content as number;
				if (wordIndex >= currentWordStart) {
					lastWordIdx = wordIndex;
				}
			}
		}

		lineWordRanges.push({ start: currentWordStart, end: lastWordIdx + 1 });

		// Skip spaces after the break to find the start of the next line
		let nextStart = lastWordIdx + 1;
		while (nextStart < words.length && words[nextStart].isSpace) {
			nextStart++;
		}
		currentWordStart = nextStart;
	}

	// Build layout lines from word ranges
	for (let li = 0; li < lineWordRanges.length; li++) {
		const range = lineWordRanges[li];
		const isFirstLine = li === 0;
		const isLastLine = li === lineWordRanges.length - 1;
		const lineIndent = isFirstLine ? firstLineIndent : 0;
		const effectiveWidth = availableWidth - lineIndent;

		// Build fragments for this line using the same merging logic as greedy
		const { fragments, maxAscent, maxDescent } = buildFragmentsFromWordRange(
			words,
			range.start,
			range.end,
			measurer,
		);

		const lineHeight = (maxAscent + maxDescent) * lineSpacing;

		// Apply BiDi reordering
		const reorderedFragments = applyBidiReorder(fragments, direction);

		// Position fragments
		const totalFragWidth = reorderedFragments.reduce((s, f) => s + f.width, 0);
		const positionedFragments = positionFragments(
			reorderedFragments,
			lineIndent,
			lineY,
			maxAscent,
			totalFragWidth,
			effectiveWidth,
			alignment,
			isLastLine,
			direction,
		);

		lines.push({
			rect: { x: lineIndent, y: lineY, width: effectiveWidth, height: lineHeight },
			baseline: maxAscent,
			fragments: positionedFragments,
			paragraphPath,
			lineIndex: li,
		});

		lineY += lineHeight;
	}

	return lines.length > 0 ? lines : null;
}

/**
 * Build fragments from a range of words, merging consecutive words from the
 * same run (same logic as the greedy fillLine accumulator).
 */
function buildFragmentsFromWordRange(
	words: readonly MeasuredWord[],
	startIdx: number,
	endIdx: number,
	measurer: TextMeasurer,
): {
	fragments: PendingFragment[];
	maxAscent: number;
	maxDescent: number;
} {
	const fragments: PendingFragment[] = [];
	let maxAscent = 0;
	let maxDescent = 0;

	let accumText = '';
	let accumWidth = 0;
	let accumRunPath: JPPath | null = null;
	let accumRunOffset = 0;
	let accumStyle: ResolvedRunStyle | null = null;
	let accumCharCount = 0;
	let accumHref: string | undefined;

	function flushAccum(): void {
		if (accumText && accumStyle && accumRunPath) {
			fragments.push({
				text: accumText,
				width: accumWidth,
				style: accumStyle,
				runPath: accumRunPath,
				runOffset: accumRunOffset,
				charCount: accumCharCount,
				href: accumHref,
			});
		}
		accumText = '';
		accumWidth = 0;
		accumRunPath = null;
		accumRunOffset = 0;
		accumStyle = null;
		accumCharCount = 0;
		accumHref = undefined;
	}

	// Strip trailing spaces from the line
	let actualEnd = endIdx;
	while (actualEnd > startIdx && words[actualEnd - 1].isSpace) {
		actualEnd--;
	}

	for (let idx = startIdx; idx < actualEnd; idx++) {
		const word = words[idx];

		const m = measurer.getFontMetrics(word.style);
		maxAscent = Math.max(maxAscent, m.ascent);
		maxDescent = Math.max(maxDescent, m.descent);

		const sameRun =
			accumRunPath &&
			accumRunPath.length === word.runPath.length &&
			accumRunPath.every((v, i) => v === word.runPath[i]) &&
			accumStyle === word.style &&
			accumHref === word.href;

		if (sameRun) {
			accumText += word.text;
			accumWidth += word.width;
			accumCharCount += word.charCount;
		} else {
			flushAccum();
			accumText = word.text;
			accumWidth = word.width;
			accumRunPath = word.runPath;
			accumRunOffset = word.runOffset;
			accumStyle = word.style;
			accumCharCount = word.charCount;
			accumHref = word.href;
		}
	}

	flushAccum();

	if (maxAscent === 0) {
		maxAscent = 11;
		maxDescent = 3;
	}

	return { fragments, maxAscent, maxDescent };
}

// -- Hyphenation --

/**
 * Find valid hyphenation points in a word.
 * Returns an array of indices where the word can be split.
 * Each index represents the position after which a hyphen can be inserted.
 *
 * Uses simple English pattern matching:
 * - After common prefixes: un-, re-, pre-, dis-, mis-, over-, under-, out-
 * - Before common suffixes: -tion, -sion, -ment, -ness, -able, -ible, -ing, -ous, -ful, -less, -ive, -ize, -ise
 * - Between double consonants (e.g., "run-ning", "let-ter")
 *
 * Minimum fragment length: 2 characters on each side.
 */
export function findHyphenationPoints(word: string): number[] {
	if (word.length < 4) return [];

	const lower = word.toLowerCase();
	const points = new Set<number>();
	const MIN_FRAGMENT = 2;

	// Common prefixes: break after prefix
	const prefixes = ['under', 'over', 'dis', 'mis', 'pre', 'un', 're'];
	for (const prefix of prefixes) {
		if (lower.startsWith(prefix) && lower.length > prefix.length + MIN_FRAGMENT) {
			points.add(prefix.length);
		}
	}

	// Common suffixes: break before suffix
	const suffixes = [
		'tion', 'sion', 'ment', 'ness', 'able', 'ible',
		'ing', 'ous', 'ful', 'less', 'ive', 'ize', 'ise',
	];
	for (const suffix of suffixes) {
		if (lower.endsWith(suffix) && lower.length > suffix.length + MIN_FRAGMENT) {
			const breakPoint = lower.length - suffix.length;
			points.add(breakPoint);
		}
	}

	// Between double consonants (e.g., "let-ter" -> break after first t)
	const consonants = 'bcdfghjklmnpqrstvwxyz';
	for (let i = 1; i < lower.length - 2; i++) {
		if (
			consonants.includes(lower[i]) &&
			lower[i] === lower[i + 1] &&
			i >= MIN_FRAGMENT &&
			lower.length - (i + 1) >= MIN_FRAGMENT
		) {
			points.add(i + 1);
		}
	}

	// Filter out points that would leave fragments shorter than MIN_FRAGMENT
	const validPoints = Array.from(points)
		.filter((p) => p >= MIN_FRAGMENT && word.length - p >= MIN_FRAGMENT)
		.sort((a, b) => a - b);

	return validPoints;
}

// -- Internal types --

interface MeasuredWord {
	readonly text: string;
	readonly width: number;
	readonly style: ResolvedRunStyle;
	readonly runPath: JPPath;
	readonly runOffset: number;
	readonly charCount: number;
	readonly isSpace: boolean;
	readonly isNewline: boolean;
	readonly href?: string;
}

interface PendingFragment {
	readonly text: string;
	readonly width: number;
	readonly style: ResolvedRunStyle;
	readonly runPath: JPPath;
	readonly runOffset: number;
	readonly charCount: number;
	readonly href?: string;
}

/**
 * Expand inline items into measured words for line breaking.
 */
function expandToWords(items: readonly InlineItem[], measurer: TextMeasurer): MeasuredWord[] {
	const words: MeasuredWord[] = [];

	for (const item of items) {
		const offset = item.runOffset;
		const text = item.style.allCaps ? item.text.toUpperCase() : item.text;

		// Split on word boundaries (space-delimited)
		let i = 0;
		while (i < text.length) {
			if (text[i] === '\n') {
				words.push({
					text: '\n',
					width: 0,
					style: item.style,
					runPath: item.runPath,
					runOffset: offset + i,
					charCount: 1,
					isSpace: false,
					isNewline: true,
					href: item.href,
				});
				i++;
			} else if (text[i] === ' ' || text[i] === '\t') {
				// Collect contiguous whitespace
				let end = i + 1;
				while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++;
				const ws = text.slice(i, end);
				const w = measurer.measureWord(ws, item.style);
				words.push({
					text: ws,
					width: w,
					style: item.style,
					runPath: item.runPath,
					runOffset: offset + i,
					charCount: end - i,
					isSpace: true,
					isNewline: false,
					href: item.href,
				});
				i = end;
			} else {
				// Collect word characters
				let end = i + 1;
				while (end < text.length && text[end] !== ' ' && text[end] !== '\t' && text[end] !== '\n')
					end++;
				const word = text.slice(i, end);
				const w = measurer.measureWord(word, item.style);
				words.push({
					text: word,
					width: w,
					style: item.style,
					runPath: item.runPath,
					runOffset: offset + i,
					charCount: end - i,
					isSpace: false,
					isNewline: false,
					href: item.href,
				});
				i = end;
			}
		}
	}

	return words;
}

/**
 * Fill one line greedily with words.
 */
function fillLine(
	words: readonly MeasuredWord[],
	startIdx: number,
	maxWidth: number,
	measurer: TextMeasurer,
): {
	fragments: PendingFragment[];
	nextWordIdx: number;
	maxAscent: number;
	maxDescent: number;
} {
	const fragments: PendingFragment[] = [];
	let currentWidth = 0;
	let maxAscent = 0;
	let maxDescent = 0;
	let idx = startIdx;

	// Accumulator for consecutive text in same run+style
	let accumText = '';
	let accumWidth = 0;
	let accumRunPath: JPPath | null = null;
	let accumRunOffset = 0;
	let accumStyle: ResolvedRunStyle | null = null;
	let accumCharCount = 0;
	let accumHref: string | undefined;

	function flushAccum(): void {
		if (accumText && accumStyle && accumRunPath) {
			const frag: PendingFragment = {
				text: accumText,
				width: accumWidth,
				style: accumStyle,
				runPath: accumRunPath,
				runOffset: accumRunOffset,
				charCount: accumCharCount,
				href: accumHref,
			};
			fragments.push(frag);
		}
		accumText = '';
		accumWidth = 0;
		accumRunPath = null;
		accumRunOffset = 0;
		accumStyle = null;
		accumCharCount = 0;
		accumHref = undefined;
	}

	while (idx < words.length) {
		const word = words[idx];

		if (word.isNewline) {
			flushAccum();
			idx++;
			break;
		}

		// Check if word fits
		const wouldWidth = currentWidth + word.width;

		if (fragments.length === 0 && accumText === '' && !word.isSpace) {
			// First word always fits (even if too wide)
			// Start accumulating
			accumText = word.text;
			accumWidth = word.width;
			accumRunPath = word.runPath;
			accumRunOffset = word.runOffset;
			accumStyle = word.style;
			accumCharCount = word.charCount;
			accumHref = word.href;
			currentWidth = word.width;

			const m = measurer.getFontMetrics(word.style);
			maxAscent = Math.max(maxAscent, m.ascent);
			maxDescent = Math.max(maxDescent, m.descent);
			idx++;
			continue;
		}

		if (wouldWidth > maxWidth && !word.isSpace) {
			// Doesn't fit — try hyphenation before giving up
			const hyphenResult = tryHyphenateWord(word, maxWidth - currentWidth, measurer);
			if (hyphenResult) {
				// First part (with hyphen appended) fits on this line
				const m = measurer.getFontMetrics(word.style);
				maxAscent = Math.max(maxAscent, m.ascent);
				maxDescent = Math.max(maxDescent, m.descent);

				flushAccum();
				fragments.push({
					text: hyphenResult.firstText,
					width: hyphenResult.firstWidth,
					style: word.style,
					runPath: word.runPath,
					runOffset: word.runOffset,
					charCount: hyphenResult.splitIndex,
					href: word.href,
				});
				currentWidth += hyphenResult.firstWidth;

				// Replace the current word with its remainder for the next line
				// We splice the remainder into the words array (as a mutable cast)
				const remainderWord: MeasuredWord = {
					text: hyphenResult.remainderText,
					width: hyphenResult.remainderWidth,
					style: word.style,
					runPath: word.runPath,
					runOffset: word.runOffset + hyphenResult.splitIndex,
					charCount: word.charCount - hyphenResult.splitIndex,
					isSpace: false,
					isNewline: false,
					href: word.href,
				};
				(words as MeasuredWord[]).splice(idx, 1, remainderWord);
				// Don't advance idx — the remainder will be the first word on the next line
			}
			break;
		}

		// Word fits
		const m = measurer.getFontMetrics(word.style);
		maxAscent = Math.max(maxAscent, m.ascent);
		maxDescent = Math.max(maxDescent, m.descent);

		// Check if we can merge with accumulator
		const sameRun =
			accumRunPath &&
			accumRunPath.length === word.runPath.length &&
			accumRunPath.every((v, i) => v === word.runPath[i]) &&
			accumStyle === word.style &&
			accumHref === word.href;

		if (sameRun) {
			accumText += word.text;
			accumWidth += word.width;
			accumCharCount += word.charCount;
		} else {
			flushAccum();
			accumText = word.text;
			accumWidth = word.width;
			accumRunPath = word.runPath;
			accumRunOffset = word.runOffset;
			accumStyle = word.style;
			accumCharCount = word.charCount;
			accumHref = word.href;
		}

		currentWidth = wouldWidth;
		idx++;
	}

	flushAccum();

	// Ensure at least some metrics
	if (maxAscent === 0) {
		maxAscent = 11;
		maxDescent = 3;
	}

	return { fragments, nextWordIdx: idx, maxAscent, maxDescent };
}

/**
 * Try to hyphenate a word so its first part (plus hyphen) fits in the available width.
 * Returns null if no valid hyphenation point produces a fitting fragment.
 */
function tryHyphenateWord(
	word: MeasuredWord,
	availableWidth: number,
	measurer: TextMeasurer,
): {
	firstText: string;
	firstWidth: number;
	remainderText: string;
	remainderWidth: number;
	splitIndex: number;
} | null {
	if (availableWidth <= 0) return null;

	const hyphenPoints = findHyphenationPoints(word.text);
	if (hyphenPoints.length === 0) return null;

	// Try hyphenation points from largest to smallest to get the longest possible first part
	for (let i = hyphenPoints.length - 1; i >= 0; i--) {
		const splitIdx = hyphenPoints[i];
		const firstPart = word.text.slice(0, splitIdx) + '-';
		const firstWidth = measurer.measureWord(firstPart, word.style);

		if (firstWidth <= availableWidth) {
			const remainderText = word.text.slice(splitIdx);
			const remainderWidth = measurer.measureWord(remainderText, word.style);
			return {
				firstText: firstPart,
				firstWidth,
				remainderText,
				remainderWidth,
				splitIndex: splitIdx,
			};
		}
	}

	return null;
}

/**
 * Apply BiDi reordering to a line's fragments when direction is RTL.
 * Concatenates fragment text, runs the bidi algorithm, and reorders
 * fragments to visual order.
 */
function applyBidiReorder(
	fragments: readonly PendingFragment[],
	direction?: BidiDirection,
): PendingFragment[] {
	if (!direction || direction === 'ltr' || fragments.length <= 1) {
		return [...fragments];
	}

	// For RTL paragraphs, determine the base direction and check if we
	// actually have mixed-direction content that needs reordering.
	const fullText = fragments.map((f) => f.text).join('');
	const baseDir = direction;

	// Get bidi runs for the concatenated text
	const bidiRuns = resolveBidiRuns(fullText, baseDir);
	if (bidiRuns.length <= 1) {
		// Single direction run — just reverse for RTL base direction
		if (baseDir === 'rtl') {
			return [...fragments].reverse();
		}
		return [...fragments];
	}

	// Map each fragment to a bidi level based on which bidi run its midpoint falls into
	const levels: number[] = [];
	let charOffset = 0;
	for (const frag of fragments) {
		const fragMid = charOffset + Math.floor(frag.text.length / 2);
		// Find which bidi run this fragment belongs to
		let fragLevel = baseDir === 'rtl' ? 1 : 0;
		for (const run of bidiRuns) {
			if (fragMid >= run.start && fragMid < run.end) {
				fragLevel = run.level;
				break;
			}
		}
		levels.push(fragLevel);
		charOffset += frag.text.length;
	}

	// Reorder fragments using the bidi levels
	const result = [...fragments];
	const maxLevel = Math.max(...levels);
	const minOddLevel = Math.min(...levels.filter((l) => l % 2 === 1), maxLevel + 1);

	if (minOddLevel > maxLevel) return result;

	for (let level = maxLevel; level >= minOddLevel; level--) {
		let i = 0;
		while (i < result.length) {
			if (levels[i] >= level) {
				let j = i + 1;
				while (j < result.length && levels[j] >= level) j++;
				// Reverse the segment [i, j) in both result and levels
				let lo = i;
				let hi = j - 1;
				while (lo < hi) {
					const tmpFrag = result[lo];
					result[lo] = result[hi];
					result[hi] = tmpFrag;
					const tmpLevel = levels[lo];
					levels[lo] = levels[hi];
					levels[hi] = tmpLevel;
					lo++;
					hi--;
				}
				i = j;
			} else {
				i++;
			}
		}
	}

	return result;
}

/**
 * Position fragments horizontally based on text alignment.
 * For RTL direction, fragments are positioned from the right edge.
 */
function positionFragments(
	fragments: readonly PendingFragment[],
	lineX: number,
	lineY: number,
	baseline: number,
	totalWidth: number,
	availableWidth: number,
	alignment: 'left' | 'center' | 'right' | 'justify',
	isLastLine: boolean,
	direction?: BidiDirection,
): LayoutFragment[] {
	// For RTL paragraphs with default alignment, treat 'left' as 'right'
	// (since the default alignment for RTL text is right-aligned)
	let effectiveAlignment = alignment;
	if (direction === 'rtl' && alignment === 'left') {
		effectiveAlignment = 'right';
	} else if (direction === 'rtl' && alignment === 'right') {
		effectiveAlignment = 'left';
	}

	let startX = lineX;

	if (effectiveAlignment === 'center') {
		startX += (availableWidth - totalWidth) / 2;
	} else if (effectiveAlignment === 'right') {
		startX += availableWidth - totalWidth;
	}

	// For justify, we add extra space between fragments
	// (skip for last line — it should be start-aligned per base direction)
	let extraSpace = 0;
	if (effectiveAlignment === 'justify' && !isLastLine && fragments.length > 1) {
		const spaceCount = fragments.filter((f) => f.text.includes(' ')).length;
		if (spaceCount > 0) {
			extraSpace = (availableWidth - totalWidth) / spaceCount;
		}
	}

	const result: LayoutFragment[] = [];
	let x = startX;

	for (const frag of fragments) {
		const rect: LayoutRect = {
			x,
			y: lineY,
			width: frag.width + (frag.text.includes(' ') ? extraSpace : 0),
			height: baseline + 4, // approximate descent
		};

		const layoutFrag: LayoutFragment = {
			text: frag.text,
			rect,
			runPath: frag.runPath,
			runOffset: frag.runOffset,
			charCount: frag.charCount,
			style: frag.style,
			...(frag.href ? { href: frag.href } : {}),
		};
		result.push(layoutFrag);

		x += rect.width;
	}

	return result;
}
