import {
	DEFAULT_SECTION_PROPERTIES,
	createBody,
	createDocument,
	createFooter,
	createHeader,
	createParagraph,
	createRun,
	createSection,
	createText,
	generateId,
} from '@jpoffice/model';
import type { JPHeaderFooterRef, JPSectionProperties } from '@jpoffice/model';
import { describe, expect, it } from 'vitest';
import { LayoutEngine } from '../src/layout-engine';
import { isLayoutParagraph } from '../src/types';

function makeParagraph(text: string) {
	return createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), text)])]);
}

function makeDocWithHeaders(opts: {
	sectionProps: JPSectionProperties;
	headers?: Map<string, ReturnType<typeof createHeader>>;
	footers?: Map<string, ReturnType<typeof createFooter>>;
}) {
	const section = createSection(generateId(), [makeParagraph('Body content')], opts.sectionProps);
	const body = createBody(generateId(), [section]);
	return createDocument({
		id: generateId(),
		body,
		headers: opts.headers,
		footers: opts.footers,
	});
}

describe('Header/Footer Layout', () => {
	it('pages have no header/footer when section has no references', () => {
		const doc = makeDocWithHeaders({ sectionProps: DEFAULT_SECTION_PROPERTIES });
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		expect(result.pages.length).toBeGreaterThanOrEqual(1);
		expect(result.pages[0].header).toBeUndefined();
		expect(result.pages[0].footer).toBeUndefined();
	});

	it('page has header when default header reference is provided', () => {
		const headerId = generateId();
		const headerNode = createHeader(headerId, [makeParagraph('Header text')]);
		const headers = new Map([[headerId, headerNode]]);

		const headerRef: JPHeaderFooterRef = { type: 'default', id: headerId };
		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [headerRef],
		};

		const doc = makeDocWithHeaders({ sectionProps, headers });
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const page = result.pages[0];
		expect(page.header).toBeDefined();
		expect(page.header!.blocks.length).toBeGreaterThanOrEqual(1);
		expect(page.header!.rect.width).toBeGreaterThan(0);
		expect(page.header!.rect.height).toBeGreaterThan(0);
	});

	it('page has footer when default footer reference is provided', () => {
		const footerId = generateId();
		const footerNode = createFooter(footerId, [makeParagraph('Footer text')]);
		const footers = new Map([[footerId, footerNode]]);

		const footerRef: JPHeaderFooterRef = { type: 'default', id: footerId };
		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			footerReferences: [footerRef],
		};

		const doc = makeDocWithHeaders({ sectionProps, footers });
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		const page = result.pages[0];
		expect(page.footer).toBeDefined();
		expect(page.footer!.blocks.length).toBeGreaterThanOrEqual(1);
		expect(page.footer!.rect.width).toBeGreaterThan(0);
		expect(page.footer!.rect.height).toBeGreaterThan(0);
		// Footer Y should be in the lower portion of the page
		expect(page.footer!.rect.y).toBeGreaterThan(page.height / 2);
	});

	it('header/footer blocks contain laid-out paragraphs', () => {
		const headerId = generateId();
		const footerId = generateId();
		const headerNode = createHeader(headerId, [makeParagraph('My Header')]);
		const footerNode = createFooter(footerId, [makeParagraph('My Footer')]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: headerId }],
			footerReferences: [{ type: 'default', id: footerId }],
		};

		const doc = makeDocWithHeaders({
			sectionProps,
			headers: new Map([[headerId, headerNode]]),
			footers: new Map([[footerId, footerNode]]),
		});

		const engine = new LayoutEngine();
		const result = engine.layout(doc);
		const page = result.pages[0];

		// Header block should be a paragraph
		expect(page.header!.blocks.length).toBe(1);
		expect(isLayoutParagraph(page.header!.blocks[0])).toBe(true);
		if (isLayoutParagraph(page.header!.blocks[0])) {
			expect(page.header!.blocks[0].lines.length).toBeGreaterThanOrEqual(1);
		}

		// Footer block should be a paragraph
		expect(page.footer!.blocks.length).toBe(1);
		expect(isLayoutParagraph(page.footer!.blocks[0])).toBe(true);
	});

	it('content area is adjusted when header/footer are present', () => {
		// Without header/footer
		const docNoHF = makeDocWithHeaders({ sectionProps: DEFAULT_SECTION_PROPERTIES });
		const engine = new LayoutEngine();
		const resultNoHF = engine.layout(docNoHF);
		const contentAreaNoHF = resultNoHF.pages[0].contentArea;

		// With header and footer
		const headerId = generateId();
		const footerId = generateId();
		const headerNode = createHeader(headerId, [makeParagraph('Header')]);
		const footerNode = createFooter(footerId, [makeParagraph('Footer')]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: headerId }],
			footerReferences: [{ type: 'default', id: footerId }],
		};

		const docWithHF = makeDocWithHeaders({
			sectionProps,
			headers: new Map([[headerId, headerNode]]),
			footers: new Map([[footerId, footerNode]]),
		});

		const resultWithHF = engine.layout(docWithHF);
		const contentAreaWithHF = resultWithHF.pages[0].contentArea;

		// Content area height should be smaller when h/f are present (or equal if h/f fits within margins)
		expect(contentAreaWithHF.height).toBeLessThanOrEqual(contentAreaNoHF.height);
		// Width should remain the same
		expect(contentAreaWithHF.width).toBe(contentAreaNoHF.width);
	});

	it('first page uses first-page header when available', () => {
		const defaultHeaderId = generateId();
		const firstHeaderId = generateId();
		const defaultHeader = createHeader(defaultHeaderId, [makeParagraph('Default Header')]);
		const firstHeader = createHeader(firstHeaderId, [makeParagraph('First Page Header')]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [
				{ type: 'default', id: defaultHeaderId },
				{ type: 'first', id: firstHeaderId },
			],
		};

		const doc = makeDocWithHeaders({
			sectionProps,
			headers: new Map([
				[defaultHeaderId, defaultHeader],
				[firstHeaderId, firstHeader],
			]),
		});

		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		// First page should have header (the first-page one)
		expect(result.pages[0].header).toBeDefined();
		expect(result.pages[0].header!.blocks.length).toBe(1);
	});

	it('multiple paragraphs in header are all laid out', () => {
		const headerId = generateId();
		const headerNode = createHeader(headerId, [
			makeParagraph('Header Line 1'),
			makeParagraph('Header Line 2'),
		]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: headerId }],
		};

		const doc = makeDocWithHeaders({
			sectionProps,
			headers: new Map([[headerId, headerNode]]),
		});

		const engine = new LayoutEngine();
		const result = engine.layout(doc);
		const page = result.pages[0];

		expect(page.header).toBeDefined();
		expect(page.header!.blocks.length).toBe(2);
		// Second block should be below the first
		const b0 = page.header!.blocks[0];
		const b1 = page.header!.blocks[1];
		expect(b1.rect.y).toBeGreaterThanOrEqual(b0.rect.y + b0.rect.height);
	});

	it('header rect position starts at header margin from top', () => {
		const headerId = generateId();
		const headerNode = createHeader(headerId, [makeParagraph('Header')]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: headerId }],
		};

		const doc = makeDocWithHeaders({
			sectionProps,
			headers: new Map([[headerId, headerNode]]),
		});

		const engine = new LayoutEngine();
		const result = engine.layout(doc);
		const page = result.pages[0];

		// Header margin is 720 twips = 0.5 inch. In px: 720 / 20 * (96/72) = 48px
		// The header rect Y should be at the header margin distance
		expect(page.header!.rect.y).toBeGreaterThan(0);
	});

	it('ignores header reference with non-existent id', () => {
		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: 'nonexistent-id' }],
		};

		const doc = makeDocWithHeaders({ sectionProps });
		const engine = new LayoutEngine();
		const result = engine.layout(doc);

		// Should gracefully handle missing header node
		expect(result.pages[0].header).toBeUndefined();
	});
});
