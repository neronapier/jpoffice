/**
 * PDF link annotations for hyperlinks in the document.
 * Collects hyperlink fragments from layout result and writes
 * PDF annotation objects that link to external URLs.
 */

import type { LayoutResult } from '@jpoffice/layout';
import { isLayoutParagraph } from '@jpoffice/layout';
import type { PdfWriter } from './pdf-writer';
import { escapePdfString, pxToPt, round } from './unit-utils';

export interface LinkAnnotation {
	readonly pageIndex: number;
	readonly x: number; // px coordinates from layout
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly url: string;
}

/**
 * Collect hyperlink annotations from layout result.
 * Walks all paragraphs looking for fragments that have an href property.
 */
export function collectLinkAnnotations(layoutResult: LayoutResult): LinkAnnotation[] {
	const annotations: LinkAnnotation[] = [];

	for (let pageIdx = 0; pageIdx < layoutResult.pages.length; pageIdx++) {
		const page = layoutResult.pages[pageIdx];
		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					for (const fragment of line.fragments) {
						if (fragment.href) {
							annotations.push({
								pageIndex: pageIdx,
								x: block.rect.x + fragment.rect.x,
								y: block.rect.y + line.rect.y + fragment.rect.y,
								width: fragment.rect.width,
								height: fragment.rect.height,
								url: fragment.href,
							});
						}
					}
				}
			}
		}
	}

	return annotations;
}

/**
 * Write link annotations to PDF pages.
 * Returns a Map<pageIndex, annotRefIds[]> to be added to page /Annots arrays.
 */
export function writeLinkAnnotations(
	writer: PdfWriter,
	annotations: readonly LinkAnnotation[],
	pageHeights: readonly number[],
): Map<number, number[]> {
	const pageAnnotations = new Map<number, number[]>();

	for (const ann of annotations) {
		const pageHeightPt = pageHeights[ann.pageIndex];
		const x1 = round(pxToPt(ann.x));
		const y1 = round(pageHeightPt - pxToPt(ann.y + ann.height));
		const x2 = round(pxToPt(ann.x + ann.width));
		const y2 = round(pageHeightPt - pxToPt(ann.y));

		const escapedUrl = escapePdfString(ann.url);

		const annotRef = writer.addObject(
			`<< /Type /Annot /Subtype /Link /Rect [${x1} ${y1} ${x2} ${y2}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${escapedUrl}) >> >>`,
		);

		if (!pageAnnotations.has(ann.pageIndex)) {
			pageAnnotations.set(ann.pageIndex, []);
		}
		pageAnnotations.get(ann.pageIndex)!.push(annotRef);
	}

	return pageAnnotations;
}
