/**
 * PDF document outlines (bookmarks panel in PDF readers).
 * Generates the outline tree from heading paragraphs in the layout result.
 */

import type { LayoutResult } from '@jpoffice/layout';
import { isLayoutParagraph } from '@jpoffice/layout';
import type { PdfWriter } from './pdf-writer';
import { escapePdfString, pxToPt, round } from './unit-utils';

export interface OutlineEntry {
	readonly title: string;
	readonly level: number; // 0-5 for H1-H6
	readonly pageIndex: number;
	readonly yPosition: number; // px from top of page
}

/**
 * Collect outline entries from layout result.
 * Looks for paragraphs with an outlineLevel property (0-5 for H1-H6).
 */
export function collectOutlineEntries(layoutResult: LayoutResult): OutlineEntry[] {
	const entries: OutlineEntry[] = [];

	for (let pageIdx = 0; pageIdx < layoutResult.pages.length; pageIdx++) {
		const page = layoutResult.pages[pageIdx];
		for (const block of page.blocks) {
			if (isLayoutParagraph(block) && block.outlineLevel !== undefined && block.outlineLevel >= 0) {
				// Extract text content from the paragraph's lines
				let title = '';
				for (const line of block.lines) {
					for (const fragment of line.fragments) {
						title += fragment.text;
					}
				}

				if (title.trim()) {
					entries.push({
						title: title.trim(),
						level: block.outlineLevel,
						pageIndex: pageIdx,
						yPosition: page.contentArea.y + block.rect.y,
					});
				}
			}
		}
	}

	return entries;
}

/**
 * Write document outlines to PDF.
 * Returns the outline root object reference, or undefined if no outlines exist.
 *
 * Builds a flat linked list of outline items (First/Last/Next/Prev).
 * Each item has a /Dest pointing to the top of the heading on its page.
 */
export function writeOutlines(
	writer: PdfWriter,
	entries: readonly OutlineEntry[],
	pageRefs: readonly number[],
	pageHeights: readonly number[],
): number | undefined {
	if (entries.length === 0) return undefined;

	const outlinesRef = writer.reserveId();

	// Reserve IDs for all outline items
	const itemRefs: number[] = [];
	for (let i = 0; i < entries.length; i++) {
		itemRefs.push(writer.reserveId());
	}

	// Build outline items with Next/Prev links (flat list)
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const pageRef = pageRefs[entry.pageIndex];
		const pageHeightPt = pageHeights[entry.pageIndex];
		const yPt = round(pageHeightPt - pxToPt(entry.yPosition));

		const escapedTitle = escapePdfString(entry.title);

		let itemDict = `<< /Title (${escapedTitle}) `;
		itemDict += `/Parent ${outlinesRef} 0 R `;
		itemDict += `/Dest [${pageRef} 0 R /XYZ 0 ${yPt} null] `;

		if (i > 0) {
			itemDict += `/Prev ${itemRefs[i - 1]} 0 R `;
		}
		if (i < entries.length - 1) {
			itemDict += `/Next ${itemRefs[i + 1]} 0 R `;
		}

		itemDict += '>>';
		writer.setObject(itemRefs[i], itemDict);
	}

	// Write outlines root
	writer.setObject(
		outlinesRef,
		`<< /Type /Outlines /First ${itemRefs[0]} 0 R /Last ${itemRefs[itemRefs.length - 1]} 0 R /Count ${entries.length} >>`,
	);

	return outlinesRef;
}
