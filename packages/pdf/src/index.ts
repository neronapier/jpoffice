/**
 * @jpoffice/pdf — PDF export for JPOffice documents.
 *
 * Usage:
 *   import { exportToPdf } from '@jpoffice/pdf';
 *   const pdfBytes = exportToPdf(document, { title: 'My Doc' });
 */

import { LayoutEngine } from '@jpoffice/layout';
import type { JPDocument } from '@jpoffice/model';
import { PdfDocument } from './pdf-document';
import type { PdfExportOptions } from './pdf-document';

/**
 * Export a JPDocument to PDF format.
 * Returns the PDF file as a Uint8Array.
 */
export function exportToPdf(document: JPDocument, options?: PdfExportOptions): Uint8Array {
	const layoutEngine = new LayoutEngine();
	const layoutResult = layoutEngine.layout(document);
	const pdfDoc = new PdfDocument(options ?? {});
	return pdfDoc.generate(layoutResult, document.media);
}

// Re-exports
export type { PdfExportOptions } from './pdf-document';
export { PdfDocument } from './pdf-document';
export { PdfWriter } from './pdf-writer';
export { ContentStreamBuilder } from './content-stream';
export { FontRegistry } from './font-map';
export type { PdfFontInfo } from './font-map';
export { ImageEmbedder } from './image-embedder';
export { TextPainter } from './text-painter';
export { TablePainter } from './table-painter';
export { pxToPt, flipY, colorToRgb, escapePdfString, round } from './unit-utils';
