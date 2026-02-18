import type { JPPath } from '@jpoffice/model';
import type { PositionedFloat } from './float-layout';
import { getLineExclusions, isBlockedByFloat } from './float-layout';
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
}

/**
 * Break a sequence of inline items into lines using a greedy algorithm.
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

		// Position fragments horizontally based on alignment
		const totalFragWidth = fragments.reduce((s, f) => s + f.width, 0);
		const positionedFragments = positionFragments(
			fragments,
			effectiveLineX,
			lineY,
			maxAscent,
			totalFragWidth,
			effectiveLineWidth,
			alignment,
			nextWordIdx >= words.length, // isLastLine
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
}

interface PendingFragment {
	readonly text: string;
	readonly width: number;
	readonly style: ResolvedRunStyle;
	readonly runPath: JPPath;
	readonly runOffset: number;
	readonly charCount: number;
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

	function flushAccum(): void {
		if (accumText && accumStyle && accumRunPath) {
			fragments.push({
				text: accumText,
				width: accumWidth,
				style: accumStyle,
				runPath: accumRunPath,
				runOffset: accumRunOffset,
				charCount: accumCharCount,
			});
		}
		accumText = '';
		accumWidth = 0;
		accumRunPath = null;
		accumRunOffset = 0;
		accumStyle = null;
		accumCharCount = 0;
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
			currentWidth = word.width;

			const m = measurer.getFontMetrics(word.style);
			maxAscent = Math.max(maxAscent, m.ascent);
			maxDescent = Math.max(maxDescent, m.descent);
			idx++;
			continue;
		}

		if (wouldWidth > maxWidth && !word.isSpace) {
			// Doesn't fit - break here
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
			accumStyle === word.style;

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
 * Position fragments horizontally based on text alignment.
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
): LayoutFragment[] {
	let startX = lineX;

	if (alignment === 'center') {
		startX += (availableWidth - totalWidth) / 2;
	} else if (alignment === 'right') {
		startX += availableWidth - totalWidth;
	}

	// For justify, we add extra space between fragments
	// (skip for last line - it should be left-aligned)
	let extraSpace = 0;
	if (alignment === 'justify' && !isLastLine && fragments.length > 1) {
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

		result.push({
			text: frag.text,
			rect,
			runPath: frag.runPath,
			runOffset: frag.runOffset,
			charCount: frag.charCount,
			style: frag.style,
		});

		x += rect.width;
	}

	return result;
}
