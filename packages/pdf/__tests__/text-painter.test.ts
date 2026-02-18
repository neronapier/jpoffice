import { describe, it, expect } from 'vitest';
import { TextPainter } from '../src/text-painter';
import { ContentStreamBuilder } from '../src/content-stream';
import { FontRegistry } from '../src/font-map';
import type { LayoutFragment, LayoutLine } from '@jpoffice/layout';

function makeFragment(overrides: Partial<LayoutFragment> = {}): LayoutFragment {
	return {
		text: 'Hello',
		rect: { x: 0, y: 0, width: 50, height: 16 },
		runPath: [0, 0, 0, 0],
		runOffset: 0,
		charCount: 5,
		style: {
			fontFamily: 'Arial',
			fontSize: 16,
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
		},
		...overrides,
	};
}

function makeLine(fragments: LayoutFragment[] = []): LayoutLine {
	return {
		rect: { x: 0, y: 0, width: 500, height: 20 },
		baseline: 14,
		fragments,
		paragraphPath: [0, 0, 0],
		lineIndex: 0,
	};
}

describe('TextPainter', () => {
	it('paints a basic text fragment', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment();
		const line = makeLine([frag]);
		painter.paintFragment(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('BT');
		expect(result).toContain('Tf');
		expect(result).toContain('(Hello) Tj');
		expect(result).toContain('ET');
	});

	it('applies bold font', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				bold: true,
			},
		});
		const line = makeLine([frag]);
		painter.paintFragment(frag, line, 0, 0);

		// Should have registered Helvetica-Bold
		const allFonts = fonts.getAllFonts();
		const fontNames = Array.from(allFonts.keys());
		expect(fontNames).toContain('Helvetica-Bold');
	});

	it('sets fill color from style', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				color: '#FF0000',
			},
		});
		const line = makeLine([frag]);
		painter.paintFragment(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('1 0 0 rg');
	});

	it('paints highlight background', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				highlight: '#FFFF00',
			},
		});
		const line = makeLine([frag]);
		painter.paintHighlight(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('re');
		expect(result).toContain('f');
	});

	it('paints underline decoration', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				underline: 'single',
			},
		});
		const line = makeLine([frag]);
		painter.paintDecorations(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('m');
		expect(result).toContain('l');
		expect(result).toContain('S');
	});

	it('paints strikethrough decoration', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				strikethrough: true,
			},
		});
		const line = makeLine([frag]);
		painter.paintDecorations(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('m');
		expect(result).toContain('S');
	});

	it('skips empty text', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({ text: '' });
		const line = makeLine([frag]);
		painter.paintFragment(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toBe('');
	});

	it('applies allCaps transformation', () => {
		const stream = new ContentStreamBuilder();
		const fonts = new FontRegistry();
		const painter = new TextPainter(stream, fonts, 842);

		const frag = makeFragment({
			style: {
				...makeFragment().style,
				allCaps: true,
			},
		});
		const line = makeLine([frag]);
		painter.paintFragment(frag, line, 0, 0);

		const result = stream.build();
		expect(result).toContain('(HELLO) Tj');
	});
});
