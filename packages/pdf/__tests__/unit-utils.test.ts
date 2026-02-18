import { describe, it, expect } from 'vitest';
import { pxToPt, flipY, colorToRgb, escapePdfString, round } from '../src/unit-utils';

describe('unit-utils', () => {
	describe('pxToPt', () => {
		it('converts 96 px to 72 pt', () => {
			expect(pxToPt(96)).toBe(72);
		});

		it('converts 0 px to 0 pt', () => {
			expect(pxToPt(0)).toBe(0);
		});

		it('converts arbitrary values', () => {
			expect(pxToPt(100)).toBe(75);
			expect(pxToPt(200)).toBe(150);
		});
	});

	describe('flipY', () => {
		it('flips Y coordinate', () => {
			expect(flipY(100, 842)).toBe(742);
		});

		it('flips 0 to page height', () => {
			expect(flipY(0, 842)).toBe(842);
		});

		it('flips page height to 0', () => {
			expect(flipY(842, 842)).toBe(0);
		});
	});

	describe('colorToRgb', () => {
		it('parses black', () => {
			expect(colorToRgb('#000000')).toEqual([0, 0, 0]);
		});

		it('parses white', () => {
			expect(colorToRgb('#FFFFFF')).toEqual([1, 1, 1]);
		});

		it('parses red', () => {
			const [r, g, b] = colorToRgb('#FF0000');
			expect(r).toBe(1);
			expect(g).toBe(0);
			expect(b).toBe(0);
		});

		it('parses 3-char hex', () => {
			const [r, g, b] = colorToRgb('#F00');
			expect(r).toBe(1);
			expect(g).toBe(0);
			expect(b).toBe(0);
		});

		it('parses without hash', () => {
			expect(colorToRgb('000000')).toEqual([0, 0, 0]);
		});
	});

	describe('escapePdfString', () => {
		it('escapes backslash', () => {
			expect(escapePdfString('a\\b')).toBe('a\\\\b');
		});

		it('escapes parentheses', () => {
			expect(escapePdfString('(hello)')).toBe('\\(hello\\)');
		});

		it('replaces non-ASCII with ?', () => {
			expect(escapePdfString('café')).toBe('caf?');
		});

		it('leaves normal text unchanged', () => {
			expect(escapePdfString('Hello World')).toBe('Hello World');
		});
	});

	describe('round', () => {
		it('rounds to 2 decimals by default', () => {
			expect(round(3.14159)).toBe(3.14);
		});

		it('rounds to specified decimals', () => {
			expect(round(3.14159, 3)).toBe(3.142);
		});

		it('handles integers', () => {
			expect(round(42)).toBe(42);
		});
	});
});
