/**
 * Low-level PDF writer.
 * Builds the raw PDF byte stream: header, indirect objects, xref table, trailer.
 */

import { deflateSync } from 'fflate';

interface PdfObject {
	readonly id: number;
	readonly content: Uint8Array;
}

const ENCODER = new TextEncoder();

function encode(str: string): Uint8Array {
	return ENCODER.encode(str);
}

export class PdfWriter {
	private objects: PdfObject[] = [];
	private nextId = 1;
	private compress: boolean;

	constructor(compress = true) {
		this.compress = compress;
	}

	/** Reserve an object ID without adding content yet. */
	reserveId(): number {
		return this.nextId++;
	}

	/** Add an indirect object with string content. Returns its object number. */
	addObject(content: string): number {
		const id = this.nextId++;
		this.objects.push({ id, content: encode(content) });
		return id;
	}

	/** Add an object with a pre-reserved ID. */
	setObject(id: number, content: string): void {
		this.objects.push({ id, content: encode(content) });
	}

	/** Add a stream object (optionally compressed). Returns its object number. */
	addStream(data: Uint8Array | string, extraDict = ''): number {
		const raw = typeof data === 'string' ? encode(data) : data;
		let streamData: Uint8Array;
		let filter = '';

		// Skip auto-compression if the extraDict already specifies a filter
		const hasExplicitFilter = extraDict.includes('/Filter');

		if (this.compress && raw.length > 64 && !hasExplicitFilter) {
			streamData = deflateSync(raw);
			filter = '/Filter /FlateDecode ';
		} else {
			streamData = raw;
		}

		const header = `<< ${filter}${extraDict}/Length ${streamData.length} >>\nstream\n`;
		const footer = '\nendstream';

		const headerBytes = encode(header);
		const footerBytes = encode(footer);

		const combined = new Uint8Array(headerBytes.length + streamData.length + footerBytes.length);
		combined.set(headerBytes, 0);
		combined.set(streamData, headerBytes.length);
		combined.set(footerBytes, headerBytes.length + streamData.length);

		const id = this.nextId++;
		this.objects.push({ id, content: combined });
		return id;
	}

	/** Generate the complete PDF file as Uint8Array. */
	generate(rootRef: number, infoRef?: number): Uint8Array {
		const parts: Uint8Array[] = [];
		let offset = 0;

		const write = (data: Uint8Array | string) => {
			const bytes = typeof data === 'string' ? encode(data) : data;
			parts.push(bytes);
			offset += bytes.length;
		};

		// Header
		write('%PDF-1.4\n');
		// Binary comment (marks file as binary)
		write('%\xE2\xE3\xCF\xD3\n');

		// Objects
		const offsets = new Map<number, number>();
		for (const obj of this.objects) {
			offsets.set(obj.id, offset);
			write(`${obj.id} 0 obj\n`);
			write(obj.content);
			write('\nendobj\n');
		}

		// Cross-reference table
		const xrefOffset = offset;
		const maxId = this.nextId - 1;
		write('xref\n');
		write(`0 ${maxId + 1}\n`);
		write('0000000000 65535 f \n');
		for (let id = 1; id <= maxId; id++) {
			const objOffset = offsets.get(id) ?? 0;
			write(`${String(objOffset).padStart(10, '0')} 00000 n \n`);
		}

		// Trailer
		write('trailer\n');
		let trailerDict = `<< /Size ${maxId + 1} /Root ${rootRef} 0 R`;
		if (infoRef) {
			trailerDict += ` /Info ${infoRef} 0 R`;
		}
		trailerDict += ' >>\n';
		write(trailerDict);

		write('startxref\n');
		write(`${xrefOffset}\n`);
		write('%%EOF\n');

		// Concatenate all parts
		const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
		const result = new Uint8Array(totalLength);
		let pos = 0;
		for (const part of parts) {
			result.set(part, pos);
			pos += part.length;
		}

		return result;
	}
}
