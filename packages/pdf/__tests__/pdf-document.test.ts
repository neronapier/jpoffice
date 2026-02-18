import { describe, it, expect } from 'vitest';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';
import { LayoutEngine } from '@jpoffice/layout';
import { PdfDocument } from '../src/pdf-document';
import { exportToPdf } from '../src/index';

const DECODER = new TextDecoder();

function makeParagraph(text: string) {
	return createParagraph(
		generateId(),
		[createRun(generateId(), [createText(generateId(), text)])],
	);
}

function makeDocument(paragraphs: ReturnType<typeof makeParagraph>[]) {
	const section = createSection(generateId(), paragraphs, DEFAULT_SECTION_PROPERTIES);
	const body = createBody(generateId(), [section]);
	return createDocument({ id: generateId(), body });
}

describe('PdfDocument', () => {
	it('generates a PDF starting with %PDF-1.4', () => {
		const doc = makeDocument([makeParagraph('Hello World')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument();
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result.slice(0, 20));

		expect(text).toContain('%PDF-1.4');
	});

	it('generates a PDF ending with %%EOF', () => {
		const doc = makeDocument([makeParagraph('Hello World')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument();
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result.slice(-10));

		expect(text).toContain('%%EOF');
	});

	it('includes font resources', () => {
		const doc = makeDocument([makeParagraph('Hello World')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument({ compress: false });
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result);

		expect(text).toContain('/Type /Font');
		expect(text).toContain('/BaseFont');
	});

	it('includes page objects', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument({ compress: false });
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result);

		expect(text).toContain('/Type /Page');
		expect(text).toContain('/Type /Pages');
		expect(text).toContain('/Type /Catalog');
	});

	it('includes text content in uncompressed mode', () => {
		const doc = makeDocument([makeParagraph('Hello World')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument({ compress: false });
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result);

		expect(text).toContain('BT');
		expect(text).toContain('ET');
		expect(text).toContain('Tj');
	});

	it('includes info when metadata provided', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument({
			compress: false,
			title: 'Test Doc',
			author: 'Test Author',
		});
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result);

		expect(text).toContain('/Title (Test Doc)');
		expect(text).toContain('/Author (Test Author)');
	});

	it('handles multiple paragraphs', () => {
		const doc = makeDocument([
			makeParagraph('First paragraph'),
			makeParagraph('Second paragraph'),
			makeParagraph('Third paragraph'),
		]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const pdfDoc = new PdfDocument({ compress: false });
		const result = pdfDoc.generate(layout);
		const text = DECODER.decode(result);

		expect(text).toContain('%PDF-1.4');
		expect(text).toContain('%%EOF');
		// Multiple BT/ET blocks for multiple fragments
		const btCount = (text.match(/\bBT\b/g) || []).length;
		expect(btCount).toBeGreaterThanOrEqual(3);
	});
});

describe('PdfDocument image integration', () => {
	it('embeds image when media is provided', () => {
		const doc = makeDocument([makeParagraph('With image')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		// Create a fake image JPEG data
		const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

		// Create media map
		const media = new Map<string, { id: string; contentType: string; data: Uint8Array }>([
			['test-image.jpg', { id: 'img1', contentType: 'image/jpeg', data: jpegData }],
		]);

		// Manually inject an image block into the layout result
		const modifiedLayout = {
			...layout,
			pages: layout.pages.map((p, i) =>
				i === 0
					? {
						...p,
						blocks: [
							...p.blocks,
							{
								kind: 'image' as const,
								rect: { x: 10, y: 10, width: 100, height: 80 },
								nodePath: [0, 0, 0] as const,
								src: 'test-image.jpg',
								mimeType: 'image/jpeg',
							},
						],
					}
					: p,
			),
		};

		const pdfDoc = new PdfDocument({ compress: false });
		const result = pdfDoc.generate(modifiedLayout, media);
		const text = DECODER.decode(result);

		// Should contain XObject image reference and Do operator
		expect(text).toContain('/XObject');
		expect(text).toContain('/Im1');
		expect(text).toContain('Do');
		expect(text).toContain('/Subtype /Image');
	});

	it('skips image when no media map provided', () => {
		const doc = makeDocument([makeParagraph('No media')]);
		const engine = new LayoutEngine();
		const layout = engine.layout(doc);

		const modifiedLayout = {
			...layout,
			pages: layout.pages.map((p, i) =>
				i === 0
					? {
						...p,
						blocks: [
							...p.blocks,
							{
								kind: 'image' as const,
								rect: { x: 10, y: 10, width: 100, height: 80 },
								nodePath: [0, 0, 0] as const,
								src: 'missing-image.jpg',
							},
						],
					}
					: p,
			),
		};

		const pdfDoc = new PdfDocument({ compress: false });
		// Should not throw when media is undefined
		const result = pdfDoc.generate(modifiedLayout);
		expect(result).toBeInstanceOf(Uint8Array);
	});
});

describe('exportToPdf', () => {
	it('exports a document to PDF', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const result = exportToPdf(doc);

		expect(result).toBeInstanceOf(Uint8Array);
		const header = DECODER.decode(result.slice(0, 10));
		expect(header).toContain('%PDF-1.4');
	});

	it('accepts export options', () => {
		const doc = makeDocument([makeParagraph('Hello')]);
		const result = exportToPdf(doc, {
			title: 'My Document',
			compress: false,
		});

		const text = DECODER.decode(result);
		expect(text).toContain('/Title (My Document)');
	});
});
