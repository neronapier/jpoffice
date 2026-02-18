import { describe, it, expect } from 'vitest';
import { FontRegistry } from '../src/font-map';

describe('FontRegistry', () => {
	it('returns Helvetica for sans-serif families', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Arial');
		expect(font.baseName).toBe('Helvetica');
		expect(font.pdfName).toBe('/F1');
		expect(font.encoding).toBe('WinAnsiEncoding');
	});

	it('returns Helvetica-Bold for bold sans', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Calibri', true);
		expect(font.baseName).toBe('Helvetica-Bold');
	});

	it('returns Helvetica-Oblique for italic sans', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Calibri', false, true);
		expect(font.baseName).toBe('Helvetica-Oblique');
	});

	it('returns Helvetica-BoldOblique for bold italic sans', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Calibri', true, true);
		expect(font.baseName).toBe('Helvetica-BoldOblique');
	});

	it('returns Times-Roman for serif families', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Times New Roman');
		expect(font.baseName).toBe('Times-Roman');
	});

	it('returns Times-Bold for bold serif', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Georgia', true);
		expect(font.baseName).toBe('Times-Bold');
	});

	it('returns Courier for monospace families', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Courier New');
		expect(font.baseName).toBe('Courier');
	});

	it('returns Courier-Bold for bold monospace', () => {
		const reg = new FontRegistry();
		const font = reg.getFont('Consolas', true);
		expect(font.baseName).toBe('Courier-Bold');
	});

	it('deduplicates same font variants', () => {
		const reg = new FontRegistry();
		const f1 = reg.getFont('Arial');
		const f2 = reg.getFont('Calibri');
		// Both map to Helvetica, should be same object
		expect(f1.pdfName).toBe(f2.pdfName);
	});

	it('assigns unique pdfNames to different variants', () => {
		const reg = new FontRegistry();
		const f1 = reg.getFont('Arial');
		const f2 = reg.getFont('Arial', true);
		expect(f1.pdfName).not.toBe(f2.pdfName);
	});

	it('getAllFonts returns all registered fonts', () => {
		const reg = new FontRegistry();
		reg.getFont('Arial');
		reg.getFont('Arial', true);
		reg.getFont('Times New Roman');
		const all = reg.getAllFonts();
		expect(all.size).toBe(3);
	});
});
