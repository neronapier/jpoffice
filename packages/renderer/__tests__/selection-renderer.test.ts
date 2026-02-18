import { describe, it, expect, vi } from 'vitest';
import { SelectionRenderer } from '../src/selection-renderer';
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
	return {
		rect: { x: 0, y, width: 468, height },
		baseline: height * 0.75,
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

function mockCtx() {
	const calls: Array<{ method: string; args: unknown[] }> = [];
	return {
		calls,
		ctx: {
			save: vi.fn(() => calls.push({ method: 'save', args: [] })),
			restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
			fillRect: vi.fn((...args: unknown[]) => calls.push({ method: 'fillRect', args })),
			fillStyle: '',
		} as unknown as CanvasRenderingContext2D,
	};
}

describe('SelectionRenderer', () => {
	it('constructs with defaults', () => {
		const renderer = new SelectionRenderer();
		expect(renderer).toBeDefined();
	});

	it('constructs with custom color', () => {
		const renderer = new SelectionRenderer({ color: 'rgba(255,0,0,0.5)' });
		expect(renderer).toBeDefined();
	});

	it('does not render for null selection', () => {
		const renderer = new SelectionRenderer();
		const { ctx, calls } = mockCtx();
		const page = makePage([]);

		renderer.renderSelection(ctx, page, null, 0, 0);
		const fillRects = calls.filter((c) => c.method === 'fillRect');
		expect(fillRects).toHaveLength(0);
	});

	it('does not render for collapsed selection', () => {
		const frag = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line]);
		const page = makePage([para]);
		const { ctx, calls } = mockCtx();

		const renderer = new SelectionRenderer();
		renderer.renderSelection(
			ctx,
			page,
			{
				anchor: { path: [0, 0, 0, 0, 0], offset: 3 },
				focus: { path: [0, 0, 0, 0, 0], offset: 3 },
			},
			0,
			0,
		);

		const fillRects = calls.filter((c) => c.method === 'fillRect');
		expect(fillRects).toHaveLength(0);
	});

	it('renders highlight for range selection', () => {
		const frag = makeFragment('Hello World', [0, 0, 0, 0, 0], 0, 0, 110);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line]);
		const page = makePage([para]);
		const { ctx, calls } = mockCtx();

		const renderer = new SelectionRenderer();
		renderer.renderSelection(
			ctx,
			page,
			{
				anchor: { path: [0, 0, 0, 0, 0], offset: 0 },
				focus: { path: [0, 0, 0, 0, 0], offset: 5 },
			},
			0,
			0,
		);

		const fillRects = calls.filter((c) => c.method === 'fillRect');
		expect(fillRects.length).toBeGreaterThan(0);
	});

	it('handles backward selection (focus before anchor)', () => {
		const frag = makeFragment('Hello World', [0, 0, 0, 0, 0], 0, 0, 110);
		const line = makeLine([frag], 0, 16);
		const para = makeParagraph([line]);
		const page = makePage([para]);
		const { ctx, calls } = mockCtx();

		const renderer = new SelectionRenderer();
		// Backward: anchor at 5, focus at 0
		renderer.renderSelection(
			ctx,
			page,
			{
				anchor: { path: [0, 0, 0, 0, 0], offset: 5 },
				focus: { path: [0, 0, 0, 0, 0], offset: 0 },
			},
			0,
			0,
		);

		const fillRects = calls.filter((c) => c.method === 'fillRect');
		expect(fillRects.length).toBeGreaterThan(0);
	});

	it('does not highlight fragments outside selection', () => {
		// Two fragments with different paths
		const frag1 = makeFragment('Hello', [0, 0, 0, 0, 0], 0, 0, 50);
		const frag2 = makeFragment('World', [0, 0, 1, 0, 0], 0, 50, 50);
		const line = makeLine([frag1, frag2], 0, 16);
		const para = makeParagraph([line]);
		const page = makePage([para]);
		const { ctx, calls } = mockCtx();

		const renderer = new SelectionRenderer();
		// Select only in the first fragment
		renderer.renderSelection(
			ctx,
			page,
			{
				anchor: { path: [0, 0, 0, 0, 0], offset: 0 },
				focus: { path: [0, 0, 0, 0, 0], offset: 5 },
			},
			0,
			0,
		);

		const fillRects = calls.filter((c) => c.method === 'fillRect');
		// Should only have 1 fillRect (for the first fragment)
		expect(fillRects).toHaveLength(1);
	});
});
