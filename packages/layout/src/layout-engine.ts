import type {
	JPBlockNode,
	JPDocument,
	JPDrawing,
	JPEndnoteRef,
	JPEquation,
	JPField,
	JPFootnoteRef,
	JPHeaderFooterContent,
	JPHeaderFooterRef,
	JPHyperlink,
	JPMention,
	JPNumberFormat,
	JPNumberingLevel,
	JPParagraph,
	JPPath,
	JPRun,
	JPSection,
	JPShape,
	JPShapeGroup,
	JPStyleRegistry,
	JPTable,
} from '@jpoffice/model';
import {
	emuToPx,
	isText,
	resolveNumberingLevel,
	resolveStyleParagraphProperties,
	twipsToPx,
} from '@jpoffice/model';
import type { LayoutCache } from './cache';
import type { ColumnConfig } from './column-layout';
import { calculateColumnRegions, distributeBlocksToColumns } from './column-layout';
import type { FloatingItem, PositionedFloat } from './float-layout';
import { positionFloats } from './float-layout';
import type { InlineItem } from './line-breaker';
import { breakIntoLines } from './line-breaker';
import { resolveParagraphLayout, resolveRunStyle } from './style-resolver';
import type { ResolvedParagraphLayout } from './style-resolver';
import { layoutTable } from './table-layout';
import { TextMeasurer } from './text-measurer';
import type {
	LayoutBlock,
	LayoutFootnoteArea,
	LayoutHeaderFooter,
	LayoutLineNumbering,
	LayoutPage,
	LayoutPageBorders,
	LayoutPageColumns,
	LayoutParagraph,
	LayoutRect,
	LayoutResult,
	LayoutShape,
	LayoutTable,
	LayoutWatermark,
} from './types';
import { isLayoutParagraph, isLayoutTable } from './types';

/**
 * The layout engine transforms a JPDocument into a LayoutResult.
 * It processes sections, paragraphs, tables, and images,
 * computing precise positions for every element.
 */
export class LayoutEngine {
	private measurer: TextMeasurer;
	private version = 0;
	private _cache: LayoutCache | null = null;

	/** Tracks sequential numbering counters per numId+level. */
	private numberingCounters = new Map<string, number>();
	/** Tracks whether the previous paragraph had numbering (for counter reset). */
	private lastNumberingNumId: number | null = null;

	constructor(measurer?: TextMeasurer, cache?: LayoutCache) {
		this.measurer = measurer ?? new TextMeasurer();
		this._cache = cache ?? null;
	}

	/** Get the current layout cache. */
	getCache(): LayoutCache | null {
		return this._cache;
	}

	/**
	 * Perform a full layout pass on a document.
	 */
	layout(doc: JPDocument): LayoutResult {
		this.version++;
		this.numberingCounters.clear();
		this.lastNumberingNumId = null;
		const pages: LayoutPage[] = [];

		const body = doc.children[0]; // JPBody
		for (let si = 0; si < body.children.length; si++) {
			const section = body.children[si];
			this.layoutSection(doc, section, [0, si], pages);
		}

		// Ensure at least one page
		if (pages.length === 0) {
			const defaultWidth = twipsToPx(11906); // A4
			const defaultHeight = twipsToPx(16838);
			const margin = twipsToPx(1440);
			pages.push({
				index: 0,
				width: defaultWidth,
				height: defaultHeight,
				contentArea: {
					x: margin,
					y: margin,
					width: defaultWidth - margin * 2,
					height: defaultHeight - margin * 2,
				},
				blocks: [],
			});
		}

		return { pages, version: this.version };
	}

