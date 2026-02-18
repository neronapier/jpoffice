import { describe, it, expect } from 'vitest';
import { createStyleRegistry } from '@jpoffice/model';
import { resolveRunStyle, resolveParagraphLayout } from '../src/style-resolver';

const emptyStyles = createStyleRegistry([]);

describe('resolveRunStyle', () => {
	it('returns defaults when no properties are specified', () => {
		const style = resolveRunStyle(emptyStyles, {}, {});
		expect(style.fontFamily).toBe('Calibri');
		expect(style.fontSize).toBeCloseTo(14.67, 1);
		expect(style.bold).toBe(false);
		expect(style.italic).toBe(false);
		expect(style.underline).toBe(false);
		expect(style.strikethrough).toBe(false);
		expect(style.color).toBe('#000000');
		expect(style.backgroundColor).toBeNull();
		expect(style.highlight).toBeNull();
		expect(style.allCaps).toBe(false);
		expect(style.smallCaps).toBe(false);
		expect(style.letterSpacing).toBe(0);
	});

	it('applies direct run properties', () => {
		const style = resolveRunStyle(emptyStyles, {}, {
			bold: true,
			italic: true,
			fontFamily: 'Arial',
		});
		expect(style.bold).toBe(true);
		expect(style.italic).toBe(true);
		expect(style.fontFamily).toBe('Arial');
	});

	it('applies font size from half-points', () => {
		// 24 half-points = 12pt = 16px
		const style = resolveRunStyle(emptyStyles, {}, { fontSize: 24 });
		expect(style.fontSize).toBe(16);
	});

	it('applies underline', () => {
		const style = resolveRunStyle(emptyStyles, {}, { underline: 'single' });
		expect(style.underline).toBe('single');
	});

	it('underline "none" resolves to false', () => {
		const style = resolveRunStyle(emptyStyles, {}, { underline: 'none' });
		expect(style.underline).toBe(false);
	});

	it('applies color with hash prefix', () => {
		const style = resolveRunStyle(emptyStyles, {}, { color: 'FF0000' });
		expect(style.color).toBe('#FF0000');
	});

	it('paragraph run properties are inherited', () => {
		const style = resolveRunStyle(emptyStyles, { runProperties: { bold: true } }, {});
		expect(style.bold).toBe(true);
	});

	it('direct run properties override paragraph defaults', () => {
		const style = resolveRunStyle(
			emptyStyles,
			{ runProperties: { bold: true } },
			{ bold: false },
		);
		expect(style.bold).toBe(false);
	});
});

describe('resolveParagraphLayout', () => {
	it('returns defaults for empty properties', () => {
		const layout = resolveParagraphLayout(emptyStyles, {});
		expect(layout.alignment).toBe('left');
		expect(layout.spaceBefore).toBe(0);
		expect(layout.spaceAfter).toBeGreaterThan(0); // default 160 twips
		expect(layout.lineSpacing).toBeCloseTo(1.15, 2);
		expect(layout.indentLeft).toBe(0);
		expect(layout.indentRight).toBe(0);
		expect(layout.indentFirstLine).toBe(0);
	});

	it('resolves alignment', () => {
		const center = resolveParagraphLayout(emptyStyles, { alignment: 'center' });
		expect(center.alignment).toBe('center');

		const right = resolveParagraphLayout(emptyStyles, { alignment: 'right' });
		expect(right.alignment).toBe('right');

		const justify = resolveParagraphLayout(emptyStyles, { alignment: 'justify' });
		expect(justify.alignment).toBe('justify');
	});

	it('resolves spacing', () => {
		const layout = resolveParagraphLayout(emptyStyles, {
			spacing: { before: 240, after: 120, line: 480, lineRule: 'auto' },
		});
		expect(layout.spaceBefore).toBeGreaterThan(0);
		expect(layout.spaceAfter).toBeGreaterThan(0);
		expect(layout.lineSpacing).toBe(2); // 480/240 = double
	});

	it('resolves indentation', () => {
		const layout = resolveParagraphLayout(emptyStyles, {
			indent: { left: 720, right: 360 },
		});
		expect(layout.indentLeft).toBeGreaterThan(0);
		expect(layout.indentRight).toBeGreaterThan(0);
	});

	it('resolves hanging indent as negative firstLine', () => {
		const layout = resolveParagraphLayout(emptyStyles, {
			indent: { hanging: 360 },
		});
		expect(layout.indentFirstLine).toBeLessThan(0);
	});

	it('resolves firstLine indent', () => {
		const layout = resolveParagraphLayout(emptyStyles, {
			indent: { firstLine: 720 },
		});
		expect(layout.indentFirstLine).toBeGreaterThan(0);
	});
});
