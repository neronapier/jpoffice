/**
 * @jpoffice/pdf -- PDF export for JPOffice documents.
 *
 * Usage:
 *   import { exportToPdf } from '@jpoffice/pdf';
 *   const pdfBytes = exportToPdf(document, { title: 'My Doc' });
 *
 * For Unicode support, provide font buffers:
 *   import { exportToPdf, buildFontKey } from '@jpoffice/pdf';
 *   const fonts = new Map([
 *     [buildFontKey('Arial', false, false), arialBuffer],
 *     [buildFontKey('Arial', true, false), arialBoldBuffer],
 *   ]);
 *   const pdfBytes = exportToPdf(document, { fonts });
 */

import { LayoutEngine } from '@jpoffice/layout';
import type { JPDocument, JPFootnoteRef, JPShape } from '@jpoffice/model';
import { getPlainText, isShape, traverseByType } from '@jpoffice/model';
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

	// Extract shapes from document sections and map them to pages.
	// Shapes are absolutely positioned and not part of the layout flow.
	const shapes = extractShapesPerPage(document, layoutResult.pages.length);

	// Extract footnotes from the document
	const footnotes = extractFootnotes(document);

	return pdfDoc.generate(layoutResult, document.media, shapes, footnotes);
}

/**
 * Extract shapes from the document tree and assign them to pages.
 * Currently assigns all shapes from a section to the first page of that section.
 * Returns undefined if no shapes exist (avoids unnecessary allocation).
 */
function extractShapesPerPage(
	doc: JPDocument,
	pageCount: number,
): ReadonlyMap<number, readonly JPShape[]> | undefined {
	const body = doc.children[0];
	if (!body) return undefined;

	const shapesByPage = new Map<number, JPShape[]>();
	let hasShapes = false;
	let pageIndex = 0;

	for (const section of body.children) {
		// Collect shapes from section children
		const sectionShapes: JPShape[] = [];
		for (const child of section.children) {
			if (isShape(child)) {
				sectionShapes.push(child);
			}
		}

		if (sectionShapes.length > 0) {
			hasShapes = true;
			// Assign shapes to the first page of this section.
			// Clamp to valid page range.
			const targetPage = Math.min(pageIndex, pageCount - 1);
			const existing = shapesByPage.get(targetPage);
			if (existing) {
				existing.push(...sectionShapes);
			} else {
				shapesByPage.set(targetPage, sectionShapes);
			}
		}

		// Estimate how many pages this section spans.
		// Simple heuristic: at least one page per section.
		pageIndex++;
	}

	return hasShapes ? shapesByPage : undefined;
}

/**
 * Extract footnotes from the document in order.
 * Returns an array of { number, text } for rendering.
 */
function extractFootnotes(
	doc: JPDocument,
): readonly { number: number; text: string }[] {
	if (!doc.footnotes || doc.footnotes.length === 0) return [];

	const result: { number: number; text: string }[] = [];

	// Build a map of footnoteId -> order of appearance
	let noteNumber = 0;
	const footnoteMap = new Map<string, number>();

	// Walk the document to find footnote references in order
	for (const [node] of traverseByType<JPFootnoteRef>(doc, 'footnote-ref')) {
		if (!footnoteMap.has(node.footnoteId)) {
			noteNumber++;
			footnoteMap.set(node.footnoteId, noteNumber);
		}
	}

	// Now emit footnotes in order
	for (const footnote of doc.footnotes) {
		const num = footnoteMap.get(footnote.id);
		if (num === undefined) continue;

		// Get plain text from footnote content paragraphs
		let text = '';
		for (const para of footnote.content) {
			if (text.length > 0) text += ' ';
			text += getPlainText(para);
		}

		result.push({ number: num, text });
	}

	// Sort by number
	result.sort((a, b) => a.number - b.number);

	return result;
}

// Re-exports
export type { PdfExportOptions } from './pdf-document';
export { PdfDocument } from './pdf-document';
export { PdfWriter } from './pdf-writer';
export { ContentStreamBuilder } from './content-stream';
export { FontRegistry, buildFontKey } from './font-map';
export type { PdfFontInfo } from './font-map';
export { ImageEmbedder } from './image-embedder';
export { TextPainter } from './text-painter';
export type { GlyphMappings } from './text-painter';
export { TablePainter } from './table-painter';
export { ShapePainter } from './shape-painter';
export { pxToPt, flipY, colorToRgb, escapePdfString, round } from './unit-utils';
export type { LinkAnnotation } from './pdf-annotations';
export { collectLinkAnnotations, writeLinkAnnotations } from './pdf-annotations';
export type { OutlineEntry } from './pdf-outlines';
export { collectOutlineEntries, writeOutlines } from './pdf-outlines';

// Font embedding
export { subsetFont } from './font-subsetter';
export type { SubsetResult, PdfFontMetrics } from './font-subsetter';
export { writeCidFont } from './cid-font';
export type { CidFontResult } from './cid-font';
export { generateToUnicodeCMap } from './to-unicode-cmap';

// Tagged PDF / Accessibility
export type { PdfStructureTag } from './pdf-tags';
export { nodeTypeToTag } from './pdf-tags';
export type { StructureTreeResult } from './pdf-structure-tree';
export { writeStructureTree, buildBlockMcidMap, McidCounter } from './pdf-structure-tree';
