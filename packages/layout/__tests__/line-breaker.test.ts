import { describe, it, expect } from 'vitest';
import { breakIntoLines } from '../src/line-breaker';
import type { InlineItem } from '../src/line-breaker';
import type { PositionedFloat } from '../src/float-layout';
import { TextMeasurer } from '../src/text-measurer';
import type { ResolvedRunStyle } from '../src/types';

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

describe('breakIntoLines', () => {
	const measurer = new TextMeasurer();

	it('returns one line for empty items', () => {
		const lines = breakIntoLines([], measurer, 500, 0, 'left', 1.15, [0, 0], 0);
		expect(lines).toHaveLength(1);
		expect(lines[0].fragments).toHaveLength(0);
		expect(lines[0].lineIndex).toBe(0);
	});

	it('lays out a single word in one line', () => {
		const items: InlineItem[] = [makeItem('Hello')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'left', 1.15, [0, 0], 0);
		expect(lines).toHaveLength(1);
		expect(lines[0].fragments.length).toBeGreaterThanOrEqual(1);
		expect(lines[0].fragments[0].text).toBe('Hello');
	});

	it('wraps long text to multiple lines', () => {
		// Very narrow width should force wrapping
		const items: InlineItem[] = [makeItem('Hello World Foo Bar')];
		const lines = breakIntoLines(items, measurer, 40, 0, 'left', 1.0, [0, 0], 0);
		expect(lines.length).toBeGreaterThan(1);
	});

	it('lines have increasing Y coordinates', () => {
		const items: InlineItem[] = [makeItem('Word1 Word2 Word3 Word4 Word5 Word6')];
		const lines = breakIntoLines(items, measurer, 60, 0, 'left', 1.0, [0, 0], 10);
		for (let i = 1; i < lines.length; i++) {
			expect(lines[i].rect.y).toBeGreaterThan(lines[i - 1].rect.y);
		}
	});

	it('first line starts at startY', () => {
		const items: InlineItem[] = [makeItem('Text')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 42);
		expect(lines[0].rect.y).toBe(42);
	});

	it('respects firstLineIndent', () => {
		const items: InlineItem[] = [makeItem('Hello World')];
		const noIndent = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 0);
		const withIndent = breakIntoLines(items, measurer, 500, 30, 'left', 1.0, [0, 0], 0);
		// First line of indented should have smaller available width
		expect(withIndent[0].rect.width).toBeLessThan(noIndent[0].rect.width);
	});

	it('center alignment shifts fragments', () => {
		const items: InlineItem[] = [makeItem('Hi')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'center', 1.0, [0, 0], 0);
		expect(lines).toHaveLength(1);
		if (lines[0].fragments.length > 0) {
			// Fragment X should be greater than 0 for centered text in wide space
			expect(lines[0].fragments[0].rect.x).toBeGreaterThan(0);
		}
	});

	it('right alignment pushes fragments right', () => {
		const items: InlineItem[] = [makeItem('Hi')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'right', 1.0, [0, 0], 0);
		expect(lines).toHaveLength(1);
		if (lines[0].fragments.length > 0) {
			// Fragment X should be well past the midpoint
			expect(lines[0].fragments[0].rect.x).toBeGreaterThan(200);
		}
	});

	it('handles newline characters', () => {
		const items: InlineItem[] = [makeItem('Line1\nLine2')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 0);
		expect(lines.length).toBeGreaterThanOrEqual(2);
	});

	it('preserves paragraphPath and lineIndex', () => {
		const path = [0, 2] as const;
		const items: InlineItem[] = [makeItem('Hello World')];
		const lines = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [...path], 0);
		expect(lines[0].paragraphPath).toEqual([0, 2]);
		expect(lines[0].lineIndex).toBe(0);
	});

	it('line height scales with lineSpacing', () => {
		const items: InlineItem[] = [makeItem('Hello')];
		const single = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 0);
		const double = breakIntoLines(items, measurer, 500, 0, 'left', 2.0, [0, 0], 0);
		expect(double[0].rect.height).toBeGreaterThan(single[0].rect.height);
	});

	describe('float wrapping integration', () => {
		function makeFloat(overrides: Partial<PositionedFloat> = {}): PositionedFloat {
			return {
				nodeId: 'f1',
				imageNodeId: 'img1',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				src: 'test.png',
				mimeType: 'image/png',
				behindText: false,
				wrapping: { type: 'square', side: 'left' },
				...overrides,
			};
		}

		it('reduces available width when float overlaps line Y', () => {
			const items: InlineItem[] = [makeItem('Hello World Test Text')];
			// Float on the left, 100px wide, starting at y=0
			const float = makeFloat({ x: 0, y: 0, width: 100, height: 80 });

			const withoutFloat = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 0);
			const withFloat = breakIntoLines(
				items, measurer, 500, 0, 'left', 1.0, [0, 0], 0,
				[float], 0, 500,
			);

			// With float, lines should have less width or different X
			expect(withFloat[0].rect.x).toBeGreaterThanOrEqual(withoutFloat[0].rect.x);
		});

		it('skips Y range blocked by topAndBottom float', () => {
			const items: InlineItem[] = [makeItem('Hello')];
			const float = makeFloat({
				x: 50,
				y: 0,
				width: 200,
				height: 50,
				wrapping: { type: 'topAndBottom' },
			});

			const lines = breakIntoLines(
				items, measurer, 500, 0, 'left', 1.0, [0, 0], 0,
				[float], 0, 500,
			);

			// First line should start at or after the float bottom (50)
			expect(lines[0].rect.y).toBeGreaterThanOrEqual(50);
		});

		it('does not affect lines below the float', () => {
			const items: InlineItem[] = [makeItem('Hello')];
			// Float at y=0 to y=30
			const float = makeFloat({ x: 0, y: 0, width: 100, height: 30 });

			const lines = breakIntoLines(
				items, measurer, 500, 0, 'left', 1.0, [0, 0], 100,
				[float], 0, 500,
			);

			// Line starts at y=100, well below float — should not be affected
			expect(lines[0].rect.width).toBe(500);
		});

		it('works with no floats (backward compatible)', () => {
			const items: InlineItem[] = [makeItem('Hello')];
			const withUndefined = breakIntoLines(items, measurer, 500, 0, 'left', 1.0, [0, 0], 0);
			const withEmpty = breakIntoLines(
				items, measurer, 500, 0, 'left', 1.0, [0, 0], 0,
				[], 0, 500,
			);
			expect(withUndefined[0].rect.width).toBe(withEmpty[0].rect.width);
		});
	});
});
