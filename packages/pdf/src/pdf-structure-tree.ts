/**
 * PDF Structure Tree for Tagged PDF / Accessibility.
 *
 * Builds the structure tree from the layout result, creating:
 * - /StructTreeRoot dictionary
 * - Structure elements (/StructElem) for each content block
 * - /ParentTree number tree mapping MCIDs to structure elements
 *
 * The structure tree follows PDF 1.7 (ISO 32000-1), Section 14.7.
 */

import type {
	LayoutBlock,
	LayoutImage,
	LayoutParagraph,
	LayoutResult,
	LayoutTable,
} from '@jpoffice/layout';
import { isLayoutImage, isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { PdfStructureTag } from './pdf-tags';
import { nodeTypeToTag } from './pdf-tags';
import type { PdfWriter } from './pdf-writer';
import { escapePdfString } from './unit-utils';

/** Result of writing the structure tree to the PDF. */
export interface StructureTreeResult {
	/** Object reference for the /StructTreeRoot. */
	readonly structTreeRootRef: number;
	/** Object reference for the /ParentTree number tree. */
	readonly parentTreeRef: number;
	/** Total number of MCIDs assigned. */
	readonly mcidCounter: number;
	/** Map from page index to the ordered array of MCIDs used on that page. */
	readonly pageMarkedContent: ReadonlyMap<number, number[]>;
}

/**
 * Internal structure element being built before writing to PDF.
 */
interface StructElemEntry {
	readonly tag: PdfStructureTag;
	readonly mcid: number;
	readonly pageIndex: number;
	readonly altText?: string;
	/** Child entries (for tables: rows and cells). */
	readonly children?: StructElemEntry[];
}

/**
 * Write the full PDF structure tree for accessibility tagging.
 *
 * Walks the layout result to identify all content blocks, assigns MCIDs,
 * and writes the StructTreeRoot, StructElem objects, and ParentTree.
 *
 * @param writer - PdfWriter to emit objects into
 * @param layoutResult - The complete layout output
 * @param pageRefs - Object references for each page (needed for /Pg on structure elements)
 * @returns The structure tree references and MCID mapping
 */
export function writeStructureTree(
	writer: PdfWriter,
	layoutResult: LayoutResult,
	pageRefs: readonly number[],
): StructureTreeResult {
	// Phase 1: Collect structure entries from layout, assigning MCIDs
	let mcidCounter = 0;
	const pageMarkedContent = new Map<number, number[]>();
	const allEntries: StructElemEntry[] = [];

	for (let pageIdx = 0; pageIdx < layoutResult.pages.length; pageIdx++) {
		const page = layoutResult.pages[pageIdx];

		const assignMcid = (pageIndex: number): number => {
			const mcid = mcidCounter++;
			if (!pageMarkedContent.has(pageIndex)) {
				pageMarkedContent.set(pageIndex, []);
			}
			pageMarkedContent.get(pageIndex)!.push(mcid);
			return mcid;
		};

		// Process header blocks
		if (page.header) {
			collectBlockEntries(page.header.blocks, pageIdx, assignMcid, allEntries);
		}

		// Process main content blocks
		collectBlockEntries(page.blocks, pageIdx, assignMcid, allEntries);

		// Process footer blocks
		if (page.footer) {
			collectBlockEntries(page.footer.blocks, pageIdx, assignMcid, allEntries);
		}
	}

	// Phase 2: Write structure elements to PDF
	const structTreeRootRef = writer.reserveId();
	const parentTreeRef = writer.reserveId();

	// Reserve the Document-level structure element ref
	const docStructRef = writer.reserveId();

	// Write all child structure elements, collecting refs and building parent tree entries
	// parentTreeEntries maps MCID -> structElem object ref
	const parentTreeEntries = new Map<number, number>();
	const childRefs: number[] = [];

	for (const entry of allEntries) {
		if (entry.children && entry.children.length > 0) {
			// This is a container element (Table)
			const tableRef = writeTableStructElem(
				writer,
				entry,
				docStructRef,
				pageRefs,
				parentTreeEntries,
			);
			childRefs.push(tableRef);
		} else {
			// Leaf structure element (paragraph, image)
			const elemRef = writeLeafStructElem(writer, entry, docStructRef, pageRefs);
			parentTreeEntries.set(entry.mcid, elemRef);
			childRefs.push(elemRef);
		}
	}

	// Write the Document structure element (child of StructTreeRoot)
	const kidsStr = childRefs.map((r) => `${r} 0 R`).join(' ');
	writer.setObject(
		docStructRef,
		`<< /Type /StructElem /S /Document /P ${structTreeRootRef} 0 R /K [${kidsStr}] >>`,
	);

	// Write the ParentTree (number tree)
	// The parent tree maps MCID integers to structure element references.
	// Format: /Nums [0 ref0 1 ref1 ...]
	const numsEntries: string[] = [];
	for (let i = 0; i < mcidCounter; i++) {
		const elemRef = parentTreeEntries.get(i);
		if (elemRef !== undefined) {
			numsEntries.push(`${i} ${elemRef} 0 R`);
		}
	}
	writer.setObject(parentTreeRef, `<< /Nums [${numsEntries.join(' ')}] >>`);

	// Write the StructTreeRoot
	writer.setObject(
		structTreeRootRef,
		`<< /Type /StructTreeRoot /K ${docStructRef} 0 R /ParentTree ${parentTreeRef} 0 R /ParentTreeNextKey ${mcidCounter} >>`,
	);

	return {
		structTreeRootRef,
		parentTreeRef,
		mcidCounter,
		pageMarkedContent,
	};
}

/**
 * Collect structure entries from an array of layout blocks.
 */
function collectBlockEntries(
	blocks: readonly LayoutBlock[],
	pageIndex: number,
	assignMcid: (pageIndex: number) => number,
	entries: StructElemEntry[],
): void {
	for (const block of blocks) {
		if (isLayoutParagraph(block)) {
			entries.push(collectParagraphEntry(block, pageIndex, assignMcid));
		} else if (isLayoutTable(block)) {
			entries.push(collectTableEntry(block, pageIndex, assignMcid));
		} else if (isLayoutImage(block)) {
			entries.push(collectImageEntry(block, pageIndex, assignMcid));
		}
	}
}

function collectParagraphEntry(
	block: LayoutParagraph,
	pageIndex: number,
	assignMcid: (pageIndex: number) => number,
): StructElemEntry {
	const tag = nodeTypeToTag('paragraph', block.outlineLevel);
	const mcid = assignMcid(pageIndex);
	return { tag, mcid, pageIndex };
}

function collectTableEntry(
	table: LayoutTable,
	pageIndex: number,
	assignMcid: (pageIndex: number) => number,
): StructElemEntry {
	const mcid = assignMcid(pageIndex);
	const children: StructElemEntry[] = [];

	for (const row of table.rows) {
		const rowMcid = assignMcid(pageIndex);
		const cellEntries: StructElemEntry[] = [];

		for (const cell of row.cells) {
			const cellMcid = assignMcid(pageIndex);
			const cellTag: PdfStructureTag = row.isHeader ? 'TH' : 'TD';

			// Collect nested paragraphs inside cell
			const cellChildren: StructElemEntry[] = [];
			for (const cellBlock of cell.blocks) {
				if (isLayoutParagraph(cellBlock)) {
					cellChildren.push(collectParagraphEntry(cellBlock, pageIndex, assignMcid));
				}
			}

			cellEntries.push({
				tag: cellTag,
				mcid: cellMcid,
				pageIndex,
				children: cellChildren.length > 0 ? cellChildren : undefined,
			});
		}

		children.push({
			tag: 'TR',
			mcid: rowMcid,
			pageIndex,
			children: cellEntries,
		});
	}

	return {
		tag: 'Table',
		mcid,
		pageIndex,
		children,
	};
}

function collectImageEntry(
	image: LayoutImage,
	pageIndex: number,
	assignMcid: (pageIndex: number) => number,
): StructElemEntry {
	const mcid = assignMcid(pageIndex);
	// Use the src filename as a basic alt text fallback
	const altText = extractImageAlt(image.src);
	return { tag: 'Figure', mcid, pageIndex, altText };
}

/**
 * Extract a basic alt text from an image source.
 * For data URLs, returns "Image". For file paths, returns the filename.
 */
function extractImageAlt(src: string): string {
	if (src.startsWith('data:')) {
		return 'Image';
	}
	const lastSlash = src.lastIndexOf('/');
	if (lastSlash >= 0) {
		return src.substring(lastSlash + 1);
	}
	return src || 'Image';
}

/**
 * Write a leaf structure element (paragraph, heading, image) as a PDF object.
 */
function writeLeafStructElem(
	writer: PdfWriter,
	entry: StructElemEntry,
	parentRef: number,
	pageRefs: readonly number[],
): number {
	const pageRef = pageRefs[entry.pageIndex];
	let dict = `<< /Type /StructElem /S /${entry.tag} /P ${parentRef} 0 R /K ${entry.mcid} /Pg ${pageRef} 0 R`;

	if (entry.altText) {
		dict += ` /Alt (${escapePdfString(entry.altText)})`;
	}

	dict += ' >>';
	return writer.addObject(dict);
}

/**
 * Write a table structure element with nested rows and cells.
 * Returns the table's object reference.
 */
function writeTableStructElem(
	writer: PdfWriter,
	tableEntry: StructElemEntry,
	parentRef: number,
	pageRefs: readonly number[],
	parentTreeEntries: Map<number, number>,
): number {
	const tableRef = writer.reserveId();
	parentTreeEntries.set(tableEntry.mcid, tableRef);

	const rowRefs: number[] = [];

	for (const rowEntry of tableEntry.children ?? []) {
		const rowRef = writer.reserveId();
		parentTreeEntries.set(rowEntry.mcid, rowRef);

		const cellRefs: number[] = [];

		for (const cellEntry of rowEntry.children ?? []) {
			const cellRef = writer.reserveId();
			parentTreeEntries.set(cellEntry.mcid, cellRef);

			// Write nested paragraph elements inside the cell
			const nestedRefs: number[] = [];
			if (cellEntry.children) {
				for (const nestedEntry of cellEntry.children) {
					const nestedRef = writeLeafStructElem(writer, nestedEntry, cellRef, pageRefs);
					parentTreeEntries.set(nestedEntry.mcid, nestedRef);
					nestedRefs.push(nestedRef);
				}
			}

			const pageRef = pageRefs[cellEntry.pageIndex];
			let cellDict = `<< /Type /StructElem /S /${cellEntry.tag} /P ${rowRef} 0 R`;
			if (nestedRefs.length > 0) {
				const nestedKids = nestedRefs.map((r) => `${r} 0 R`).join(' ');
				cellDict += ` /K [${cellEntry.mcid} ${nestedKids}]`;
			} else {
				cellDict += ` /K ${cellEntry.mcid}`;
			}
			cellDict += ` /Pg ${pageRef} 0 R >>`;

			writer.setObject(cellRef, cellDict);
			cellRefs.push(cellRef);
		}

		// Write the row structure element
		const rowKids = cellRefs.map((r) => `${r} 0 R`).join(' ');
		const pageRef = pageRefs[rowEntry.pageIndex];
		writer.setObject(
			rowRef,
			`<< /Type /StructElem /S /TR /P ${tableRef} 0 R /K [${rowKids}] /Pg ${pageRef} 0 R >>`,
		);

		rowRefs.push(rowRef);
	}

	// Write the table structure element
	const tableKids = rowRefs.map((r) => `${r} 0 R`).join(' ');
	const pageRef = pageRefs[tableEntry.pageIndex];
	writer.setObject(
		tableRef,
		`<< /Type /StructElem /S /Table /P ${parentRef} 0 R /K [${tableKids}] /Pg ${pageRef} 0 R >>`,
	);

	return tableRef;
}

/**
 * Build a flat MCID assignment map from the layout result.
 * This is used during content stream generation to know which MCID
 * to assign to each block when rendering.
 *
 * The returned map keys are: "page:{pageIdx}:block:{blockIdx}" or
 * "page:{pageIdx}:header:{blockIdx}" etc., and values are MCIDs.
 *
 * For the rendering pass, we use a simpler approach: a sequential counter
 * that matches the order blocks are visited in writeStructureTree.
 */
export function buildBlockMcidMap(layoutResult: LayoutResult): Map<string, number> {
	const map = new Map<string, number>();
	let mcid = 0;

	for (let pageIdx = 0; pageIdx < layoutResult.pages.length; pageIdx++) {
		const page = layoutResult.pages[pageIdx];

		// Header blocks
		if (page.header) {
			mcid = assignBlockMcids(page.header.blocks, pageIdx, 'header', map, mcid);
		}

		// Main blocks
		mcid = assignBlockMcids(page.blocks, pageIdx, 'main', map, mcid);

		// Footer blocks
		if (page.footer) {
			mcid = assignBlockMcids(page.footer.blocks, pageIdx, 'footer', map, mcid);
		}
	}

	return map;
}

function assignBlockMcids(
	blocks: readonly LayoutBlock[],
	pageIdx: number,
	region: string,
	map: Map<string, number>,
	startMcid: number,
): number {
	let mcid = startMcid;

	for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
		const block = blocks[blockIdx];

		if (isLayoutParagraph(block)) {
			const key = `page:${pageIdx}:${region}:para:${blockIdx}`;
			map.set(key, mcid);
			mcid++;
		} else if (isLayoutTable(block)) {
			// Table itself gets an MCID
			const tableKey = `page:${pageIdx}:${region}:table:${blockIdx}`;
			map.set(tableKey, mcid);
			mcid++;

			// Each row and cell also gets MCIDs
			for (let rowIdx = 0; rowIdx < block.rows.length; rowIdx++) {
				const rowKey = `page:${pageIdx}:${region}:table:${blockIdx}:row:${rowIdx}`;
				map.set(rowKey, mcid);
				mcid++;

				const row = block.rows[rowIdx];
				for (let cellIdx = 0; cellIdx < row.cells.length; cellIdx++) {
					const cellKey = `page:${pageIdx}:${region}:table:${blockIdx}:row:${rowIdx}:cell:${cellIdx}`;
					map.set(cellKey, mcid);
					mcid++;

					// Nested paragraphs in cells
					const cell = row.cells[cellIdx];
					for (let nestedIdx = 0; nestedIdx < cell.blocks.length; nestedIdx++) {
						if (isLayoutParagraph(cell.blocks[nestedIdx])) {
							const nestedKey = `page:${pageIdx}:${region}:table:${blockIdx}:row:${rowIdx}:cell:${cellIdx}:para:${nestedIdx}`;
							map.set(nestedKey, mcid);
							mcid++;
						}
					}
				}
			}
		} else if (isLayoutImage(block)) {
			const key = `page:${pageIdx}:${region}:image:${blockIdx}`;
			map.set(key, mcid);
			mcid++;
		}
	}

	return mcid;
}

/**
 * Simple sequential MCID counter for use during rendering.
 * Call nextMcid() for each content block in the same order as the structure tree walker.
 */
export class McidCounter {
	private current = 0;

	/** Get the next MCID and advance the counter. */
	next(): number {
		return this.current++;
	}

	/** Peek at the current value without advancing. */
	peek(): number {
		return this.current;
	}

	/** Get the total number of MCIDs assigned so far. */
	get count(): number {
		return this.current;
	}
}
