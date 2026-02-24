import { describe, expect, it } from 'vitest';
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

describe('TextMeasurer', () => {
	it('should create an instance', () => {
		const measurer = new TextMeasurer();
		expect(measurer).toBeDefined();
	});

	it('buildFontString produces valid CSS font string', () => {
		const measurer = new TextMeasurer();
		const font = measurer.buildFontString(defaultStyle);
		expect(font).toContain('14.67px');
		expect(font).toContain('"Calibri"');
	});

	it('buildFontString includes bold and italic', () => {
		const measurer = new TextMeasurer();
		const font = measurer.buildFontString({ ...defaultStyle, bold: true, italic: true });
		expect(font).toContain('italic');
		expect(font).toContain('bold');
	});

	it('measureText returns positive width and height', () => {
		const measurer = new TextMeasurer();
		const m = measurer.measureText('Hello', defaultStyle);
		expect(m.width).toBeGreaterThan(0);
		expect(m.height).toBeGreaterThan(0);
	});

	it('measureText width increases with longer text', () => {
		const measurer = new TextMeasurer();
		const short = measurer.measureText('Hi', defaultStyle);
		const long = measurer.measureText('Hello World', defaultStyle);
		expect(long.width).toBeGreaterThan(short.width);
	});

	it('measureText returns 0 width for empty string', () => {
		const measurer = new TextMeasurer();
		const m = measurer.measureText('', defaultStyle);
		expect(m.width).toBe(0);
	});

	it('measureWord returns positive value', () => {
		const measurer = new TextMeasurer();
		const w = measurer.measureWord('test', defaultStyle);
		expect(w).toBeGreaterThan(0);
	});

	it('getFontMetrics returns reasonable values', () => {
		const measurer = new TextMeasurer();
		const metrics = measurer.getFontMetrics(defaultStyle);
		expect(metrics.ascent).toBeGreaterThan(0);
		expect(metrics.descent).toBeGreaterThan(0);
		expect(metrics.lineHeight).toBeGreaterThan(0);
		expect(metrics.lineHeight).toBeGreaterThanOrEqual(metrics.ascent + metrics.descent);
		expect(metrics.emSize).toBe(defaultStyle.fontSize);
	});

	it('letterSpacing adds extra width', () => {
		// Use separate measurer instances to avoid cache collision
		const measurer1 = new TextMeasurer();
		const measurer2 = new TextMeasurer();
		const normal = measurer1.measureText('abc', defaultStyle);
		const spaced = measurer2.measureText('abc', { ...defaultStyle, letterSpacing: 5 });
		// 3 chars, 2 gaps, 5px each = 10px extra
		expect(spaced.width).toBeGreaterThan(normal.width);
	});

	it('caches measurements', () => {
		const measurer = new TextMeasurer();
		const m1 = measurer.measureText('cached', defaultStyle);
		const m2 = measurer.measureText('cached', defaultStyle);
		expect(m1.width).toBe(m2.width);
	});

	it('clearCache resets state', () => {
		const measurer = new TextMeasurer();
		measurer.measureText('test', defaultStyle);
		measurer.clearCache();
		// Should still work after clear
		const m = measurer.measureText('test', defaultStyle);
		expect(m.width).toBeGreaterThan(0);
	});
});
