import {
	DEFAULT_SECTION_PROPERTIES,
	createBody,
	createDocument,
	createFooter,
	createHeader,
	createParagraph,
	createRun,
	createSection,
	createTable,
	createTableCell,
	createTableRow,
	createText,
	generateId,
} from '@jpoffice/model';
import type { JPParagraph, JPRunProperties, JPSectionProperties } from '@jpoffice/model';
import { describe, expect, it } from 'vitest';
import { exportDoc } from '../src/rtf/rtf-exporter';
import { buildRunFormatting } from '../src/rtf/rtf-run';
import { RtfWriter, escapeRtf, parseHexColor } from '../src/rtf/rtf-writer';

function makeParagraph(text: string, props: Partial<JPParagraph['properties']> = {}): JPParagraph {
	return createParagraph(
		generateId(),
		[createRun(generateId(), [createText(generateId(), text)])],
		props,
	);
}

function makeDoc(paragraphs: JPParagraph[]) {
	const section = createSection(generateId(), paragraphs, DEFAULT_SECTION_PROPERTIES);
	const body = createBody(generateId(), [section]);
	return createDocument({ id: generateId(), body });
}

describe('RtfWriter', () => {
	it('builds a minimal RTF document', () => {
		const writer = new RtfWriter();
		writer.addFont('Arial');
		const rtf = writer.build();

		expect(rtf).toContain('{\\rtf1\\ansi');
		expect(rtf).toContain('{\\fonttbl');
		expect(rtf).toContain('Arial');
		expect(rtf).toContain('{\\colortbl ;');
		expect(rtf.endsWith('}')).toBe(true);
	});

	it('registers fonts and returns indices', () => {
		const writer = new RtfWriter();
		const i0 = writer.addFont('Calibri');
		const i1 = writer.addFont('Arial');
		const i0b = writer.addFont('Calibri');

		expect(i0).toBe(0);
		expect(i1).toBe(1);
		expect(i0b).toBe(0); // same font returns same index
	});

	it('registers colors and returns 1-based indices', () => {
		const writer = new RtfWriter();
		const c1 = writer.addColor('FF0000');
		const c2 = writer.addColor('#00FF00');
		const c1b = writer.addColor('#FF0000');

		expect(c1).toBe(1);
		expect(c2).toBe(2);
		expect(c1b).toBe(1); // deduplication
	});

	it('includes color table in output', () => {
		const writer = new RtfWriter();
		writer.addColor('FF0000');
		const rtf = writer.build();

		expect(rtf).toContain('\\red255\\green0\\blue0;');
	});

	it('includes document info', () => {
		const writer = new RtfWriter();
		writer.setInfo('{\\title Test Doc}');
		const rtf = writer.build();

		expect(rtf).toContain('{\\info{\\title Test Doc}}');
	});
});