	private layoutSection(
		doc: JPDocument,
		section: JPSection,
		sectionPath: JPPath,
		pages: LayoutPage[],
	): void {
		const props = section.properties;

		// Check for multi-column layout
		if (props.columns && props.columns.count > 1) {
			this.layoutSectionMultiColumn(doc, section, sectionPath, pages);
			return;
		}

		// Build optional layout metadata from section properties
		const watermark: LayoutWatermark | undefined = props.watermark
			? { ...props.watermark }
			: undefined;
		const pageBorders: LayoutPageBorders | undefined = props.pageBorders
			? { ...props.pageBorders }
			: undefined;
		const lineNumbering: LayoutLineNumbering | undefined = props.lineNumbering
			? {
					start: props.lineNumbering.start,
					countBy: props.lineNumbering.countBy,
					restart: props.lineNumbering.restart,
					distance: twipsToPx(props.lineNumbering.distance),
				}
			: undefined;

		const pageWidth = twipsToPx(props.pageSize.width);
		const pageHeight = twipsToPx(props.pageSize.height);
		const marginTop = twipsToPx(props.margins.top);
		const marginRight = twipsToPx(props.margins.right);
		const marginBottom = twipsToPx(props.margins.bottom);
		const marginLeft = twipsToPx(props.margins.left);
		const headerMargin = twipsToPx(props.margins.header);
		const footerMargin = twipsToPx(props.margins.footer);

		// Resolve header/footer references for this section
		const hfLayouts = this.resolveHeaderFooterLayouts(
			doc,
			props.headerReferences,
			props.footerReferences,
			pageWidth - marginLeft - marginRight,
			headerMargin,
			footerMargin,
			pageHeight,
		);

		// Compute content area considering header/footer space
		const contentAreaWidth = pageWidth - marginLeft - marginRight;

		const buildContentArea = (pageIndexInSection: number): LayoutRect => {
			const hf = this.pickHeaderFooter(hfLayouts, pageIndexInSection);
			const effectiveTop =
				hf.headerHeight > 0 ? Math.max(marginTop, headerMargin + hf.headerHeight) : marginTop;
			const effectiveBottom =
				hf.footerHeight > 0 ? Math.max(marginBottom, footerMargin + hf.footerHeight) : marginBottom;
			return {
				x: marginLeft,
				y: effectiveTop,
				width: contentAreaWidth,
				height: pageHeight - effectiveTop - effectiveBottom,
			};
		};

		let pageIndexInSection = 0;
		let contentArea = buildContentArea(pageIndexInSection);
		let pageBottom = contentArea.y + contentArea.height;
		let cursorY = contentArea.y;
		let currentPageBlocks: LayoutBlock[] = [];
		const floatingItems: FloatingItem[] = [];
		let currentPageFloats: PositionedFloat[] = [];

		const newPage = (): void => {
			// Resolve header/footer for this page
			const hf = this.pickHeaderFooter(hfLayouts, pageIndexInSection);

			// Position any remaining floats for this page
			if (floatingItems.length > 0) {
				const positioned = positionFloats(
					floatingItems.splice(0),
					contentArea,
					pageWidth,
					pageHeight,
				);
				currentPageFloats.push(...positioned);
			}

			const positioned = currentPageFloats;

			// Layout footnotes referenced on this page
			const footnoteArea = this.layoutFootnotesForPage(
				doc,
				currentPageBlocks,
				contentArea,
				cursorY,
			);

			const page: LayoutPage = {
				index: pages.length,
				width: pageWidth,
				height: pageHeight,
				contentArea,
				blocks: currentPageBlocks,
				floats: positioned.length > 0 ? positioned : undefined,
				header: hf.header,
				footer: hf.footer,
				footnoteArea,
				watermark,
				pageBorders,
				lineNumbering,
			};
			pages.push(page);
			currentPageBlocks = [];
			currentPageFloats = [];
			pageIndexInSection++;
			contentArea = buildContentArea(pageIndexInSection);
			pageBottom = contentArea.y + contentArea.height;
			cursorY = contentArea.y;
		};

		// Pre-compute all paragraph layouts for keepNext lookahead
		const blockLayouts: {
			block: JPBlockNode;
			path: JPPath;
			paraLayout?: ResolvedParagraphLayout;
		}[] = [];
		for (let bi = 0; bi < section.children.length; bi++) {
			const block = section.children[bi];
			const blockPath: JPPath = [...sectionPath, bi];
			const paraLayout =
				block.type === 'paragraph'
					? resolveParagraphLayout(doc.styles, block.properties)
					: undefined;
			blockLayouts.push({ block, path: blockPath, paraLayout });
		}

		for (let bi = 0; bi < blockLayouts.length; bi++) {
			const { block, path: blockPath } = blockLayouts[bi];

			// Explicit page break
			if (block.type === 'page-break') {
				newPage();
				continue;
			}

			// pageBreakBefore
			if (
				block.type === 'paragraph' &&
				block.properties.pageBreakBefore &&
				currentPageBlocks.length > 0
			) {
				newPage();
			}

			if (block.type === 'paragraph') {
				// Eagerly position any newly collected floats so they affect this and subsequent paragraphs
				if (floatingItems.length > 0) {
					const newlyPositioned = positionFloats(
						floatingItems.splice(0),
						contentArea,
						pageWidth,
						pageHeight,
					);
					currentPageFloats.push(...newlyPositioned);
				}

				// Check cache: if paragraph node reference unchanged, reuse height
				const cachedHeight = this._cache?.getCachedBlockHeight(block.id, block);
				if (cachedHeight !== undefined && floatingItems.length === 0) {
					const paraLayout = blockLayouts[bi].paraLayout!;
					const cachedBottom = cursorY + cachedHeight;

					if (cachedBottom <= pageBottom || currentPageBlocks.length === 0) {
						currentPageBlocks.push({
							rect: {
								x: contentArea.x + paraLayout.indentLeft,
								y: cursorY,
								width: contentArea.width - paraLayout.indentLeft - paraLayout.indentRight,
								height: cachedHeight,
							},
							lines: [],
							nodePath: blockPath,
						});
						cursorY = cachedBottom;
						continue;
					}
					// Falls through to full layout if overflow
				}

				const layoutResult = this.layoutParagraph(
					doc,
					block,
					blockPath,
					contentArea,
					cursorY,
					floatingItems,
					currentPageFloats,
				);

				// Store block height in cache
				this._cache?.setCachedBlockHeight(block.id, block, layoutResult.rect.height);
				const blockBottom = layoutResult.rect.y + layoutResult.rect.height;

				if (blockBottom > pageBottom && currentPageBlocks.length > 0) {
					// Try paragraph splitting with widow/orphan control
					const splitResult = this.trySplitParagraph(
						doc,
						block,
						blockPath,
						contentArea,
						cursorY,
						pageBottom,
						floatingItems,
						currentPageFloats,
					);

					if (splitResult) {
						// First part fits on current page
						currentPageBlocks.push(splitResult.firstPart);
						cursorY = splitResult.firstPart.rect.y + splitResult.firstPart.rect.height;
						newPage();
						// Second part goes on new page
						currentPageBlocks.push(splitResult.secondPart);
						cursorY = splitResult.secondPart.rect.y + splitResult.secondPart.rect.height;
					} else {
						// Can't split or keepLines — move entire paragraph
						newPage();
						const reLayouted = this.layoutParagraph(
							doc,
							block,
							blockPath,
							contentArea,
							cursorY,
							floatingItems,
							currentPageFloats,
						);
						currentPageBlocks.push(reLayouted);
						cursorY = reLayouted.rect.y + reLayouted.rect.height;
					}
				} else {
					currentPageBlocks.push(layoutResult);
					cursorY = blockBottom;

					// keepNext: if this paragraph has keepNext and the next block doesn't fit,
					// move both to the next page
					if (block.properties.keepNext && bi + 1 < blockLayouts.length) {
						const nextBlock = blockLayouts[bi + 1].block;
						if (nextBlock.type === 'paragraph') {
							const nextLayout = this.layoutParagraph(
								doc,
								nextBlock,
								blockLayouts[bi + 1].path,
								contentArea,
								cursorY,
								[],
								currentPageFloats,
							);
							const nextBottom = nextLayout.rect.y + nextLayout.rect.height;
							if (nextBottom > pageBottom && currentPageBlocks.length > 1) {
								// Remove the current paragraph from this page and move to next
								currentPageBlocks.pop();
								newPage();
								const reLayouted = this.layoutParagraph(
									doc,
									block,
									blockPath,
									contentArea,
									cursorY,
									floatingItems,
									currentPageFloats,
								);
								currentPageBlocks.push(reLayouted);
								cursorY = reLayouted.rect.y + reLayouted.rect.height;
							}
						}
					}
				}
			} else if (block.type === 'shape' || block.type === 'shape-group') {
				const shape = block as unknown as JPShape | JPShapeGroup;
				const shapeX = contentArea.x + emuToPx(shape.x);
				const shapeY = contentArea.y + emuToPx(shape.y);
				const shapeW = emuToPx(shape.width);
				const shapeH = emuToPx(shape.height);

				const layoutShape: LayoutShape = {
					kind: 'shape',
					rect: { x: shapeX, y: shapeY, width: shapeW, height: shapeH },
					nodePath: blockPath,
					shapeType: block.type === 'shape' ? (shape as JPShape).shapeType : 'rectangle',
					fill: block.type === 'shape' ? (shape as JPShape).fill : undefined,
					stroke: block.type === 'shape' ? (shape as JPShape).stroke : undefined,
					rotation: block.type === 'shape' ? (shape as JPShape).rotation : undefined,
					text: block.type === 'shape' ? (shape as JPShape).text : undefined,
					zIndex: block.type === 'shape' ? (shape as JPShape).zIndex : undefined,
					children:
						block.type === 'shape-group'
							? ((shape as JPShapeGroup).children as readonly JPShape[]).map((child, ci) => ({
									kind: 'shape' as const,
									rect: {
										x: shapeX + emuToPx(child.x),
										y: shapeY + emuToPx(child.y),
										width: emuToPx(child.width),
										height: emuToPx(child.height),
									},
									nodePath: [...blockPath, ci],
									shapeType: child.shapeType,
									fill: child.fill,
									stroke: child.stroke,
									rotation: child.rotation,
									text: child.text,
									zIndex: child.zIndex,
								}))
							: undefined,
				};

				currentPageBlocks.push(layoutShape);
				// Shapes don't advance cursorY (they are positioned absolutely)
			} else if (block.type === 'table') {
				const tableLayout = this.layoutTableBlock(doc, block, blockPath, contentArea, cursorY);

				const blockBottom = tableLayout.y + tableLayout.height;
				if (blockBottom > pageBottom && currentPageBlocks.length > 0) {
					newPage();
					const reLayouted = this.layoutTableBlock(doc, block, blockPath, contentArea, cursorY);
					currentPageBlocks.push(reLayouted);
					cursorY = reLayouted.y + reLayouted.height;
				} else {
					currentPageBlocks.push(tableLayout);
					cursorY = blockBottom;
				}
			}
		}

		// Flush last page
		if (currentPageBlocks.length > 0 || pages.length === 0) {
			newPage();
		}
	}

