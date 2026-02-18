import { describe, it, expect } from 'vitest';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	createTable,
	createTableRow,
	createTableCell,
	generateId,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';
import { LayoutEngine } from '../src/layout-engine';
import { isLayoutParagraph, isLayoutTable } from '../src/types';

function makeParagraph(text: string, properties = {}) {
	return createParagraph(
		generateId(),
		[createRun(generateId(), [createText(generateId(), text)])],
		properties,
	);
}

function makeEmptyParagraph(properties = {}) {
	return createParagraph(generateId(), [], properties);
}

function makeDocument(paragraphs: ReturnType<typeof makeParagraph>[]) {
	const section = createSection(generateId(), paragraphs, DEFAULT_SECTION_PROPERTIES);
	const body = createBody(generateId(), [section]);
	return createDocument({ id: generateId(), body });
}

describe('LayoutEngine', () => {
	it('creates an instance', () => {
		const engine = new LayoutEngine();
		expect(engine).toBeDefined();
	});

	it('returns a layout result with at least one page', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		expect(result.pages.length).toBeGreaterThanOrEqual(1);
		expect(result.version).toBe(1);
	});

	it('produces an empty page for empty document', () => {
		const section = createSection(generateId(), [], DEFAULT_SECTION_PROPERTIES);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({ id: generateId(), body });

		const engine = new LayoutEngine();
		const result = engine.layout(doc);
		expect(result.pages).toHaveLength(1);
	});

	it('increments version on each layout call', () => {
		const doc = makeDocument([makeParagraph('Test')]);
		const engine = new LayoutEngine();

		const r1 = engine.layout(doc);
		const r2 = engine.layout(doc);
		expect(r2.version).toBe(r1.version + 1);
	});

	it('page has correct dimensions from section properties', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const page = result.pages[0];
		// A4: 11906 twips width, 16838 twips height (from DEFAULT_SECTION_PROPERTIES)
		expect(page.width).toBeGreaterThan(0);
		expect(page.height).toBeGreaterThan(0);
		expect(page.contentArea.x).toBeGreaterThan(0); // margins
		expect(page.contentArea.y).toBeGreaterThan(0);
	});

	it('lays out a single paragraph with fragments', () => {
		const doc = makeDocument([makeParagraph('Hello World')]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const blocks = result.pages[0].blocks;
		expect(blocks.length).toBeGreaterThanOrEqual(1);

		const firstBlock = blocks[0];
		expect(isLayoutParagraph(firstBlock)).toBe(true);
		if (isLayoutParagraph(firstBlock)) {
			expect(firstBlock.lines.length).toBeGreaterThanOrEqual(1);
			expect(firstBlock.rect.width).toBeGreaterThan(0);
			expect(firstBlock.rect.height).toBeGreaterThan(0);
		}
	});

	it('lays out multiple paragraphs stacked vertically', () => {
		const doc = makeDocument([
			makeParagraph('First paragraph'),
			makeParagraph('Second paragraph'),
			makeParagraph('Third paragraph'),
		]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const blocks = result.pages[0].blocks;
		expect(blocks.length).toBeGreaterThanOrEqual(3);

		// Each paragraph should be below the previous
		for (let i = 1; i < blocks.length; i++) {
			const prev = blocks[i - 1];
			const curr = blocks[i];
			if (isLayoutParagraph(prev) && isLayoutParagraph(curr)) {
				expect(curr.rect.y).toBeGreaterThanOrEqual(prev.rect.y + prev.rect.height);
			}
		}
	});

	it('lays out empty paragraphs with non-zero height', () => {
		const doc = makeDocument([makeEmptyParagraph()]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const blocks = result.pages[0].blocks;
		expect(blocks.length).toBeGreaterThanOrEqual(1);
		if (isLayoutParagraph(blocks[0])) {
			expect(blocks[0].rect.height).toBeGreaterThan(0);
		}
	});

	it('lays out a table', () => {
		const cell1 = createTableCell(generateId(), [makeParagraph('A')], {});
		const cell2 = createTableCell(generateId(), [makeParagraph('B')], {});
		const row = createTableRow(generateId(), [cell1, cell2], {});
		const table = createTable(generateId(), [row], {}, [{ width: 3000 }, { width: 3000 }]);

		const section = createSection(
			generateId(),
			[table],
			DEFAULT_SECTION_PROPERTIES,
		);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({ id: generateId(), body });

		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const blocks = result.pages[0].blocks;
		expect(blocks.length).toBeGreaterThanOrEqual(1);

		const tableBlock = blocks[0];
		expect(isLayoutTable(tableBlock)).toBe(true);
		if (isLayoutTable(tableBlock)) {
			expect(tableBlock.rows).toHaveLength(1);
			expect(tableBlock.rows[0].cells).toHaveLength(2);
		}
	});

	it('handles mixed paragraphs and tables', () => {
		const para1 = makeParagraph('Before table');
		const cell = createTableCell(generateId(), [makeParagraph('Cell')], {});
		const row = createTableRow(generateId(), [cell], {});
		const table = createTable(generateId(), [row], {}, [{ width: 5000 }]);
		const para2 = makeParagraph('After table');

		const section = createSection(
			generateId(),
			[para1, table, para2],
			DEFAULT_SECTION_PROPERTIES,
		);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({ id: generateId(), body });

		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const blocks = result.pages[0].blocks;
		expect(blocks.length).toBeGreaterThanOrEqual(3);
		expect(isLayoutParagraph(blocks[0])).toBe(true);
		expect(isLayoutTable(blocks[1])).toBe(true);
		expect(isLayoutParagraph(blocks[2])).toBe(true);
	});

	it('getMeasurer returns the text measurer', () => {
		const engine = new LayoutEngine();
		expect(engine.getMeasurer()).toBeDefined();
	});

	it('getCache returns null when no cache provided', () => {
		const engine = new LayoutEngine();
		expect(engine.getCache()).toBeNull();
	});

	it('handles pageBreakBefore property', () => {
		const doc = makeDocument([
			makeParagraph('Page 1 content'),
			makeParagraph('Page 2 content', { pageBreakBefore: true }),
		]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		// Should create at least 2 pages
		expect(result.pages.length).toBeGreaterThanOrEqual(2);
	});

	it('all fragments have valid coordinates', () => {
		const doc = makeDocument([
			makeParagraph('Some text here'),
			makeParagraph('More text to test'),
		]);
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		for (const page of result.pages) {
			for (const block of page.blocks) {
				if (isLayoutParagraph(block)) {
					for (const line of block.lines) {
						expect(line.rect.x).toBeGreaterThanOrEqual(0);
						expect(line.rect.y).toBeGreaterThanOrEqual(0);
						expect(line.rect.width).toBeGreaterThan(0);
						expect(line.rect.height).toBeGreaterThan(0);
						for (const frag of line.fragments) {
							expect(frag.rect.x).toBeGreaterThanOrEqual(0);
							expect(frag.rect.y).toBeGreaterThanOrEqual(0);
							expect(frag.rect.width).toBeGreaterThan(0);
							expect(frag.rect.height).toBeGreaterThan(0);
						}
					}
				}
			}
		}
	});
});