describe('parseHexColor', () => {
	it('parses 6-digit hex', () => {
		expect(parseHexColor('FF8000')).toEqual({ r: 255, g: 128, b: 0 });
	});

	it('parses 3-digit hex', () => {
		expect(parseHexColor('F00')).toEqual({ r: 255, g: 0, b: 0 });
	});

	it('handles # prefix', () => {
		expect(parseHexColor('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
	});
});

describe('escapeRtf', () => {
	it('escapes backslash, braces', () => {
		expect(escapeRtf('a\\b{c}d')).toBe('a\\\\b\\{c\\}d');
	});

	it('escapes unicode characters', () => {
		const result = escapeRtf('\u00e9'); // é
		expect(result).toContain('\\u233?');
	});

	it('leaves ASCII unchanged', () => {
		expect(escapeRtf('Hello World')).toBe('Hello World');
	});
});

describe('buildRunFormatting', () => {
	it('returns empty string for no formatting', () => {
		const writer = new RtfWriter();
		expect(buildRunFormatting({}, writer)).toBe('');
	});

	it('includes bold and italic', () => {
		const writer = new RtfWriter();
		const result = buildRunFormatting({ bold: true, italic: true } as JPRunProperties, writer);
		expect(result).toContain('\\b');
		expect(result).toContain('\\i');
	});

	it('includes font size', () => {
		const writer = new RtfWriter();
		const result = buildRunFormatting({ fontSize: 24 } as JPRunProperties, writer);
		expect(result).toContain('\\fs24');
	});

	it('includes underline', () => {
		const writer = new RtfWriter();
		const result = buildRunFormatting({ underline: 'single' } as JPRunProperties, writer);
		expect(result).toContain('\\ul');
	});

	it('includes color reference', () => {
		const writer = new RtfWriter();
		const result = buildRunFormatting({ color: 'FF0000' } as JPRunProperties, writer);
		expect(result).toContain('\\cf1');
	});
});

describe('exportDoc', () => {
	it('exports a simple document to RTF bytes', () => {
		const doc = makeDoc([makeParagraph('Hello World')]);
		const bytes = exportDoc(doc);

		const text = new TextDecoder().decode(bytes);
		expect(text).toContain('{\\rtf1\\ansi');
		expect(text).toContain('Hello World');
		expect(text).toContain('\\par');
	});

	it('exports multiple paragraphs', () => {
		const doc = makeDoc([makeParagraph('First'), makeParagraph('Second')]);
		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		expect(text).toContain('First');
		expect(text).toContain('Second');
	});

	it('includes document metadata', () => {
		const section = createSection(
			generateId(),
			[makeParagraph('Content')],
			DEFAULT_SECTION_PROPERTIES,
		);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({
			id: generateId(),
			body,
			metadata: { title: 'My Doc', author: 'Test Author' },
		});

		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		expect(text).toContain('{\\title My Doc}');
		expect(text).toContain('{\\author Test Author}');
	});

	it('includes section page dimensions', () => {
		const doc = makeDoc([makeParagraph('Content')]);
		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		// A4: 11906 x 16838
		expect(text).toContain('\\pgwsxn11906');
		expect(text).toContain('\\pghsxn16838');
	});

	it('exports paragraph alignment', () => {
		const doc = makeDoc([makeParagraph('Centered', { alignment: 'center' })]);
		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		expect(text).toContain('\\qc');
	});

	it('exports a table', () => {
		const cell1 = createTableCell(generateId(), [makeParagraph('A')], {});
		const cell2 = createTableCell(generateId(), [makeParagraph('B')], {});
		const row = createTableRow(generateId(), [cell1, cell2], {});
		const table = createTable(generateId(), [row], {}, [{ width: 3000 }, { width: 3000 }]);

		const section = createSection(generateId(), [table], DEFAULT_SECTION_PROPERTIES);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({ id: generateId(), body });

		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		expect(text).toContain('\\trowd');
		expect(text).toContain('\\cell');
		expect(text).toContain('\\row');
		expect(text).toContain('A');
		expect(text).toContain('B');
	});

	it('exports headers and footers', () => {
		const headerId = generateId();
		const footerId = generateId();
		const headerNode = createHeader(headerId, [makeParagraph('Header Text')]);
		const footerNode = createFooter(footerId, [makeParagraph('Footer Text')]);

		const sectionProps: JPSectionProperties = {
			...DEFAULT_SECTION_PROPERTIES,
			headerReferences: [{ type: 'default', id: headerId }],
			footerReferences: [{ type: 'default', id: footerId }],
		};

		const section = createSection(generateId(), [makeParagraph('Body')], sectionProps);
		const body = createBody(generateId(), [section]);
		const doc = createDocument({
			id: generateId(),
			body,
			headers: new Map([[headerId, headerNode]]),
			footers: new Map([[footerId, footerNode]]),
		});

		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		expect(text).toContain('{\\header ');
		expect(text).toContain('Header Text');
		expect(text).toContain('{\\footer ');
		expect(text).toContain('Footer Text');
	});

	it('produces valid RTF structure', () => {
		const doc = makeDoc([makeParagraph('Test')]);
		const bytes = exportDoc(doc);
		const text = new TextDecoder().decode(bytes);

		// Should start with {\\rtf1 and end with }
		expect(text.startsWith('{\\rtf1')).toBe(true);
		expect(text.endsWith('}')).toBe(true);

		// Braces should be balanced (simple check)
		let depth = 0;
		for (const ch of text) {
			if (ch === '{') depth++;
			else if (ch === '}') depth--;
			expect(depth).toBeGreaterThanOrEqual(0);
		}
		expect(depth).toBe(0);
	});
});
