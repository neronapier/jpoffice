import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SECTION_PROPERTIES,
	EMPTY_NUMBERING_REGISTRY,
	createBody,
	createDocument,
	createParagraph,
	createRun,
	createSection,
	createStyleRegistry,
	createTable,
	createTableCell,
	createTableRow,
	createText,
	generateId,
} from '@jpoffice/model';
import type { JPDocument, JPParagraph, JPRun, JPSection, JPText } from '@jpoffice/model';
import { exportDocx } from '../src/exporter/docx-exporter';
import { importDocx } from '../src/importer/docx-importer';

/** Helper to create a simple document for round-trip testing. */
function makeDoc(
	paragraphs: { text: string; bold?: boolean; italic?: boolean; alignment?: string }[],
): JPDocument {
	const paras = paragraphs.map((p) => {
		const props: Record<string, unknown> = {};
		if (p.bold || p.italic) {
			const runProps: Record<string, unknown> = {};
			if (p.bold) runProps.bold = true;
			if (p.italic) runProps.italic = true;
			return createParagraph(
				generateId(),
				[createRun(generateId(), [createText(generateId(), p.text)], runProps)],
				p.alignment ? { alignment: p.alignment, ...props } : props,
			);
		}
		return createParagraph(
			generateId(),
			[createRun(generateId(), [createText(generateId(), p.text)])],
			p.alignment ? { alignment: p.alignment } : {},
		);
	});

	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), paras, DEFAULT_SECTION_PROPERTIES),
		]),
		styles: createStyleRegistry([]),
		numbering: EMPTY_NUMBERING_REGISTRY,
		metadata: {},
	});
}

