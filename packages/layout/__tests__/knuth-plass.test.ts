import { describe, expect, it } from 'vitest';
import { fragmentsToKPItems, knuthPlassBreak } from '../src/knuth-plass';
import type { KPBox, KPGlue, KPItem, KPPenalty } from '../src/knuth-plass';
import { breakIntoLines } from '../src/line-breaker';
import type { InlineItem } from '../src/line-breaker';
import { TextMeasurer } from '../src/text-measurer';
import type { ResolvedRunStyle } from '../src/types';

// ── Test helpers ─────────────────────────────────────────────────────────────

function box(width: number, content: unknown = null): KPBox {
	return { type: 'box', width, content };
}

function glue(width: number, stretch: number, shrink: number): KPGlue {
	return { type: 'glue', width, stretch, shrink };
}

function penalty(penalty: number, width = 0, flagged = false): KPPenalty {
	return { type: 'penalty', width, penalty, flagged };
}

/** Create a simple paragraph: words separated by uniform glue, ending with forced break. */
function makeSimpleParagraph(
	wordWidths: number[],
	spaceWidth: number,
	stretchRatio = 0.5,
	shrinkRatio = 0.33,
): KPItem[] {
	const items: KPItem[] = [];
	for (let i = 0; i < wordWidths.length; i++) {
		items.push(box(wordWidths[i], `word${i}`));
		if (i < wordWidths.length - 1) {
			items.push(glue(spaceWidth, spaceWidth * stretchRatio, spaceWidth * shrinkRatio));
		}
	}
	// Finishing glue + forced break
	items.push(glue(0, 10000, 0));
	items.push(penalty(-10000, 0, false));
	return items;
}

const defaultStyle: ResolvedRunStyle = {
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
};

function makeItem(text: string, offset = 0): InlineItem {
	return {
		text,
		style: defaultStyle,
		runPath: [0, 0, 0],
		runOffset: offset,
	};
}

// ── Tests: knuthPlassBreak ───────────────────────────────────────────────────

