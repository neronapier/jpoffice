import { describe, it, expect } from 'vitest';
import { PdfWriter } from '../src/pdf-writer';

const DECODER = new TextDecoder();

describe('PdfWriter', () => {
	it('generates valid PDF header', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain('%PDF-1.4');
	});

	it('generates valid PDF footer', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain('%%EOF');
	});

	it('includes xref table', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain('xref');
		expect(text).toContain('startxref');
	});

	it('includes trailer with root ref', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain('trailer');
		expect(text).toContain(`/Root ${catalogRef} 0 R`);
	});

	it('includes info ref in trailer when provided', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const infoRef = writer.addObject('<< /Title (Test) >>');
		const result = writer.generate(catalogRef, infoRef);
		const text = DECODER.decode(result);

		expect(text).toContain(`/Info ${infoRef} 0 R`);
	});

	it('writes objects with correct syntax', () => {
		const writer = new PdfWriter(false);
		const ref = writer.addObject('<< /Type /Page >>');
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain(`${ref} 0 obj\n<< /Type /Page >>\nendobj`);
	});

	it('adds stream objects', () => {
		const writer = new PdfWriter(false);
		const streamRef = writer.addStream('BT /F1 12 Tf ET');
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain('stream');
		expect(text).toContain('endstream');
		expect(text).toContain('BT /F1 12 Tf ET');
	});

	it('reserves and sets object IDs', () => {
		const writer = new PdfWriter(false);
		const reservedId = writer.reserveId();
		const childRef = writer.addObject(`<< /Parent ${reservedId} 0 R >>`);
		writer.setObject(reservedId, `<< /Kids [${childRef} 0 R] >>`);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);
		const text = DECODER.decode(result);

		expect(text).toContain(`${reservedId} 0 obj`);
		expect(text).toContain(`/Kids [${childRef} 0 R]`);
	});

	it('returns Uint8Array', () => {
		const writer = new PdfWriter(false);
		const catalogRef = writer.addObject('<< /Type /Catalog >>');
		const result = writer.generate(catalogRef);

		expect(result).toBeInstanceOf(Uint8Array);
		expect(result.length).toBeGreaterThan(0);
	});
});
