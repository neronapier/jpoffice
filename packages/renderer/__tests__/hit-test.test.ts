import { describe, it, expect } from 'vitest';
import { HitTester } from '../src/hit-test';
import { PageRenderer } from '../src/page-renderer';
import type {
	LayoutPage,
	LayoutParagraph,
	LayoutLine,
	LayoutFragment,
	ResolvedRunStyle,
} from '@jpoffice/layout';

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

function makeLine(fragments: LayoutFragment[], y: number, height: number): LayoutLine {
	const totalWidth = fragments.reduce((s, f) => s + f.rect.width, 0);
	return {
		rect: { x: 0, y, width: totalWidth, height },
		baseline: height * 0.75,
		fragments,
		paragraphPath: [0, 0, 0],
		lineIndex: 0,
	};
}

function makeParagraph(
	lines: LayoutLine[],
	x: number,
	y: number,
	width: number,
): LayoutParagraph {
	const lastLine = lines[lines.length - 1];
	const height = lastLine ? lastLine.rect.y + lastLine.rect.height : 0;
	return {
		rect: { x, y, width, height },
		lines,
		nodePath: [0, 0, 0],
	};
}

function makePage(blocks: LayoutParagraph[], width = 612, height = 792): LayoutPage {
	return {
		index: 0,
		width,
		height,
		contentArea: { x: 72, y: 72, width: width - 144, height: height - 144 },
		blocks,
	};
}

describe('HitTester', () => {
	const pageRenderer = new PageRenderer({ pageGap: 20 });
	const hitTester = new HitTester(pageRenderer);

	it('returns null for empty pages', () => {
		const result = hitTester.hitTest(100, 100, [], 800);
		expect(result).toBeNull();
	});

	it('hits text fragment within page', () => {
		// Paragraph rect at (0,0) — hit-test uses page-local coords (no content area offset)
		const frag = makeFragment('Hello World', [0, 0, 0, 0, 0], 0, 0, 110);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page = makePage([para]);

		const canvasWidth = 800;
		const pageX = (canvasWidth - page.width) / 2; // centered
		const pageY = 20; // first page at gap offset

		// Page-local (5, 8) within paragraph rect (0,0,468,16)
		const clickX = pageX + 5;
		const clickY = pageY + 8;

		const result = hitTester.hitTest(clickX, clickY, [page], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.pageIndex).toBe(0);
		expect(result!.point.path).toEqual([0, 0, 0, 0, 0]);
		expect(result!.point.offset).toBeGreaterThanOrEqual(0);
	});

	it('snaps to end of line when clicking past text', () => {
		const frag = makeFragment('Hi', [0, 0, 0, 0, 0], 0, 0, 20);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page = makePage([para]);

		const canvasWidth = 800;
		const pageX = (canvasWidth - page.width) / 2;
		const pageY = 20;

		// Click far right, past the 20px-wide fragment, but within para rect
		const clickX = pageX + 400;
		const clickY = pageY + 8;

		const result = hitTester.hitTest(clickX, clickY, [page], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.point.path).toEqual([0, 0, 0, 0, 0]);
		expect(result!.point.offset).toBe(2); // end of "Hi"
	});

	it('snaps to start of line when clicking before text', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 50, 50);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page = makePage([para]);

		const canvasWidth = 800;
		const pageX = (canvasWidth - page.width) / 2;
		const pageY = 20;

		// Click at page-local x=5, which is before fragment at x=50
		const clickX = pageX + 5;
		const clickY = pageY + 8;

		const result = hitTester.hitTest(clickX, clickY, [page], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.point.offset).toBe(0); // snaps to start of first fragment
	});

	it('finds closest page when clicking between pages', () => {
		const frag = makeFragment('A', [0, 0, 0, 0, 0], 0, 0, 10);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page1 = makePage([para], 612, 100);
		const page2 = makePage([para], 612, 100);

		const canvasWidth = 800;

		// Click in the gap between pages
		// Page 1 at Y=20, height=100 → ends at 120
		// Page 2 at Y=140 (20 + 100 + 20)
		const clickX = (canvasWidth - 612) / 2 + 5;
		const clickY = 125; // in the gap, closer to page 1

		const result = hitTester.hitTest(clickX, clickY, [page1, page2], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.pageIndex).toBeLessThanOrEqual(1);
	});

	it('hits second page correctly', () => {
		const frag1 = makeFragment('First', [0, 0, 0, 0, 0], 0, 0, 50);
		const line1 = makeLine([frag1], 0, 16);
		const para1 = makeParagraph([line1], 0, 0, 468);

		const frag2 = makeFragment('Second', [0, 0, 1, 0, 0], 0, 0, 60);
		const line2 = makeLine([frag2], 0, 16);
		const para2 = makeParagraph([line2], 0, 0, 468);

		const page1 = makePage([para1], 612, 100);
		const page2: LayoutPage = {
			index: 1,
			width: 612,
			height: 100,
			contentArea: { x: 72, y: 72, width: 468, height: -44 },
			blocks: [para2],
		};

		const canvasWidth = 800;
		const pageX = (canvasWidth - 612) / 2;
		// Page 2 starts at Y = 20 + 100 + 20 = 140
		const page2Y = 140;

		// Page-local (30, 8) within paragraph rect (0,0,60,16)
		const clickX = pageX + 30;
		const clickY = page2Y + 8;

		const result = hitTester.hitTest(clickX, clickY, [page1, page2], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.pageIndex).toBe(1);
		expect(result!.point.path).toEqual([0, 0, 1, 0, 0]);
	});

	it('calculates character offset within fragment', () => {
		// Fragment "Hello" at x=0, width=100 (20px per char)
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 100);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page = makePage([para]);

		const canvasWidth = 800;
		const pageX = (canvasWidth - page.width) / 2;
		const pageY = 20;

		// Page-local x=60 into the 100px fragment, charWidth = 100/5 = 20
		// Math.round(60/20) = 3
		const clickX = pageX + 60;
		const clickY = pageY + 8;

		const result = hitTester.hitTest(clickX, clickY, [page], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.point.offset).toBe(3);
	});

	it('handles multiple fragments on one line', () => {
		const frag1 = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const frag2 = makeFragment(' World', [0, 0, 0, 0, 0], 5, 50, 60);
		const line = makeLine([frag1, frag2], 0, 16);
		const para = makeParagraph([line], 0, 0, 468);
		const page = makePage([para]);

		const canvasWidth = 800;
		const pageX = (canvasWidth - page.width) / 2;
		const pageY = 20;

		// Page-local x=70, which is within frag2 (x=50, width=60)
		// relativeX = 70 - 50 = 20, charWidth = 60/6 = 10
		// charOffset = Math.round(20/10) = 2, offset = 5 + 2 = 7
		const clickX = pageX + 70;
		const clickY = pageY + 8;

		const result = hitTester.hitTest(clickX, clickY, [page], canvasWidth);
		expect(result).not.toBeNull();
		expect(result!.point.path).toEqual([0, 0, 0, 0, 0]);
		expect(result!.point.offset).toBe(7);
	});
});