	/**
	 * Layout a section with multi-column configuration.
	 *
	 * Strategy:
	 * 1. Layout each block using column width (not full content width)
	 *    into a virtual content area starting at y=0.
	 * 2. Collect these "measured" blocks sequentially.
	 * 3. Distribute them across columns using distributeBlocksToColumns.
	 * 4. When all columns are full, emit a page and start fresh.
	 * 5. Handle column-break nodes by flushing to the next column.
	 */
	private layoutSectionMultiColumn(
		doc: JPDocument,
		section: JPSection,
		sectionPath: JPPath,
		pages: LayoutPage[],
	): void {
		const props = section.properties;

		// Build optional layout metadata from section properties
		const mcWatermark: LayoutWatermark | undefined = props.watermark
			? { ...props.watermark }
			: undefined;
		const mcPageBorders: LayoutPageBorders | undefined = props.pageBorders
			? { ...props.pageBorders }
			: undefined;
		const mcLineNumbering: LayoutLineNumbering | undefined = props.lineNumbering
			? {
					start: props.lineNumbering.start,
					countBy: props.lineNumbering.countBy,
					restart: props.lineNumbering.restart,
					distance: twipsToPx(props.lineNumbering.distance),
				}
			: undefined;

		const pageWidth = twipsToPx(props.pageSize.width);
		const pageHeight = twipsToPx(props.pageSize.height);
		const marginTop = twipsToPx(props.margins.top);
		const marginRight = twipsToPx(props.margins.right);
		const marginBottom = twipsToPx(props.margins.bottom);
		const marginLeft = twipsToPx(props.margins.left);
		const headerMargin = twipsToPx(props.margins.header);
		const footerMargin = twipsToPx(props.margins.footer);

		const sectionColumns = props.columns!;
		const columnConfig: ColumnConfig = {
			count: sectionColumns.count,
			space: twipsToPx(sectionColumns.space),
			separator: sectionColumns.separator,
		};

		// Resolve header/footer
		const contentAreaWidth = pageWidth - marginLeft - marginRight;
		const hfLayouts = this.resolveHeaderFooterLayouts(
			doc,
			props.headerReferences,
			props.footerReferences,
			contentAreaWidth,
			headerMargin,
			footerMargin,
			pageHeight,
		);

		const buildContentArea = (pageIndexInSection: number): LayoutRect => {
			const hf = this.pickHeaderFooter(hfLayouts, pageIndexInSection);
			const effectiveTop =
				hf.headerHeight > 0 ? Math.max(marginTop, headerMargin + hf.headerHeight) : marginTop;
			const effectiveBottom =
				hf.footerHeight > 0 ? Math.max(marginBottom, footerMargin + hf.footerHeight) : marginBottom;
			return {
				x: marginLeft,
				y: effectiveTop,
				width: contentAreaWidth,
				height: pageHeight - effectiveTop - effectiveBottom,
			};
		};

		// Calculate column regions
		const columnRegions = calculateColumnRegions(contentAreaWidth, columnConfig);
		const columnWidth = columnRegions[0].width;

		// Build column metadata for pages
		const pageColumnsMetadata: LayoutPageColumns = {
			count: columnConfig.count,
			space: columnConfig.space,
			separator: columnConfig.separator,
			columnWidths: columnRegions.map((r) => r.width),
		};

		// Virtual content area for laying out blocks at column width
		const virtualContentArea: LayoutRect = {
			x: 0,
			y: 0,
			width: columnWidth,
			height: 99999, // unconstrained for measurement
		};

		let pageIndexInSection = 0;
		let contentArea = buildContentArea(pageIndexInSection);

		// Accumulator: blocks laid out sequentially at (0, cursorY) with column width.
		// These will be distributed across columns when a page is emitted.
		let pendingBlocks: LayoutBlock[] = [];
		let virtualCursorY = 0;

		const emitPage = (blocksForPage: LayoutBlock[]): void => {
			const hf = this.pickHeaderFooter(hfLayouts, pageIndexInSection);
			const distributed = distributeBlocksToColumns(blocksForPage, columnRegions, contentArea);

			// Collect all repositioned blocks from all columns
			const allBlocks: LayoutBlock[] = [];
			for (const col of distributed.columns) {
				allBlocks.push(...col.blocks);
			}

			const page: LayoutPage = {
				index: pages.length,
				width: pageWidth,
				height: pageHeight,
				contentArea,
				blocks: allBlocks,
				header: hf.header,
				footer: hf.footer,
				columns: pageColumnsMetadata,
				watermark: mcWatermark,
				pageBorders: mcPageBorders,
				lineNumbering: mcLineNumbering,
			};
			pages.push(page);

			pageIndexInSection++;
			contentArea = buildContentArea(pageIndexInSection);

			// If there's overflow, re-layout overflow blocks for the new page
			if (distributed.overflow.length > 0) {
				// Re-position overflow blocks starting from y=0
				pendingBlocks = [];
				virtualCursorY = 0;
				for (const block of distributed.overflow) {
					const height = getBlockHeightFromBlock(block);
					const repositioned = repositionBlockToY(block, virtualCursorY);
					pendingBlocks.push(repositioned);
					virtualCursorY += height;
				}
			} else {
				pendingBlocks = [];
				virtualCursorY = 0;
			}
		};

		// Check if pending blocks would fill all columns
		const wouldOverflowAllColumns = (): boolean => {
			// Quick estimate: total height of pending blocks vs total available column height
			const contentHeight = contentArea.height;
			const totalColumnHeight = contentHeight * columnConfig.count;
			return virtualCursorY > totalColumnHeight;
		};

		// Pre-compute paragraph layouts for keepNext lookahead
		const blockLayouts: {
			block: JPBlockNode;
			path: JPPath;
			paraLayout?: ResolvedParagraphLayout;
		}[] = [];
		for (let bi = 0; bi < section.children.length; bi++) {
			const block = section.children[bi];
			const blockPath: JPPath = [...sectionPath, bi];
			const paraLayout =
				block.type === 'paragraph'
					? resolveParagraphLayout(doc.styles, block.properties)
					: undefined;
			blockLayouts.push({ block, path: blockPath, paraLayout });
		}

		for (let bi = 0; bi < blockLayouts.length; bi++) {
			const { block, path: blockPath } = blockLayouts[bi];

			// Explicit page break: emit current page with pending blocks
			if (block.type === 'page-break') {
				if (pendingBlocks.length > 0) {
					emitPage(pendingBlocks);
				}
				// If overflow was already handled by emitPage, pendingBlocks may have content
				// from overflow. That's fine, it'll go on the new page.
				continue;
			}

			// pageBreakBefore
			if (
				block.type === 'paragraph' &&
				block.properties.pageBreakBefore &&
				pendingBlocks.length > 0
			) {
				emitPage(pendingBlocks);
			}

			if (block.type === 'paragraph') {
				const layoutResult = this.layoutParagraph(
					doc,
					block,
					blockPath,
					{ ...virtualContentArea, y: virtualCursorY },
					virtualCursorY,
					[], // no floats in multi-column for now
				);

				// Check if paragraph contains a column-break child
				const hasColumnBreak = block.children.some((c) => c.type === 'column-break');
				const finalBlock = hasColumnBreak
					? { ...layoutResult, columnBreakAfter: true }
					: layoutResult;

				pendingBlocks.push(finalBlock);
				virtualCursorY = layoutResult.rect.y + layoutResult.rect.height;

				// Check if we've accumulated enough to fill all columns
				if (wouldOverflowAllColumns()) {
					emitPage(pendingBlocks);
				}
			} else if (block.type === 'table') {
				const tableLayout = this.layoutTableBlock(
					doc,
					block,
					blockPath,
					{ ...virtualContentArea, y: virtualCursorY },
					virtualCursorY,
				);

				pendingBlocks.push(tableLayout);
				virtualCursorY = tableLayout.y + tableLayout.height;

				if (wouldOverflowAllColumns()) {
					emitPage(pendingBlocks);
				}
			}
		}

		// Flush remaining blocks
		if (pendingBlocks.length > 0 || pages.length === 0) {
			emitPage(pendingBlocks);
		}
	}

