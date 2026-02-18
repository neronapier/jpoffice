import { describe, it, expect } from 'vitest';
import { TextRenderer } from '../src/text-renderer';
import type { ResolvedRunStyle } from '@jpoffice/layout';

function baseStyle(overrides?: Partial<ResolvedRunStyle>): ResolvedRunStyle {
	return {
		fontFamily: 'Arial',
		fontSize: 12,
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
		...overrides,
	};
}

describe('TextRenderer.buildFont', () => {
	it('builds basic font string', () => {
		const font = TextRenderer.buildFont(baseStyle());
		expect(font).toBe('12px Arial');
	});

	it('includes bold', () => {
		const font = TextRenderer.buildFont(baseStyle({ bold: true }));
		expect(font).toBe('bold 12px Arial');
	});

	it('includes italic', () => {
		const font = TextRenderer.buildFont(baseStyle({ italic: true }));
		expect(font).toBe('italic 12px Arial');
	});

	it('includes bold and italic', () => {
		const font = TextRenderer.buildFont(baseStyle({ bold: true, italic: true }));
		expect(font).toBe('italic bold 12px Arial');
	});

	it('uses custom font family and size', () => {
		const font = TextRenderer.buildFont(
			baseStyle({ fontFamily: 'Times New Roman', fontSize: 16 }),
		);
		expect(font).toBe('16px Times New Roman');
	});

	it('handles different font sizes', () => {
		const font = TextRenderer.buildFont(baseStyle({ fontSize: 24 }));
		expect(font).toBe('24px Arial');
	});
});