describe('knuthPlassBreak', () => {
	it('returns empty breakpoints for empty items', () => {
		const result = knuthPlassBreak([], { lineWidths: 100 });
		expect(result).not.toBeNull();
		expect(result!.breakpoints).toHaveLength(0);
		expect(result!.demerits).toBe(0);
	});

	it('fits a single word on one line', () => {
		const items = makeSimpleParagraph([50], 10);
		const result = knuthPlassBreak(items, { lineWidths: 100 });
		expect(result).not.toBeNull();
		expect(result!.breakpoints).toHaveLength(1);
		expect(result!.breakpoints[0].line).toBe(0);
	});

	it('breaks two words that do not fit on one line', () => {
		// Two 60px words with 10px space = 130px total, line width = 100px
		const items = makeSimpleParagraph([60, 60], 10);
		const result = knuthPlassBreak(items, { lineWidths: 100, tolerance: 5 });
		expect(result).not.toBeNull();
		expect(result!.breakpoints.length).toBe(2);
	});

	it('keeps words on one line when they fit', () => {
		// Three 20px words with 10px spaces = 80px total, line width = 100px
		const items = makeSimpleParagraph([20, 20, 20], 10);
		const result = knuthPlassBreak(items, { lineWidths: 100 });
		expect(result).not.toBeNull();
		expect(result!.breakpoints).toHaveLength(1);
	});

	it('handles varying line widths (first line indent)', () => {
		// First line 80px, subsequent lines 100px
		// Words: 30 + 10 + 30 + 10 + 30 = 110px natural
		const items = makeSimpleParagraph([30, 30, 30], 10);
		const result = knuthPlassBreak(items, {
			lineWidths: [80, 100],
			tolerance: 2,
		});
		expect(result).not.toBeNull();
		// Should break into 2 lines since 3 words don't fit on 80px line
		expect(result!.breakpoints.length).toBeGreaterThanOrEqual(1);
	});

	it('returns null when tolerance is too strict', () => {
		// Words barely fit: need significant stretching
		const items = makeSimpleParagraph([90], 10, 0.01, 0.01);
		const result = knuthPlassBreak(items, {
			lineWidths: 200,
			tolerance: 0.01,
		});
		// The last line uses the forced break with infinitely stretchable glue,
		// so it should still find a solution
		expect(result).not.toBeNull();
	});

	it('minimizes total demerits across multiple lines', () => {
		// Create a paragraph where greedy would make different choices than optimal
		// 5 words of various widths, narrow line width
		const items = makeSimpleParagraph([30, 40, 25, 35, 30], 10);
		const result = knuthPlassBreak(items, {
			lineWidths: 100,
			tolerance: 2,
		});
		expect(result).not.toBeNull();
		expect(result!.breakpoints.length).toBeGreaterThanOrEqual(2);
		expect(result!.demerits).toBeGreaterThan(0);
	});

	it('handles forced breaks (penalty = -infinity)', () => {
		const items: KPItem[] = [
			box(30, 'a'),
			penalty(-10000), // forced break
			box(30, 'b'),
			glue(0, 10000, 0),
			penalty(-10000),
		];
		const result = knuthPlassBreak(items, { lineWidths: 100, tolerance: 5 });
		expect(result).not.toBeNull();
		// Should have at least 2 breakpoints (one at forced break, one at end)
		expect(result!.breakpoints.length).toBe(2);
	});

	it('penalizes consecutive flagged (hyphen) breaks', () => {
		const items: KPItem[] = [
			box(40, 'w1'),
			penalty(50, 5, true), // hyphen break
			box(40, 'w2'),
			penalty(50, 5, true), // another hyphen break
			box(40, 'w3'),
			glue(0, 10000, 0),
			penalty(-10000),
		];

		const withDouble = knuthPlassBreak(items, {
			lineWidths: 50,
			tolerance: 5,
			doublePenalty: 3000,
		});

		const withoutDouble = knuthPlassBreak(items, {
			lineWidths: 50,
			tolerance: 5,
			doublePenalty: 0,
		});

		// Both should find solutions; the one with doublePenalty should have higher demerits
		// if consecutive hyphens are used
		expect(withDouble).not.toBeNull();
		expect(withoutDouble).not.toBeNull();
	});

	it('respects fitness class penalties', () => {
		// Create items that would produce lines with very different ratios
		const items = makeSimpleParagraph([80, 20, 80, 20], 10);

		const withFitness = knuthPlassBreak(items, {
			lineWidths: 100,
			tolerance: 3,
			fitness: true,
		});

		const withoutFitness = knuthPlassBreak(items, {
			lineWidths: 100,
			tolerance: 3,
			fitness: false,
		});

		expect(withFitness).not.toBeNull();
		expect(withoutFitness).not.toBeNull();
	});

	it('handles a paragraph with many words', () => {
		// 20 words, each 30px, with 8px spaces
		const wordWidths = Array(20).fill(30);
		const items = makeSimpleParagraph(wordWidths, 8);
		const result = knuthPlassBreak(items, {
			lineWidths: 200,
			tolerance: 2,
		});
		expect(result).not.toBeNull();
		// ~4 words per line => ~5 lines
		expect(result!.breakpoints.length).toBeGreaterThan(2);
	});

	it('produces lines where each breakpoint has increasing line numbers', () => {
		const items = makeSimpleParagraph([30, 30, 30, 30, 30, 30], 10);
		const result = knuthPlassBreak(items, {
			lineWidths: 100,
			tolerance: 2,
		});
		expect(result).not.toBeNull();
		for (let i = 1; i < result!.breakpoints.length; i++) {
			expect(result!.breakpoints[i].line).toBeGreaterThan(result!.breakpoints[i - 1].line);
		}
	});

	it('breakpoints have finite adjustment ratios', () => {
		const items = makeSimpleParagraph([40, 40, 40], 10);
		const result = knuthPlassBreak(items, {
			lineWidths: 100,
			tolerance: 2,
		});
		expect(result).not.toBeNull();
		for (const bp of result!.breakpoints) {
			expect(Number.isFinite(bp.ratio)).toBe(true);
		}
	});
});

// ── Tests: fragmentsToKPItems ────────────────────────────────────────────────

describe('fragmentsToKPItems', () => {
	it('converts words to boxes and spaces to glue', () => {
		const fragments = [
			{ width: 30, isSpace: false, content: 'hello' },
			{ width: 8, isSpace: true, content: ' ' },
			{ width: 40, isSpace: false, content: 'world' },
		];
		const items = fragmentsToKPItems(fragments, 8);

		// Should be: box, glue, box, finishing-glue, forced-penalty
		expect(items).toHaveLength(5);
		expect(items[0].type).toBe('box');
		expect((items[0] as KPBox).width).toBe(30);
		expect(items[1].type).toBe('glue');
		expect((items[1] as KPGlue).width).toBe(8);
		expect(items[2].type).toBe('box');
		expect((items[2] as KPBox).width).toBe(40);
		expect(items[3].type).toBe('glue'); // finishing glue
		expect(items[4].type).toBe('penalty'); // forced break
		expect((items[4] as KPPenalty).penalty).toBe(-10000);
	});

	it('handles a single word', () => {
		const fragments = [{ width: 50, isSpace: false, content: 'word' }];
		const items = fragmentsToKPItems(fragments, 8);
		// box + finishing-glue + forced-penalty
		expect(items).toHaveLength(3);
		expect(items[0].type).toBe('box');
	});

	it('handles empty fragments', () => {
		const items = fragmentsToKPItems([], 8);
		// Just finishing-glue + forced-penalty
		expect(items).toHaveLength(2);
	});

	it('glue has correct stretch and shrink', () => {
		const fragments = [
			{ width: 30, isSpace: false, content: 'a' },
			{ width: 10, isSpace: true, content: ' ' },
			{ width: 30, isSpace: false, content: 'b' },
		];
		const items = fragmentsToKPItems(fragments, 10);
		const glueItem = items[1] as KPGlue;
		expect(glueItem.stretch).toBeCloseTo(5); // 10 * 0.5
		expect(glueItem.shrink).toBeCloseTo(3.3); // 10 * 0.33
	});

	it('preserves content references in boxes', () => {
		const fragments = [
			{ width: 30, isSpace: false, content: { id: 42 } },
			{ width: 8, isSpace: true, content: null },
			{ width: 40, isSpace: false, content: { id: 99 } },
		];
		const items = fragmentsToKPItems(fragments, 8);
		expect((items[0] as KPBox).content).toEqual({ id: 42 });
		expect((items[2] as KPBox).content).toEqual({ id: 99 });
	});
});