	/**
	 * Try to split a paragraph across pages, respecting widow/orphan control.
	 */
	private trySplitParagraph(
		doc: JPDocument,
		paragraph: JPParagraph,
		paragraphPath: JPPath,
		contentArea: LayoutRect,
		startY: number,
		pageBottom: number,
		floatingItems: FloatingItem[],
		pageFloats?: PositionedFloat[],
	): { firstPart: LayoutParagraph; secondPart: LayoutParagraph } | null {
		// If keepLines is set, don't split
		if (paragraph.properties.keepLines) return null;

		const full = this.layoutParagraph(
			doc,
			paragraph,
			paragraphPath,
			contentArea,
			startY,
			floatingItems,
			pageFloats,
		);
		const lines = full.lines;
		if (lines.length <= 1) return null;

		// Find the split point: last line that fits
		// line.rect.y is block-relative, convert to absolute for comparison with pageBottom
		let splitAfter = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineBottom = full.rect.y + lines[i].rect.y + lines[i].rect.height;
			if (lineBottom > pageBottom) break;
			splitAfter = i + 1;
		}

		if (splitAfter === 0) return null; // No line fits
		if (splitAfter === lines.length) return null; // All lines fit (shouldn't happen)

		// Widow/orphan control (default enabled)
		const widowControl = paragraph.properties.widowControl !== false;
		if (widowControl) {
			const linesOnFirstPage = splitAfter;
			const linesOnSecondPage = lines.length - splitAfter;

			// Orphan: at least 2 lines on first page
			if (linesOnFirstPage < 2) return null;

			// Widow: at least 2 lines on second page
			if (linesOnSecondPage < 2 && splitAfter > 1) {
				splitAfter = splitAfter - 1;
			}

			// Re-check after adjustment
			if (splitAfter < 2) return null;
			if (lines.length - splitAfter < 2) return null;
		}

		// Build first part (lines on current page)
		// line.rect.y is block-relative, so height from block start = line.rect.y + line.rect.height
		const firstLines = lines.slice(0, splitAfter);
		const lastFirstLine = firstLines[firstLines.length - 1];
		const firstHeight = lastFirstLine.rect.y + lastFirstLine.rect.height;

		const firstPart: LayoutParagraph = {
			rect: { ...full.rect, height: firstHeight },
			lines: firstLines,
			nodePath: paragraphPath,
			...(full.outlineLevel !== undefined ? { outlineLevel: full.outlineLevel } : {}),
		};

		// Build second part (lines on next page)
		// line.rect.y is block-relative; rebase so first line starts at Y=0 relative to new block
		const secondLines = lines.slice(splitAfter);
		const lineYOffset = -secondLines[0].rect.y;
		const repositionedLines = secondLines.map((line, i) => ({
			...line,
			rect: { ...line.rect, y: line.rect.y + lineYOffset },
			lineIndex: i,
			fragments: line.fragments.map((f) => ({
				...f,
				rect: { ...f.rect, y: f.rect.y + lineYOffset },
			})),
		}));

		const secondLastLine = repositionedLines[repositionedLines.length - 1];
		const secondHeight = secondLastLine.rect.y + secondLastLine.rect.height;

		const secondPart: LayoutParagraph = {
			rect: {
				x: full.rect.x,
				y: contentArea.y,
				width: full.rect.width,
				height: secondHeight,
			},
			lines: repositionedLines,
			nodePath: paragraphPath,
			...(full.outlineLevel !== undefined ? { outlineLevel: full.outlineLevel } : {}),
		};

