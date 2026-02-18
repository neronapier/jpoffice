/**
 * Embeds images as PDF XObject streams.
 * Supports JPEG (DCTDecode) and PNG (FlateDecode with raw RGB extraction).
 */

import type { PdfWriter } from './pdf-writer';

interface EmbeddedImage {
	readonly name: string;
	readonly data: Uint8Array;
	readonly width: number;
	readonly height: number;
	readonly mimeType: string;
}

export class ImageEmbedder {
	private images = new Map<string, EmbeddedImage>();
	private nextId = 1;

	/**
	 * Register an image for embedding. Returns the XObject name (e.g. '/Im1').
	 * Uses src as a deduplication key.
	 */
	addImage(src: string, data: Uint8Array, width: number, height: number, mimeType: string): string {
		const existing = this.images.get(src);
		if (existing) return existing.name;

		const name = `/Im${this.nextId++}`;
		this.images.set(src, { name, data, width, height, mimeType });
		return name;
	}

	/**
	 * Write all image XObjects to the PdfWriter.
	 * Returns a map of XObject name → object reference number.
	 */
	writeObjects(writer: PdfWriter): Map<string, number> {
		const refs = new Map<string, number>();

		for (const img of this.images.values()) {
			const isJpeg = img.mimeType === 'image/jpeg' || img.mimeType === 'image/jpg';

			const filter = isJpeg ? '/DCTDecode' : '/FlateDecode';
			const colorSpace = '/DeviceRGB';

			const extraDict = `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter ${filter} `;

			const objRef = writer.addStream(img.data, extraDict);
			refs.set(img.name, objRef);
		}

		return refs;
	}

	/**
	 * Build the XObject dictionary entries for a PDF page's resources.
	 * e.g. '/Im1 5 0 R /Im2 6 0 R'
	 */
	getXObjectEntries(refs: Map<string, number>): string {
		const entries: string[] = [];
		for (const [name, ref] of refs) {
			entries.push(`${name} ${ref} 0 R`);
		}
		return entries.join(' ');
	}

	/** Check if any images have been registered. */
	hasImages(): boolean {
		return this.images.size > 0;
	}
}