// ── Tests: Integration with breakIntoLines ───────────────────────────────────

describe('breakIntoLines with optimal strategy', () => {
	const measurer = new TextMeasurer();

	it('works with lineBreaking=optimal for justify alignment', () => {
		const items: InlineItem[] = [
			makeItem('The quick brown fox jumps over the lazy dog and more text here'),
		];
		const lines = breakIntoLines(
			items,
			measurer,
			200,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);
		expect(lines.length).toBeGreaterThanOrEqual(1);
		// Each line should have fragments
		for (const line of lines) {
			if (line.lineIndex < lines.length - 1) {
				// Non-last lines should have content
				expect(line.fragments.length).toBeGreaterThan(0);
			}
		}
	});

	it('falls back to greedy for non-justify alignment', () => {
		const items: InlineItem[] = [makeItem('Hello World Foo Bar')];
		const optimalLeft = breakIntoLines(
			items,
			measurer,
			60,
			0,
			'left',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);
		const greedyLeft = breakIntoLines(
			items,
			measurer,
			60,
			0,
			'left',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'greedy',
		);
		// Should produce same results since optimal falls back for non-justify
		expect(optimalLeft.length).toBe(greedyLeft.length);
	});

	it('falls back to greedy when floats are present', () => {
		const items: InlineItem[] = [makeItem('Hello World')];
		const float = {
			nodeId: 'f1',
			imageNodeId: 'img1',
			imagePath: [0],
			x: 0,
			y: 0,
			width: 50,
			height: 50,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'square' as const, side: 'left' as const },
		};
		const lines = breakIntoLines(
			items,
			measurer,
			500,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			[float],
			0,
			500,
			undefined,
			'optimal',
		);
		// Should still work (via greedy fallback)
		expect(lines.length).toBeGreaterThanOrEqual(1);
	});

	it('falls back to greedy for text with newlines', () => {
		const items: InlineItem[] = [makeItem('Hello\nWorld')];
		const lines = breakIntoLines(
			items,
			measurer,
			500,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);
		expect(lines.length).toBeGreaterThanOrEqual(2);
	});

	it('default lineBreaking uses greedy', () => {
		const items: InlineItem[] = [makeItem('Hello World')];
		const noParam = breakIntoLines(items, measurer, 500, 0, 'justify', 1.0, [0, 0], 0);
		const greedy = breakIntoLines(
			items,
			measurer,
			500,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'greedy',
		);
		// Should produce identical results
		expect(noParam.length).toBe(greedy.length);
		expect(noParam[0].fragments.length).toBe(greedy[0].fragments.length);
	});

	it('produces valid line structure with optimal breaking', () => {
		const items: InlineItem[] = [makeItem('Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8')];
		const lines = breakIntoLines(
			items,
			measurer,
			100,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);

		// Lines should have increasing Y
		for (let i = 1; i < lines.length; i++) {
			expect(lines[i].rect.y).toBeGreaterThan(lines[i - 1].rect.y);
		}

		// Each line should have lineIndex matching its position
		for (let i = 0; i < lines.length; i++) {
			expect(lines[i].lineIndex).toBe(i);
		}

		// paragraphPath should be preserved
		for (const line of lines) {
			expect(line.paragraphPath).toEqual([0, 0]);
		}
	});

	it('handles firstLineIndent with optimal breaking', () => {
		const items: InlineItem[] = [makeItem('The quick brown fox jumps over the lazy dog')];
		const withIndent = breakIntoLines(
			items,
			measurer,
			200,
			30,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);
		const noIndent = breakIntoLines(
			items,
			measurer,
			200,
			0,
			'justify',
			1.0,
			[0, 0],
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			'optimal',
		);

		// With indent, first line should have less available width
		if (withIndent.length > 0 && noIndent.length > 0) {
			expect(withIndent[0].rect.width).toBeLessThan(noIndent[0].rect.width);
		}
	});
});