		return { firstPart, secondPart };
	}

	private layoutTableBlock(
		doc: JPDocument,
		table: JPTable,
		tablePath: JPPath,
		contentArea: LayoutRect,
		startY: number,
	): LayoutTable {
		const tableIndent = table.properties.indent ? twipsToPx(table.properties.indent) : 0;
		const startX = contentArea.x + tableIndent;
		const availableWidth = contentArea.width - tableIndent;

		return layoutTable(
			table,
			tablePath,
			availableWidth,
			startX,
			startY,
			doc.styles,
			this.measurer,
			(cell, cellPath, contentWidthPx, _styles) => {
				// Layout cell content: paragraphs and nested tables
				let y = 0;
				const blocks: LayoutBlock[] = [];

				for (let ci = 0; ci < cell.children.length; ci++) {
					const child = cell.children[ci];
					const childPath: JPPath = [...cellPath, ci];

					if (child.type === 'paragraph') {
						const cellContentArea: LayoutRect = {
							x: 0,
							y: 0,
							width: contentWidthPx,
							height: 99999, // unconstrained
						};
						const para = this.layoutParagraph(doc, child, childPath, cellContentArea, y, []);
						blocks.push(para);
						y = para.rect.y + para.rect.height;
					} else if (child.type === 'table') {
						const nestedTable = this.layoutTableBlock(
							doc,
							child,
							childPath,
							{ x: 0, y: 0, width: contentWidthPx, height: 99999 },
							y,
						);
						blocks.push(nestedTable);
						y = nestedTable.y + nestedTable.height;
					}
				}

				return { blocks, height: y };
			},
		);
	}

	private layoutParagraph(
		doc: JPDocument,
		paragraph: JPParagraph,
		paragraphPath: JPPath,
		contentArea: LayoutRect,
		startY: number,
		floatingItems: FloatingItem[],
		pageFloats?: PositionedFloat[],
	): LayoutParagraph {
		let paraLayout = resolveParagraphLayout(doc.styles, paragraph.properties);

		// Collect inline items from runs, handling all node types
		const items = this.collectInlineItems(doc.styles, paragraph, paragraphPath, floatingItems, doc);

		// Handle list numbering: prepend marker and override indent
		const numbering = paragraph.properties.numbering;
		if (numbering) {
			const { numId, level } = numbering;

			// Resolve numbering level from registry or use defaults
			const numLevel =
				resolveNumberingLevel(doc.numbering, numId, level) ??
				this.getDefaultNumberingLevel(numId, level);

			// When switching to a different numId, reset all counters
			if (this.lastNumberingNumId !== null && this.lastNumberingNumId !== numId) {
				this.numberingCounters.clear();
			}

			// Reset higher-level counters when returning to a lower level
			for (let l = level + 1; l <= 8; l++) {
				this.numberingCounters.delete(`${numId}-${l}`);
			}

			// Generate marker text
			const markerText = this.getMarkerText(numLevel, numId, level);
			this.lastNumberingNumId = numId;

			// Override paragraph indent with numbering level indent
			const numIndentLeft = twipsToPx(numLevel.indent);
			const numHanging = twipsToPx(numLevel.hangingIndent);
			paraLayout = {
				...paraLayout,
				indentLeft: Math.max(paraLayout.indentLeft, numIndentLeft),
				indentFirstLine: -numHanging,
			};

			// Create marker style from paragraph's default run style
			const markerBaseStyle = resolveRunStyle(doc.styles, paragraph.properties, {});
			const markerStyle = numLevel.font
				? { ...markerBaseStyle, fontFamily: numLevel.font }
				: markerBaseStyle;

			// Prepend marker as the first inline item
			items.unshift({
				text: `${markerText}\t`,
				style: markerStyle,
				runPath: paragraphPath,
				runOffset: -1,
			});
		} else {
			// Non-list paragraph: reset counters to break list sequences
			if (this.lastNumberingNumId !== null) {
				this.numberingCounters.clear();
				this.lastNumberingNumId = null;
			}
		}

		const availableWidth = contentArea.width - paraLayout.indentLeft - paraLayout.indentRight;
		const relativeY = paraLayout.spaceBefore;

		const contentLeft = contentArea.x + paraLayout.indentLeft;
		const contentRight = contentArea.x + contentArea.width - paraLayout.indentRight;

		// Translate float Y coordinates from absolute to block-relative
		const relativeFloats = pageFloats?.map((f) => ({ ...f, y: f.y - startY }));

		const lines = breakIntoLines(
			items,
			this.measurer,
			availableWidth,
			paraLayout.indentFirstLine,
			paraLayout.alignment,
			paraLayout.lineSpacing,
			paragraphPath,
			relativeY,
			relativeFloats,
			contentLeft,
			contentRight,
			paragraph.properties.direction,
		);

		const totalLinesHeight =
			lines.length > 0
				? lines[lines.length - 1].rect.y + lines[lines.length - 1].rect.height - relativeY
				: 0;
		const totalHeight = paraLayout.spaceBefore + totalLinesHeight + paraLayout.spaceAfter;

		// Resolve outlineLevel from merged paragraph properties (style + direct)
		let resolvedOutlineLevel: number | undefined = paragraph.properties.outlineLevel;
		if (resolvedOutlineLevel === undefined && paragraph.properties.styleId) {
			const mergedParaProps = resolveStyleParagraphProperties(
				doc.styles,
				paragraph.properties.styleId,
			);
			resolvedOutlineLevel = mergedParaProps.outlineLevel;
		}

		const result: LayoutParagraph = {
			rect: {
				x: contentArea.x + paraLayout.indentLeft,
				y: startY,
				width: availableWidth,
				height: totalHeight,
			},
			lines,
			nodePath: paragraphPath,
			...(resolvedOutlineLevel !== undefined && resolvedOutlineLevel >= 0
				? { outlineLevel: resolvedOutlineLevel }
				: {}),
		};
		return result;
	}

	private collectInlineItems(
		styles: JPStyleRegistry,
		paragraph: JPParagraph,
		paragraphPath: JPPath,
		floatingItems: FloatingItem[],
		_doc: JPDocument,
	): InlineItem[] {
		const items: InlineItem[] = [];

		for (let ri = 0; ri < paragraph.children.length; ri++) {
			const child = paragraph.children[ri];
			const childPath: JPPath = [...paragraphPath, ri];

			switch (child.type) {
				case 'run':
					this.collectRunItems(styles, paragraph, child as JPRun, childPath, items);
					break;

				case 'drawing': {
					const drawing = child as JPDrawing;
					// Guard against malformed drawings with missing children
					if (!(drawing.children as readonly unknown[])?.length) break;
					const image = drawing.children[0];
					if (!image?.properties) break;
					if (drawing.properties.positioning === 'floating' && drawing.properties.floating) {
						// Collect for float layout
						floatingItems.push({
							nodeId: drawing.id,
							imageNodeId: image.id,
							imagePath: [...childPath, 0],
							src: image.properties.src,
							mimeType: image.properties.mimeType,
							widthPx: emuToPx(image.properties.width),
							heightPx: emuToPx(image.properties.height),
							drawingProps: drawing.properties,
							anchorParagraphY: 0, // Will be set during page layout
						});
					} else {
						// Inline image — add as a special inline item
						const widthPx = emuToPx(image.properties.width);
						const heightPx = emuToPx(image.properties.height);
						items.push({
							text: '\uFFFC', // object replacement character
							style: resolveRunStyle(styles, paragraph.properties, {}),
							runPath: childPath,
							runOffset: 0,
							inlineImage: {
								src: image.properties.src,
								width: widthPx,
								height: heightPx,
								nodeId: drawing.id,
								crop: image.properties.crop,
								rotation: image.properties.rotation,
								flipH: image.properties.flipH,
								flipV: image.properties.flipV,
							},
						});
					}
					break;
				}

				case 'hyperlink': {
					const hyperlink = child as JPHyperlink;
					const startIdx = items.length;
					for (let hi = 0; hi < hyperlink.children.length; hi++) {
						const hRun = hyperlink.children[hi];
						const hRunPath: JPPath = [...childPath, hi];
						this.collectRunItems(styles, paragraph, hRun, hRunPath, items);
					}
					// Patch style for hyperlinks: blue color + underline, and attach href
					for (let i = startIdx; i < items.length; i++) {
						items[i] = {
							...items[i],
							style: { ...items[i].style, color: '#1a73e8', underline: 'single' },
							href: hyperlink.href,
						};
					}
					break;
				}

				case 'line-break':
					items.push({
						text: '\n',
						style: resolveRunStyle(styles, paragraph.properties, {}),
						runPath: childPath,
						runOffset: 0,
					});
					break;

				case 'tab':
					items.push({
						text: '\t',
						style: resolveRunStyle(styles, paragraph.properties, {}),
						runPath: childPath,
						runOffset: 0,
					});
					break;

				case 'field': {
					const field = child as JPField;
					const displayText = field.cachedResult || '\u00A0';
					const baseStyle = resolveRunStyle(styles, paragraph.properties, {});
					items.push({
						text: displayText,
						style: { ...baseStyle, backgroundColor: '#e8eaed' },
						runPath: childPath,
						runOffset: 0,
					});
					break;
				}

				case 'footnote-ref': {
					const fnRef = child as JPFootnoteRef;
					const fnNum = this.getFootnoteDisplayNumber(_doc, fnRef.footnoteId);
					const fnStyle = resolveRunStyle(styles, paragraph.properties, {});
					items.push({
						text: String(fnNum),
						style: {
							...fnStyle,
							superscript: true,
							fontSize: fnStyle.fontSize * 0.65,
							color: '#1a73e8',
						},
						runPath: childPath,
						runOffset: 0,
					});
					break;
				}

				case 'endnote-ref': {
					const enRef = child as JPEndnoteRef;
					const enNum = this.getFootnoteDisplayNumber(_doc, enRef.footnoteId, true);
					const enStyle = resolveRunStyle(styles, paragraph.properties, {});
					items.push({
						text: String(enNum),
						style: {
							...enStyle,
							superscript: true,
							fontSize: enStyle.fontSize * 0.65,
							color: '#1a73e8',
						},
						runPath: childPath,
						runOffset: 0,
					});
					break;
				}

				case 'mention': {
					const mention = child as JPMention;
					const baseStyle = resolveRunStyle(styles, paragraph.properties, {});
					items.push({
						text: `@${mention.label}`,
						style: { ...baseStyle, color: '#1a73e8', backgroundColor: '#e8f0fe' },
						runPath: childPath,
						runOffset: 0,
					});
					break;
				}

				case 'equation': {
					const eq = child as JPEquation;
					const baseStyle = resolveRunStyle(styles, paragraph.properties, {});
					const eqText = this.getEquationDisplayText(eq.latex);
					items.push({
						text: eqText,
						style: { ...baseStyle, fontFamily: 'Cambria Math' },
						runPath: childPath,
						runOffset: 0,
					});
					break;
				}

				// bookmark-start, bookmark-end, column-break, comment-range: zero-width, skip
				default:
					break;
			}
		}

		return items;
	}

	/**
	 * Convert LaTeX to a simplified display string for measurement.
	 * Replaces common LaTeX commands with their Unicode equivalents.
	 */
	private getEquationDisplayText(latex: string): string {
		// Map of common LaTeX commands to Unicode display
		const symbolMap: Record<string, string> = {
			'\\frac': '/',
			'\\sqrt': '\u221A',
			'\\sum': '\u2211',
			'\\prod': '\u220F',
			'\\int': '\u222B',
			'\\infty': '\u221E',
			'\\alpha': '\u03B1',
			'\\beta': '\u03B2',
			'\\gamma': '\u03B3',
			'\\delta': '\u03B4',
			'\\pi': '\u03C0',
			'\\theta': '\u03B8',
			'\\lambda': '\u03BB',
			'\\sigma': '\u03C3',
			'\\pm': '\u00B1',
			'\\times': '\u00D7',
			'\\div': '\u00F7',
			'\\leq': '\u2264',
			'\\geq': '\u2265',
			'\\neq': '\u2260',
			'\\approx': '\u2248',
			'\\rightarrow': '\u2192',
			'\\leftarrow': '\u2190',
			'\\Rightarrow': '\u21D2',
			'\\partial': '\u2202',
			'\\nabla': '\u2207',
			'\\forall': '\u2200',
			'\\exists': '\u2203',
			'\\in': '\u2208',
			'\\cup': '\u222A',
			'\\cap': '\u2229',
		};
		let text = latex;
		for (const [cmd, sym] of Object.entries(symbolMap)) {
			text = text.split(cmd).join(sym);
		}
		// Remove remaining LaTeX control chars
		text = text.replace(/[\\{}^_]/g, '');
		return text || '\u00A0';
	}

	private collectRunItems(
		styles: JPStyleRegistry,
		paragraph: JPParagraph,
		run: JPRun,
		runPath: JPPath,
		items: InlineItem[],
	): void {
		const style = resolveRunStyle(styles, paragraph.properties, run.properties);
		for (let ti = 0; ti < run.children.length; ti++) {
			const textChild = run.children[ti];
			if (isText(textChild)) {
				const textPath: JPPath = [...runPath, ti];
				items.push({
					text: textChild.text,
					style,
					runPath: textPath,
					runOffset: 0,
				});
			}
		}
	}

	/**
	 * Calculate display number for a footnote/endnote reference by counting
	 * refs in document order.
	 */
	private getFootnoteDisplayNumber(doc: JPDocument, footnoteId: string, isEndnote = false): number {
		const refs = isEndnote ? (doc.endnotes ?? []) : (doc.footnotes ?? []);
		for (let i = 0; i < refs.length; i++) {
			if (refs[i].id === footnoteId) return i + 1;
		}
		return 1;
	}

	/**
	 * Layout footnotes referenced on the current page.
	 * Collects footnote-ref IDs from blocks, finds their content in doc.footnotes,
	 * and lays out the footnote paragraphs at the bottom of the content area.
	 */
	private layoutFootnotesForPage(
		doc: JPDocument,
		blocks: readonly LayoutBlock[],
		contentArea: LayoutRect,
		_cursorY: number,
	): LayoutFootnoteArea | undefined {
		if (!doc.footnotes || doc.footnotes.length === 0) return undefined;

		// Collect footnote IDs referenced in this page's blocks
		// by scanning document nodes under each block's path
		const referencedIds = new Set<string>();
		for (const block of blocks) {
			if (!isLayoutParagraph(block)) continue;
			const para = this.getNodeAtPath(doc, block.nodePath) as
				| { type?: string; children?: readonly unknown[] }
				| undefined;
			if (!para || para.type !== 'paragraph') continue;
			for (const child of (para as JPParagraph).children) {
				if (child.type === 'footnote-ref') {
					referencedIds.add((child as JPFootnoteRef).footnoteId);
				}
				if (child.type === 'run') {
					// Runs don't contain footnote-refs
				}
				if (child.type === 'hyperlink') {
					for (const hChild of (
						child as { children: readonly { type: string; footnoteId?: string }[] }
					).children) {
						if (hChild.type === 'footnote-ref' && hChild.footnoteId) {
							referencedIds.add(hChild.footnoteId);
						}
					}
				}
			}
		}

		if (referencedIds.size === 0) return undefined;

		// Find footnote bodies in document order
		const footnotesToLayout = doc.footnotes.filter((fn) => referencedIds.has(fn.id));
		if (footnotesToLayout.length === 0) return undefined;

		// First pass: compute total footnote height
		const separatorGap = 8;
		const separatorHeight = 1;
		const separatorGapBelow = 4;
		const footnoteIndent = 20;

		// Pre-layout footnotes to measure total height
		const preBlocks: Array<{
			lines: readonly {
				rect: LayoutRect;
				baseline: number;
				fragments: readonly unknown[];
				paragraphPath: JPPath;
				lineIndex: number;
			}[];
			height: number;
		}> = [];
		let totalContentHeight = 0;

		for (let fi = 0; fi < footnotesToLayout.length; fi++) {
			const fn = footnotesToLayout[fi];
			const fnNum = this.getFootnoteDisplayNumber(doc, fn.id);

			for (const para of fn.content) {
				const style = resolveRunStyle(doc.styles, para.properties, {});
				const smallStyle = { ...style, fontSize: style.fontSize * 0.85 };

				const isFirst = preBlocks.length === fi;
				const items: InlineItem[] = [];
				if (isFirst) {
					items.push({
						text: `${fnNum}. `,
						style: { ...smallStyle, superscript: true, fontSize: smallStyle.fontSize * 0.75 },
						runPath: [],
						runOffset: 0,
					});
				}

				for (const child of para.children) {
					if (child.type === 'run') {
						const run = child as JPRun;
						const runStyle = resolveRunStyle(doc.styles, para.properties, run.properties);
						const fnRunStyle = { ...runStyle, fontSize: runStyle.fontSize * 0.85 };
						for (const leaf of run.children) {
							if (isText(leaf)) {
								items.push({
									text: (leaf as unknown as { text: string }).text,
									style: fnRunStyle,
									runPath: [],
									runOffset: 0,
								});
							}
						}
					}
				}

				if (items.length === 0) continue;

				const availWidth = contentArea.width - footnoteIndent;
				const lines = breakIntoLines(items, this.measurer, availWidth, 0, 'left', 1.15, [], 0);

				let h = 0;
				for (const line of lines) h += line.rect.height;
				preBlocks.push({ lines, height: h });
				totalContentHeight += h;
			}
		}

		if (preBlocks.length === 0) return undefined;

		const totalFootnoteHeight =
			separatorGap + separatorHeight + separatorGapBelow + totalContentHeight;
		const footnoteAreaTop = contentArea.y + contentArea.height - totalFootnoteHeight;
		const separatorY = footnoteAreaTop + separatorGap;
		const contentStartY = separatorY + separatorHeight + separatorGapBelow;

		// Second pass: build final blocks with page-absolute coordinates
		const footnoteBlocks: LayoutBlock[] = [];
		let blockY = contentStartY;

		for (const pre of preBlocks) {
			let lineY = 0;
			const finalLines = pre.lines.map((line, li) => {
				const finalLine = {
					...line,
					rect: {
						x: footnoteIndent,
						y: lineY,
						width: contentArea.width - footnoteIndent,
						height: line.rect.height,
					},
					lineIndex: li,
				};
				lineY += line.rect.height;
				return finalLine;
			});

			footnoteBlocks.push({
				rect: {
					x: contentArea.x,
					y: blockY,
					width: contentArea.width,
					height: pre.height,
				},
				lines: finalLines,
				nodePath: [],
			} as LayoutParagraph);
			blockY += pre.height;
		}

		return {
			rect: {
				x: contentArea.x,
				y: footnoteAreaTop,
				width: contentArea.width,
				height: totalFootnoteHeight,
			},
			blocks: footnoteBlocks,
			separatorY,
		};
	}

	/**
	 * Get a node at a given path in the document tree.
	 */
	private getNodeAtPath(doc: JPDocument, path: JPPath): unknown {
		let node: unknown = doc;
		for (const idx of path) {
			const n = node as { children?: readonly unknown[] };
			if (!n.children || idx >= n.children.length) return undefined;
			node = n.children[idx];
		}
		return node;
	}

	getMeasurer(): TextMeasurer {
		return this.measurer;
	}

	// ── List Numbering Helpers ────────────────────────────────────────────────

	/** Default numbering level definitions for built-in lists (when registry is empty). */
	private getDefaultNumberingLevel(numId: number, level: number): JPNumberingLevel {
		const BULLET_NUM_ID = 1;
		const bulletChars = ['\u2022', '\u25E6', '\u25AA']; // •, ◦, ▪
		const numberFormats: JPNumberFormat[] = ['decimal', 'lowerLetter', 'lowerRoman'];
		const baseIndent = 720; // twips per level
		const hanging = 360; // twips

		if (numId === BULLET_NUM_ID) {
			return {
				level,
				format: 'bullet',
				text: bulletChars[level % bulletChars.length],
				alignment: 'left',
				indent: baseIndent * (level + 1),
				hangingIndent: hanging,
			};
		}
		// Numbered list (numId=2 or any other)
		const format = numberFormats[level % numberFormats.length];
		return {
			level,
			format,
			text: `%${level + 1}.`,
			alignment: 'left',
			indent: baseIndent * (level + 1),
			hangingIndent: hanging,
		};
	}

	/** Generate the display text for a list marker (e.g. "•", "1.", "a."). */
	private getMarkerText(numLevel: JPNumberingLevel, numId: number, level: number): string {
		if (numLevel.format === 'bullet') {
			return numLevel.text || '\u2022';
		}

		// Increment and get the counter for this numId+level
		const key = `${numId}-${level}`;
		const current = (this.numberingCounters.get(key) ?? 0) + 1;
		this.numberingCounters.set(key, current);

		const start = numLevel.start ?? 1;
		const value = start + current - 1;

		return this.formatNumberValue(value, numLevel.format, numLevel.text);
	}

	/** Format a number value according to the numbering format. */
	private formatNumberValue(value: number, format: JPNumberFormat, textPattern?: string): string {
		let formatted: string;
		switch (format) {
			case 'decimal':
				formatted = String(value);
				break;
			case 'lowerLetter':
				formatted = String.fromCharCode(96 + ((value - 1) % 26) + 1); // a-z
				break;
			case 'upperLetter':
				formatted = String.fromCharCode(64 + ((value - 1) % 26) + 1); // A-Z
				break;
			case 'lowerRoman':
				formatted = this.toRoman(value).toLowerCase();
				break;
			case 'upperRoman':
				formatted = this.toRoman(value);
				break;
			default:
				formatted = String(value);
				break;
		}

		// Apply text pattern if present (e.g. "%1." → "1.")
		if (textPattern) {
			return textPattern.replace(/%\d+/g, formatted);
		}
		return `${formatted}.`;
	}

	/** Convert a number to Roman numeral string. */
	private toRoman(num: number): string {
		const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
		const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
		let result = '';
		let remaining = num;
		for (let i = 0; i < vals.length; i++) {
			while (remaining >= vals[i]) {
				result += syms[i];
				remaining -= vals[i];
			}
		}
		return result;
	}

	// ── Header/Footer Layout Helpers ─────────────────────────────────────────

	/** Pre-computed header/footer layouts for a section. */
	private resolveHeaderFooterLayouts(
		doc: JPDocument,
		headerRefs: readonly JPHeaderFooterRef[] | undefined,
		footerRefs: readonly JPHeaderFooterRef[] | undefined,
		contentWidth: number,
		headerMarginPx: number,
		footerMarginPx: number,
		pageHeightPx: number,
	): HeaderFooterLayouts {
		const result: HeaderFooterLayouts = {
			defaultHeader: undefined,
			firstHeader: undefined,
			evenHeader: undefined,
			defaultFooter: undefined,
			firstFooter: undefined,
			evenFooter: undefined,
		};

		if (headerRefs) {
			for (const ref of headerRefs) {
				const node = doc.headers.get(ref.id);
				if (!node) continue;
				const layout = this.layoutHeaderFooterContent(
					doc.styles,
					node.children,
					contentWidth,
					headerMarginPx,
				);
				if (ref.type === 'default') result.defaultHeader = layout;
				else if (ref.type === 'first') result.firstHeader = layout;
				else if (ref.type === 'even') result.evenHeader = layout;
			}
		}

		if (footerRefs) {
			for (const ref of footerRefs) {
				const node = doc.footers.get(ref.id);
				if (!node) continue;
				const layout = this.layoutFooterContent(
					doc.styles,
					node.children,
					contentWidth,
					footerMarginPx,
					pageHeightPx,
				);
				if (ref.type === 'default') result.defaultFooter = layout;
				else if (ref.type === 'first') result.firstFooter = layout;
				else if (ref.type === 'even') result.evenFooter = layout;
			}
		}

		return result;
	}

	/** Pick the right header/footer for a given page index within a section. */
	private pickHeaderFooter(
		layouts: HeaderFooterLayouts,
		pageIndexInSection: number,
	): {
		header?: LayoutHeaderFooter;
		footer?: LayoutHeaderFooter;
		headerHeight: number;
		footerHeight: number;
	} {
		let header: LayoutHeaderFooter | undefined;
		let footer: LayoutHeaderFooter | undefined;

		if (pageIndexInSection === 0 && layouts.firstHeader) {
			header = layouts.firstHeader;
		} else if (pageIndexInSection > 0 && pageIndexInSection % 2 === 1 && layouts.evenHeader) {
			header = layouts.evenHeader;
		} else {
			header = layouts.defaultHeader;
		}

		if (pageIndexInSection === 0 && layouts.firstFooter) {
			footer = layouts.firstFooter;
		} else if (pageIndexInSection > 0 && pageIndexInSection % 2 === 1 && layouts.evenFooter) {
			footer = layouts.evenFooter;
		} else {
			footer = layouts.defaultFooter;
		}

		return {
			header,
			footer,
			headerHeight: header ? header.rect.height : 0,
			footerHeight: footer ? footer.rect.height : 0,
		};
	}

	/** Layout header content starting at headerMarginPx from top edge. */
	private layoutHeaderFooterContent(
		styles: JPStyleRegistry,
		content: readonly JPHeaderFooterContent[],
		contentWidth: number,
		startY: number,
	): LayoutHeaderFooter {
		const area: LayoutRect = { x: 0, y: 0, width: contentWidth, height: 99999 };
		const blocks: LayoutBlock[] = [];
		let y = 0;

		for (const child of content) {
			if (child.type === 'paragraph') {
				const para = this.layoutParagraphSimple(styles, child, area, y);
				blocks.push(para);
				y = para.rect.y + para.rect.height;
			}
		}

		return {
			rect: { x: 0, y: startY, width: contentWidth, height: y },
			blocks,
		};
	}

	/** Layout footer content, positioned from the bottom of the page. */
	private layoutFooterContent(
		styles: JPStyleRegistry,
		content: readonly JPHeaderFooterContent[],
		contentWidth: number,
		footerMarginPx: number,
		pageHeightPx: number,
	): LayoutHeaderFooter {
		// First, compute the total height needed
		const area: LayoutRect = { x: 0, y: 0, width: contentWidth, height: 99999 };
		const blocks: LayoutBlock[] = [];
		let y = 0;

		for (const child of content) {
			if (child.type === 'paragraph') {
				const para = this.layoutParagraphSimple(styles, child, area, y);
				blocks.push(para);
				y = para.rect.y + para.rect.height;
			}
		}

		// Position from bottom: footer starts at pageHeight - footerMargin - totalHeight
		const footerY = pageHeightPx - footerMarginPx - y;

		return {
			rect: { x: 0, y: footerY, width: contentWidth, height: y },
			blocks,
		};
	}

	/** Simplified paragraph layout for header/footer content (no floats, no path tracking). */
	private layoutParagraphSimple(
		styles: JPStyleRegistry,
		paragraph: JPParagraph,
		contentArea: LayoutRect,
		startY: number,
	): LayoutParagraph {
		const paraLayout = resolveParagraphLayout(styles, paragraph.properties);
		const dummyPath: JPPath = [];
		const items: InlineItem[] = [];

		for (let ri = 0; ri < paragraph.children.length; ri++) {
			const child = paragraph.children[ri];
			if (child.type === 'run') {
				const style = resolveRunStyle(styles, paragraph.properties, (child as JPRun).properties);
				let offset = 0;
				for (const textChild of (child as JPRun).children) {
					if (isText(textChild)) {
						items.push({ text: textChild.text, style, runPath: dummyPath, runOffset: offset });
						offset += textChild.text.length;
					}
				}
			}
		}

		const availableWidth = contentArea.width - paraLayout.indentLeft - paraLayout.indentRight;
		const relativeY = paraLayout.spaceBefore;

		const lines = breakIntoLines(
			items,
			this.measurer,
			availableWidth,
			paraLayout.indentFirstLine,
			paraLayout.alignment,
			paraLayout.lineSpacing,
			dummyPath,
			relativeY,
			undefined,
			undefined,
			undefined,
			paragraph.properties.direction,
		);

		const totalLinesHeight =
			lines.length > 0
				? lines[lines.length - 1].rect.y + lines[lines.length - 1].rect.height - relativeY
				: 0;
		const totalHeight = paraLayout.spaceBefore + totalLinesHeight + paraLayout.spaceAfter;

		return {
			rect: {
				x: contentArea.x + paraLayout.indentLeft,
				y: startY,
				width: availableWidth,
				height: totalHeight,
			},
			lines,
			nodePath: dummyPath,
		};
	}
}

