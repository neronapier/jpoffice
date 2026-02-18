import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorRenderer } from '../src/cursor-renderer';
import type { LayoutPage, LayoutParagraph, LayoutLine, LayoutFragment, ResolvedRunStyle } from '@jpoffice/layout';

const defaultStyle: ResolvedRunStyle = {
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
};

function makeFragment(
	text: string,
	runPath: number[],
	runOffset: number,
	x: number,
	width: number,
): LayoutFragment {
	return {
		text,
		rect: { x, y: 0, width, height: 14 },
		runPath,
		runOffset,
		charCount: text.length,
		style: defaultStyle,
	};
}

function makeLine(
	fragments: LayoutFragment[],
	y: number,
	height: number,
	baseline: number,
): LayoutLine {
	const totalWidth = fragments.reduce((s, f) => s + f.rect.width, 0);
	return {
		rect: { x: 0, y, width: totalWidth, height },
		baseline,
		fragments,
		paragraphPath: [0, 0, 0],
		lineIndex: 0,
	};
}

function makeParagraph(lines: LayoutLine[]): LayoutParagraph {
	const lastLine = lines[lines.length - 1];
	const height = lastLine ? lastLine.rect.y + lastLine.rect.height : 0;
	return {
		rect: { x: 0, y: 0, width: 468, height },
		lines,
		nodePath: [0, 0, 0],
	};
}

function makePage(blocks: LayoutParagraph[]): LayoutPage {
	return {
		index: 0,
		width: 612,
		height: 792,
		contentArea: { x: 72, y: 72, width: 468, height: 648 },
		blocks,
	};
}

describe('CursorRenderer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('constructs with defaults', () => {
		const cursor = new CursorRenderer();
		expect(cursor).toBeDefined();
	});

	it('constructs with custom style', () => {
		const cursor = new CursorRenderer({ color: '#ff0000', width: 2, blinkInterval: 1000 });
		expect(cursor).toBeDefined();
	});

	it('findCursorPosition returns position for matching fragment', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const line = makeLine([frag], 0, 16, 12);
		const para = makeParagraph([line]);
		const page = makePage([para]);

		const cursor = new CursorRenderer();
		const pos = cursor.findCursorPosition(page, { path: [0, 0, 0, 0, 0], offset: 0 }, 72, 72);

		expect(pos).not.toBeNull();
		expect(pos!.x).toBe(72); // pageOffsetX + rect.x + 0 ratio
		expect(pos!.y).toBe(72); // pageOffsetY + line.rect.y
		expect(pos!.height).toBe(16);
	});

	it('findCursorPosition returns position at end of text', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const line = makeLine([frag], 0, 16, 12);
		const para = makeParagraph([line]);
		const page = makePage([para]);

		const cursor = new CursorRenderer();
		const pos = cursor.findCursorPosition(page, { path: [0, 0, 0, 0, 0], offset: 5 }, 0, 0);

		expect(pos).not.toBeNull();
		// offset 5 out of 5 chars → ratio 1.0 → x = 0 + 0 + 50 * 1.0 = 50
		expect(pos!.x).toBe(50);
	});

	it('findCursorPosition returns position at middle of text', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 10, 100);
		const line = makeLine([frag], 20, 16, 12);
		const para = makeParagraph([line]);
		const page = makePage([para]);

		const cursor = new CursorRenderer();
		const pos = cursor.findCursorPosition(page, { path: [0, 0, 0, 0, 0], offset: 2 }, 0, 0);

		expect(pos).not.toBeNull();
		// offset 2 out of 5 chars → ratio 0.4 → x = 10 + 100 * 0.4 = 50
		expect(pos!.x).toBe(50);
		expect(pos!.y).toBe(20); // line.rect.y
	});

	it('findCursorPosition returns null for non-matching path', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const line = makeLine([frag], 0, 16, 12);
		const para = makeParagraph([line]);
		const page = makePage([para]);

		const cursor = new CursorRenderer();
		const pos = cursor.findCursorPosition(page, { path: [0, 0, 1, 0, 0], offset: 0 }, 0, 0);

		expect(pos).toBeNull();
	});

	it('findCursorPosition returns null for empty page', () => {
		const page = makePage([]);
		const cursor = new CursorRenderer();
		const pos = cursor.findCursorPosition(page, { path: [0, 0, 0, 0, 0], offset: 0 }, 0, 0);
		expect(pos).toBeNull();
	});

	it('startBlinking calls callback at interval', () => {
		const cursor = new CursorRenderer({ blinkInterval: 500 });
		const callback = vi.fn();

		cursor.startBlinking(callback);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);
		expect(callback).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(500);
		expect(callback).toHaveBeenCalledTimes(2);

		cursor.destroy();
	});

	it('stopBlinking stops callbacks', () => {
		const cursor = new CursorRenderer({ blinkInterval: 500 });
		const callback = vi.fn();

		cursor.startBlinking(callback);
		vi.advanceTimersByTime(500);
		expect(callback).toHaveBeenCalledTimes(1);

		cursor.stopBlinking();
		vi.advanceTimersByTime(1000);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('resetBlink restarts the timer', () => {
		const cursor = new CursorRenderer({ blinkInterval: 500 });
		const callback = vi.fn();

		cursor.startBlinking(callback);
		vi.advanceTimersByTime(300); // Not yet triggered
		cursor.resetBlink();

		// After reset, should wait full 500ms again
		vi.advanceTimersByTime(300);
		expect(callback).toHaveBeenCalledTimes(0);

		vi.advanceTimersByTime(200);
		expect(callback).toHaveBeenCalledTimes(1);

		cursor.destroy();
	});

	it('destroy stops blinking', () => {
		const cursor = new CursorRenderer({ blinkInterval: 500 });
		const callback = vi.fn();

		cursor.startBlinking(callback);
		cursor.destroy();

		vi.advanceTimersByTime(2000);
		expect(callback).not.toHaveBeenCalled();
	});
});
