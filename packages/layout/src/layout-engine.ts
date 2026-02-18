import type {
	JPBlockNode,
	JPDocument,
	JPDrawing,
	JPHeaderFooterContent,
	JPHeaderFooterRef,
	JPHyperlink,
	JPParagraph,
	JPPath,
	JPRun,
	JPSection,
	JPStyleRegistry,
	JPTable,
} from '@jpoffice/model';
import { emuToPx, isText, twipsToPx } from '@jpoffice/model';
import type { LayoutCache } from './cache';
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
	LayoutHeaderFooter,
	LayoutPage,
	LayoutParagraph,
	LayoutRect,
	LayoutResult,
	LayoutTable,
} from './types';

/**
 * The layout engine transforms a JPDocument into a LayoutResult.
 * It processes sections, paragraphs, tables, and images,
 * computing precise positions for every element.
 */
export class LayoutEngine {
	private measurer: TextMeasurer;
	private version = 0;
	private _cache: LayoutCache | null = null;

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

			const page: LayoutPage = {
				index: pages.length,
				width: pageWidth,
				height: pageHeight,
				contentArea,
				blocks: currentPageBlocks,
				floats: positioned.length > 0 ? positioned : undefined,
				header: hf.header,
				footer: hf.footer,
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
		let splitAfter = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineBottom = lines[i].rect.y + lines[i].rect.height;
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
		const firstLines = lines.slice(0, splitAfter);
		const lastFirstLine = firstLines[firstLines.length - 1];
		const firstHeight = lastFirstLine.rect.y + lastFirstLine.rect.height - full.rect.y;

		const firstPart: LayoutParagraph = {
			rect: { ...full.rect, height: firstHeight },
			lines: firstLines,
			nodePath: paragraphPath,
		};

		// Build second part (lines on next page)
		const secondLines = lines.slice(splitAfter);
		const lineYOffset = contentArea.y - secondLines[0].rect.y;
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
		const secondHeight = secondLastLine.rect.y + secondLastLine.rect.height - contentArea.y;

		const secondPart: LayoutParagraph = {
			rect: {
				x: full.rect.x,
				y: contentArea.y,
				width: full.rect.width,
				height: secondHeight,
			},
			lines: repositionedLines,
			nodePath: paragraphPath,
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
		const paraLayout = resolveParagraphLayout(doc.styles, paragraph.properties);

		// Collect inline items from runs, handling all node types
		const items = this.collectInlineItems(doc.styles, paragraph, paragraphPath, floatingItems, doc);

		const availableWidth = contentArea.width - paraLayout.indentLeft - paraLayout.indentRight;
		const y = startY + paraLayout.spaceBefore;

		const contentLeft = contentArea.x + paraLayout.indentLeft;
		const contentRight = contentArea.x + contentArea.width - paraLayout.indentRight;

		const lines = breakIntoLines(
			items,
			this.measurer,
			availableWidth,
			paraLayout.indentFirstLine,
			paraLayout.alignment,
			paraLayout.lineSpacing,
			paragraphPath,
			y,
			pageFloats,
			contentLeft,
			contentRight,
		);

		const totalLinesHeight =
			lines.length > 0
				? lines[lines.length - 1].rect.y + lines[lines.length - 1].rect.height - y
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
			nodePath: paragraphPath,
		};
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
					const image = drawing.children[0];
					if (drawing.properties.positioning === 'floating' && drawing.properties.floating) {
						// Collect for float layout
						floatingItems.push({
							nodeId: drawing.id,
							imageNodeId: image.id,
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
							},
						});
					}
					break;
				}

				case 'hyperlink': {
					const hyperlink = child as JPHyperlink;
					for (let hi = 0; hi < hyperlink.children.length; hi++) {
						const hRun = hyperlink.children[hi];
						const hRunPath: JPPath = [...childPath, hi];
						this.collectRunItems(styles, paragraph, hRun, hRunPath, items);
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

				// bookmark-start, bookmark-end, column-break: zero-width, skip
				default:
					break;
			}
		}

		return items;
	}

	private collectRunItems(
		styles: JPStyleRegistry,
		paragraph: JPParagraph,
		run: JPRun,
		runPath: JPPath,
		items: InlineItem[],
	): void {
		const style = resolveRunStyle(styles, paragraph.properties, run.properties);
		let offset = 0;
		for (let ti = 0; ti < run.children.length; ti++) {
			const textChild = run.children[ti];
			if (isText(textChild)) {
				items.push({
					text: textChild.text,
					style,
					runPath,
					runOffset: offset,
				});
				offset += textChild.text.length;
			}
		}
	}

	getMeasurer(): TextMeasurer {
		return this.measurer;
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
		const y = startY + paraLayout.spaceBefore;

		const lines = breakIntoLines(
			items,
			this.measurer,
			availableWidth,
			paraLayout.indentFirstLine,
			paraLayout.alignment,
			paraLayout.lineSpacing,
			dummyPath,
			y,
		);

		const totalLinesHeight =
			lines.length > 0
				? lines[lines.length - 1].rect.y + lines[lines.length - 1].rect.height - y
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