/** Pre-computed header/footer layouts per type. */
interface HeaderFooterLayouts {
	defaultHeader?: LayoutHeaderFooter;
	firstHeader?: LayoutHeaderFooter;
	evenHeader?: LayoutHeaderFooter;
	defaultFooter?: LayoutHeaderFooter;
	firstFooter?: LayoutHeaderFooter;
	evenFooter?: LayoutHeaderFooter;
}

// ── Multi-column layout helpers ─────────────────────────────────────────────

/** Get the height of a layout block. */
function getBlockHeightFromBlock(block: LayoutBlock): number {
	if (isLayoutParagraph(block)) {
		return block.rect.height;
	}
	if (isLayoutTable(block)) {
		return block.height;
	}
	// LayoutImage
	return block.rect.height;
}

/**
 * Reposition a block to start at a new Y coordinate, preserving its relative
 * internal structure. Used when re-flowing overflow blocks to a new page.
 */
function repositionBlockToY(block: LayoutBlock, newY: number): LayoutBlock {
	if (isLayoutParagraph(block)) {
		// line.rect.y and fragment.rect.y are block-relative, no adjustment needed
		return {
			...block,
			rect: { ...block.rect, y: newY },
		};
	}

	if (isLayoutTable(block)) {
		const yDelta = newY - block.y;
		return {
			...block,
			y: newY,
			rows: block.rows.map((row) => ({
				...row,
				y: row.y + yDelta,
				cells: row.cells.map((cell) => ({
					...cell,
					y: cell.y + yDelta,
					contentRect: { ...cell.contentRect, y: cell.contentRect.y + yDelta },
				})),
			})),
		};
	}

	// LayoutImage
	return {
		...block,
		rect: { ...block.rect, y: newY },
	};
}