/** Extract the plain text from a paragraph. */
function getParaText(para: JPParagraph): string {
	let text = '';
	for (const inline of para.children) {
		if (inline.type === 'run') {
			for (const child of (inline as JPRun).children) {
				if (child.type === 'text') text += (child as JPText).text;
			}
		}
	}
	return text;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Round-trip: export → import', () => {
	it('preserves a single paragraph with text', () => {
		const original = makeDoc([{ text: 'Hello World' }]);
		const docxBytes = exportDocx(original);
		const imported = importDocx(docxBytes);

		const section = imported.children[0].children[0] as JPSection;
		expect(section.children.length).toBeGreaterThanOrEqual(1);

		const para = section.children[0] as JPParagraph;
		expect(getParaText(para)).toBe('Hello World');
	});

	it('preserves multiple paragraphs', () => {
		const original = makeDoc([
			{ text: 'First paragraph' },
			{ text: 'Second paragraph' },
			{ text: 'Third paragraph' },
		]);

		const imported = importDocx(exportDocx(original));
		const section = imported.children[0].children[0] as JPSection;

		expect(section.children).toHaveLength(3);
		expect(getParaText(section.children[0] as JPParagraph)).toBe('First paragraph');
		expect(getParaText(section.children[1] as JPParagraph)).toBe('Second paragraph');
		expect(getParaText(section.children[2] as JPParagraph)).toBe('Third paragraph');
	});

	it('preserves bold formatting', () => {
		const original = makeDoc([{ text: 'Bold text', bold: true }]);
		const imported = importDocx(exportDocx(original));

		const section = imported.children[0].children[0] as JPSection;
		const para = section.children[0] as JPParagraph;
		const run = para.children[0] as JPRun;
		expect(run.properties.bold).toBe(true);
		expect(getParaText(para)).toBe('Bold text');
	});

	it('preserves italic formatting', () => {
		const original = makeDoc([{ text: 'Italic text', italic: true }]);
		const imported = importDocx(exportDocx(original));

		const section = imported.children[0].children[0] as JPSection;
		const para = section.children[0] as JPParagraph;
		const run = para.children[0] as JPRun;
		expect(run.properties.italic).toBe(true);
	});

	it('preserves center alignment', () => {
		const original = makeDoc([{ text: 'Centered', alignment: 'center' }]);
		const imported = importDocx(exportDocx(original));

		const section = imported.children[0].children[0] as JPSection;
		const para = section.children[0] as JPParagraph;
		expect(para.properties.alignment).toBe('center');
	});

	it('preserves justify alignment (both → justify)', () => {
		const original = makeDoc([{ text: 'Justified', alignment: 'justify' }]);
		const imported = importDocx(exportDocx(original));

		const section = imported.children[0].children[0] as JPSection;
		const para = section.children[0] as JPParagraph;
		expect(para.properties.alignment).toBe('justify');
	});

	it('preserves section properties (page size and margins)', () => {
		const doc = createDocument({
			id: generateId(),
			body: createBody(generateId(), [
				createSection(
					generateId(),
					[createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), 'Test')])])],
					{
						pageSize: { width: 12240, height: 15840 },
						margins: {
							top: 1440,
							right: 1800,
							bottom: 1440,
							left: 1800,
							header: 720,
							footer: 720,
							gutter: 0,
						},
						orientation: 'portrait',
					},
				),
			]),
			styles: createStyleRegistry([]),
			numbering: EMPTY_NUMBERING_REGISTRY,
			metadata: {},
		});

		const imported = importDocx(exportDocx(doc));
		const section = imported.children[0].children[0] as JPSection;

		expect(section.properties.pageSize.width).toBe(12240);
		expect(section.properties.pageSize.height).toBe(15840);
		expect(section.properties.margins.right).toBe(1800);
		expect(section.properties.margins.left).toBe(1800);
	});

	it('preserves metadata', () => {
		const doc = createDocument({
			id: generateId(),
			body: createBody(generateId(), [
				createSection(
					generateId(),
					[createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), 'Test')])])],
					DEFAULT_SECTION_PROPERTIES,
				),
			]),
			styles: createStyleRegistry([]),
			numbering: EMPTY_NUMBERING_REGISTRY,
			metadata: {
				title: 'My Document',
				author: 'Test Author',
			},
		});

		const imported = importDocx(exportDocx(doc));
		expect(imported.metadata.title).toBe('My Document');
		expect(imported.metadata.author).toBe('Test Author');
	});

	it('produces valid ZIP bytes', () => {
		const original = makeDoc([{ text: 'ZIP test' }]);
		const bytes = exportDocx(original);

		// ZIP files start with PK\x03\x04
		expect(bytes[0]).toBe(0x50); // P
		expect(bytes[1]).toBe(0x4b); // K
		expect(bytes[2]).toBe(0x03);
		expect(bytes[3]).toBe(0x04);
	});

	it('round-trips a table', () => {
		const doc = createDocument({
			id: generateId(),
			body: createBody(generateId(), [
				createSection(
					generateId(),
					[
						createTable(generateId(), [
							createTableRow(generateId(), [
								createTableCell(generateId(), [
									createParagraph(generateId(), [
										createRun(generateId(), [createText(generateId(), 'A1')]),
									]),
								]),
								createTableCell(generateId(), [
									createParagraph(generateId(), [
										createRun(generateId(), [createText(generateId(), 'B1')]),
									]),
								]),
							]),
						]),
					],
					DEFAULT_SECTION_PROPERTIES,
				),
			]),
			styles: createStyleRegistry([]),
			numbering: EMPTY_NUMBERING_REGISTRY,
			metadata: {},
		});

		const imported = importDocx(exportDocx(doc));
		const section = imported.children[0].children[0] as JPSection;

		const table = section.children[0];
		expect(table.type).toBe('table');
		expect(table.children).toHaveLength(1); // 1 row
		expect(table.children[0].children).toHaveLength(2); // 2 cells

		const cell1Para = table.children[0].children[0].children[0] as JPParagraph;
		expect(getParaText(cell1Para)).toBe('A1');

		const cell2Para = table.children[0].children[1].children[0] as JPParagraph;
		expect(getParaText(cell2Para)).toBe('B1');
	});

	it('round-trips run properties (fontSize, color, fontFamily)', () => {
		const doc = createDocument({
			id: generateId(),
			body: createBody(generateId(), [
				createSection(
					generateId(),
					[
						createParagraph(generateId(), [
							createRun(
								generateId(),
								[createText(generateId(), 'Styled')],
								{ fontSize: 28, color: 'FF0000', fontFamily: 'Arial' },
							),
						]),
					],
					DEFAULT_SECTION_PROPERTIES,
				),
			]),
			styles: createStyleRegistry([]),
			numbering: EMPTY_NUMBERING_REGISTRY,
			metadata: {},
		});

		const imported = importDocx(exportDocx(doc));
		const section = imported.children[0].children[0] as JPSection;
		const para = section.children[0] as JPParagraph;
		const run = para.children[0] as JPRun;

		expect(run.properties.fontSize).toBe(28);
		expect(run.properties.color).toBe('FF0000');
		expect(run.properties.fontFamily).toBe('Arial');
	});

	it('double round-trip preserves content', () => {
		const original = makeDoc([
			{ text: 'First', bold: true },
			{ text: 'Second', italic: true, alignment: 'center' },
		]);

		// Export → Import → Export → Import
		const round1 = importDocx(exportDocx(original));
		const round2 = importDocx(exportDocx(round1));

		const section = round2.children[0].children[0] as JPSection;
		expect(section.children).toHaveLength(2);

		const para1 = section.children[0] as JPParagraph;
		expect(getParaText(para1)).toBe('First');
		expect((para1.children[0] as JPRun).properties.bold).toBe(true);

		const para2 = section.children[1] as JPParagraph;
		expect(getParaText(para2)).toBe('Second');
		expect((para2.children[0] as JPRun).properties.italic).toBe(true);
		expect(para2.properties.alignment).toBe('center');
	});
});
