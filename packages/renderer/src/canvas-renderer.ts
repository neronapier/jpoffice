import type { LayoutBlock, LayoutPage, LayoutResult, LayoutTable } from '@jpoffice/layout';
import { isLayoutImage, isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPSelection } from '@jpoffice/model';
import { CursorRenderer } from './cursor-renderer';
import type { CursorStyle } from './cursor-renderer';
import { HitTester } from './hit-test';
import type { HitTestResult } from './hit-test';
import { ImageRenderer } from './image-renderer';
import { PageRenderer } from './page-renderer';
import type { PageChromeOptions } from './page-renderer';
import { SelectionRenderer } from './selection-renderer';
import type { SearchHighlight, SelectionStyle } from './selection-renderer';
import { TableRenderer } from './table-renderer';
import { TextRenderer } from './text-renderer';

/**
 * Result of findTableAtCanvasCoords().
 */
export interface TableAtCoordsResult {
	table: LayoutTable;
	pageIndex: number;
	pageX: number;
	pageY: number;
	pageVirtualX: number;
	pageVirtualY: number;
}

/**
 * Result of findColumnBorderAtCoords().
 */
export interface ColumnBorderResult {
	table: LayoutTable;
	columnIndex: number;
	borderX: number;
	borderVirtualX: number;
	pageIndex: number;
	pageVirtualX: number;
	pageVirtualY: number;
}

/**
 * Result of findRowBorderAtCoords().
 */
export interface RowBorderResult {
	table: LayoutTable;
	rowIndex: number;
	borderY: number;
	borderVirtualY: number;
	pageIndex: number;
	pageVirtualX: number;
	pageVirtualY: number;
}

/**
 * Specifies which pages are visible in the viewport.
 * Pages within the range (plus a buffer of 1 page above/below)
 * will be rendered; all others are skipped entirely.
 */
export interface VisibleRange {
	startPage: number;
	endPage: number;
}

export interface CanvasRendererOptions {
	pageChrome?: PageChromeOptions;
	selection?: SelectionStyle;
	cursor?: CursorStyle;
	/** Device pixel ratio. Default window.devicePixelRatio or 1. */
	dpr?: number;
	/** Show margin guides. Default false. */
	showMargins?: boolean;
}

/**
 * CanvasRenderer is the main rendering coordinator.
 * It composes sub-renderers to draw pages, text, tables,
 * images, selection highlights, and the cursor.
 */
export class CanvasRenderer {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private dpr: number;
	private showMargins: boolean;

	readonly pageRenderer: PageRenderer;
	readonly textRenderer: TextRenderer;
	readonly tableRenderer: TableRenderer;
	readonly imageRenderer: ImageRenderer;
	readonly selectionRenderer: SelectionRenderer;
	readonly cursorRenderer: CursorRenderer;
	readonly hitTester: HitTester;

	private layoutResult: LayoutResult | null = null;
	private currentSelection: JPSelection = null;
	private scrollY = 0;
	private zoom = 1.0;
	private searchHighlights: readonly SearchHighlight[] = [];
	private searchCurrentIndex = -1;

	constructor(options?: CanvasRendererOptions) {
		this.dpr = options?.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
		this.showMargins = options?.showMargins ?? false;

		this.pageRenderer = new PageRenderer(options?.pageChrome);
		this.textRenderer = new TextRenderer();
		this.tableRenderer = new TableRenderer(this.textRenderer);
		this.imageRenderer = new ImageRenderer();
		this.selectionRenderer = new SelectionRenderer(options?.selection);
		this.cursorRenderer = new CursorRenderer(options?.cursor);
		this.hitTester = new HitTester(this.pageRenderer);
	}

	/**
	 * Attach to a canvas element.
	 */
	attach(canvas: HTMLCanvasElement): void {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
	}

	/**
	 * Detach from the canvas.
	 */
	detach(): void {
		this.cursorRenderer.destroy();
		this.canvas = null;
		this.ctx = null;
	}

	/**
	 * Set the current layout result to render.
	 */
	setLayout(layout: LayoutResult): void {
		this.layoutResult = layout;
	}

	/**
	 * Set the current selection to render.
	 */
	setSelection(selection: JPSelection): void {
		this.currentSelection = selection;
	}

	/**
	 * Set the scroll Y offset.
	 */
	setScrollY(scrollY: number): void {
		this.scrollY = scrollY;
	}

	/**
	 * Set search highlights.
	 */
	setSearchHighlights(highlights: readonly SearchHighlight[], currentIndex: number): void {
		this.searchHighlights = highlights;
		this.searchCurrentIndex = currentIndex;
	}

	/**
	 * Set the zoom factor (1.0 = 100%).
	 */
	setZoom(zoom: number): void {
		this.zoom = zoom;
	}

	/**
	 * Get the current zoom factor.
	 */
	getZoom(): number {
		return this.zoom;
	}

	/**
	 * Get the total content height (for scroll calculations).
	 */
	getTotalHeight(): number {
		if (!this.layoutResult) return 0;
		return this.pageRenderer.getTotalHeight(this.layoutResult.pages) * this.zoom;
	}

	/**
	 * Resize the canvas element to match container and DPR.
	 */
	resize(width: number, height: number): void {
		if (!this.canvas) return;
		this.canvas.width = Math.round(width * this.dpr);
		this.canvas.height = Math.round(height * this.dpr);
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
	}

	/**
	 * Perform a full render pass.
	 * Optionally accepts a VisibleRange to explicitly control which pages
	 * are rendered. When provided, only pages within the range (plus a
	 * 1-page buffer above and below) are drawn. When omitted, viewport-based
	 * culling is used automatically.
	 */
	render(visibleRange?: VisibleRange): void {
		const { canvas, ctx, layoutResult } = this;
		if (!canvas || !ctx || !layoutResult) return;

		// Compute virtual viewport size (canvas pixels → CSS pixels → zoom-adjusted)
		const cssWidth = canvas.width / (this.dpr * this.zoom);
		const cssHeight = canvas.height / (this.dpr * this.zoom);

		ctx.save();
		ctx.scale(this.dpr * this.zoom, this.dpr * this.zoom);

		// Clear workspace
		this.pageRenderer.renderWorkspace(ctx, cssWidth, cssHeight);

		// Render visible pages
		const pages = layoutResult.pages;
		const virtualScrollY = this.scrollY / this.zoom;
		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi) - virtualScrollY;
			const pageX = (cssWidth - page.width) / 2;

			// Skip off-screen pages (explicit range takes precedence)
			if (visibleRange) {
				if (pi < visibleRange.startPage - 1 || pi > visibleRange.endPage + 1) {
					continue;
				}
			} else if (pageY + page.height < 0 || pageY > cssHeight) {
				continue;
			}

			// Page chrome (background, shadow)
			this.pageRenderer.renderPageChrome(ctx, page, pageX, pageY);

			if (this.showMargins) {
				this.pageRenderer.renderMargins(ctx, page, pageX, pageY);
			}

			// Render header
			if (page.header) {
				this.renderHeaderFooterBlocks(
					ctx,
					page.header.blocks,
					pageX + page.contentArea.x,
					pageY + page.header.rect.y,
				);
			}

			// Block positions (block.rect.x/y) already include contentArea offset
			// (margin), so we use pageX/pageY directly to avoid double-offset.
			// Header/footer blocks are an exception: their positions are relative
			// to contentArea, so they need the explicit margin offset.

			// Render behind-text floats (before blocks)
			if (page.floats) {
				for (const float of page.floats) {
					if (float.behindText) {
						this.imageRenderer.renderImage(
							ctx,
							{
								kind: 'image',
								rect: { x: float.x, y: float.y, width: float.width, height: float.height },
								nodePath: [],
								src: float.src,
								mimeType: float.mimeType,
							},
							pageX,
							pageY,
							() => this.render(),
						);
					}
				}
			}

			// Render blocks (with block-level viewport culling)
			this.renderPageBlocks(ctx, page, pageX, pageY, cssHeight);

			// Render in-front-of-text floats (after blocks)
			if (page.floats) {
				for (const float of page.floats) {
					if (!float.behindText) {
						this.imageRenderer.renderImage(
							ctx,
							{
								kind: 'image',
								rect: { x: float.x, y: float.y, width: float.width, height: float.height },
								nodePath: [],
								src: float.src,
								mimeType: float.mimeType,
							},
							pageX,
							pageY,
							() => this.render(),
						);
					}
				}
			}

			// Render footer
			if (page.footer) {
				this.renderHeaderFooterBlocks(
					ctx,
					page.footer.blocks,
					pageX + page.contentArea.x,
					pageY + page.footer.rect.y,
				);
			}

			// Search highlights (before selection so selection draws on top)
			if (this.searchHighlights.length > 0) {
				this.selectionRenderer.renderSearchHighlights(
					ctx,
					page,
					this.searchHighlights,
					this.searchCurrentIndex,
					pageX,
					pageY,
				);
			}

			// Selection highlight
			if (this.currentSelection) {
				this.selectionRenderer.renderSelection(
					ctx,
					page,
					this.currentSelection,
					pageX,
					pageY,
				);
			}

			// Cursor
			if (this.currentSelection) {
				this.cursorRenderer.renderCursor(
					ctx,
					page,
					this.currentSelection.focus,
					pageX,
					pageY,
				);
			}
		}

		ctx.restore();
	}

	private renderPageBlocks(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		contentX: number,
		contentY: number,
		viewportHeight: number,
	): void {
		for (const block of page.blocks) {
			// Block-level viewport culling: skip blocks entirely outside the visible area
			const blockY = 'rect' in block ? block.rect.y : block.y;
			const blockH = 'rect' in block ? block.rect.height : block.height;
			const blockTop = contentY + blockY;
			const blockBottom = blockTop + blockH;
			if (blockBottom < 0 || blockTop > viewportHeight) continue;

			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					this.textRenderer.renderLine(ctx, line, contentX + block.rect.x, contentY + block.rect.y);
				}
			} else if (isLayoutTable(block)) {
				this.tableRenderer.renderTable(ctx, block, contentX, contentY);
			} else if (isLayoutImage(block)) {
				this.imageRenderer.renderImage(ctx, block, contentX, contentY, () => this.render());
			}
		}
	}

	private renderHeaderFooterBlocks(
		ctx: CanvasRenderingContext2D,
		blocks: readonly LayoutBlock[],
		offsetX: number,
		offsetY: number,
	): void {
		for (const block of blocks) {
			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					this.textRenderer.renderLine(ctx, line, offsetX + block.rect.x, offsetY + block.rect.y);
				}
			} else if (isLayoutTable(block)) {
				this.tableRenderer.renderTable(ctx, block, offsetX, offsetY);
			}
		}
	}

	/**
	 * Perform a hit test from canvas-relative coordinates.
	 */
	hitTest(canvasX: number, canvasY: number): HitTestResult | null {
		if (!this.layoutResult || !this.canvas) return null;

		const cssWidth = this.canvas.width / (this.dpr * this.zoom);
		// Adjust for zoom and scroll
		const adjustedX = canvasX / this.zoom;
		const adjustedY = canvasY / this.zoom + this.scrollY / this.zoom;

		return this.hitTester.hitTest(adjustedX, adjustedY, this.layoutResult.pages, cssWidth);
	}

	/**
	 * Get visible page range for viewport culling.
	 */
	getVisiblePages(): { first: number; last: number } {
		if (!this.layoutResult || !this.canvas) return { first: 0, last: 0 };

		const cssHeight = this.canvas.height / (this.dpr * this.zoom);
		const pages = this.layoutResult.pages;
		const vScrollY = this.scrollY / this.zoom;
		let first = 0;
		let last = 0;

		for (let pi = 0; pi < pages.length; pi++) {
			const pageY = this.pageRenderer.getPageY(pages, pi) - vScrollY;
			if (pageY + pages[pi].height >= 0) {
				first = pi;
				break;
			}
		}

		for (let pi = first; pi < pages.length; pi++) {
			last = pi;
			const pageY = this.pageRenderer.getPageY(pages, pi) - vScrollY;
			if (pageY > cssHeight) break;
		}

		return { first, last };
	}

	/**
	 * Get the screen-space rectangle of the cursor for auto-scroll.
	 * Returns coordinates relative to the canvas element (CSS pixels, zoom-adjusted).
	 */
	getCursorRect(selection: JPSelection): { x: number; y: number; height: number } | null {
		if (!selection || !this.layoutResult || !this.canvas) return null;

		const pages = this.layoutResult.pages;
		const cssWidth = this.canvas.width / (this.dpr * this.zoom);
		const virtualScrollY = this.scrollY / this.zoom;

		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi) - virtualScrollY;
			const pageX = (cssWidth - page.width) / 2;

			const pos = this.cursorRenderer.findCursorPosition(page, selection.focus, pageX, pageY);
			if (pos) {
				return {
					x: pos.x * this.zoom,
					y: pos.y * this.zoom,
					height: pos.height * this.zoom,
				};
			}
		}
		return null;
	}

	/**
	 * Get the bounding rectangle of the current selection in canvas-relative CSS pixels (zoom-adjusted).
	 * Returns null if the selection is collapsed or no layout is available.
	 */
	getSelectionRect(
		selection: JPSelection,
	): { x: number; y: number; width: number; height: number } | null {
		if (!selection || !this.layoutResult || !this.canvas) return null;

		const { anchor, focus } = selection;
		// Check for collapsed selection
		const isCollapsed =
			anchor.path.length === focus.path.length &&
			anchor.path.every((v, i) => v === focus.path[i]) &&
			anchor.offset === focus.offset;
		if (isCollapsed) return null;

		const pages = this.layoutResult.pages;
		const cssWidth = this.canvas.width / (this.dpr * this.zoom);
		const virtualScrollY = this.scrollY / this.zoom;

		// Find positions for both anchor and focus across pages
		let anchorPos: { x: number; y: number; height: number } | null = null;
		let focusPos: { x: number; y: number; height: number } | null = null;

		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi) - virtualScrollY;
			const pageX = (cssWidth - page.width) / 2;

			if (!anchorPos) {
				anchorPos = this.cursorRenderer.findCursorPosition(page, anchor, pageX, pageY);
			}
			if (!focusPos) {
				focusPos = this.cursorRenderer.findCursorPosition(page, focus, pageX, pageY);
			}
			if (anchorPos && focusPos) break;
		}

		if (!anchorPos || !focusPos) return null;

		// Compute bounding box
		const minX = Math.min(anchorPos.x, focusPos.x);
		const minY = Math.min(anchorPos.y, focusPos.y);
		const maxX = Math.max(anchorPos.x, focusPos.x);
		const maxY = Math.max(anchorPos.y + anchorPos.height, focusPos.y + focusPos.height);

		return {
			x: minX * this.zoom,
			y: minY * this.zoom,
			width: Math.max((maxX - minX) * this.zoom, 1),
			height: (maxY - minY) * this.zoom,
		};
	}

	/**
	 * Expose the canvas element for coordinate transforms in overlays.
	 */
	getCanvas(): HTMLCanvasElement | null {
		return this.canvas;
	}

	/**
	 * Expose the current layout result for overlays.
	 */
	getLayoutResult(): LayoutResult | null {
		return this.layoutResult;
	}

	/**
	 * Convert canvas-relative CSS pixel coords to virtual doc coords (zoom + scroll adjusted).
	 */
	private canvasToVirtualCoords(canvasX: number, canvasY: number): { vx: number; vy: number } {
		return {
			vx: canvasX / this.zoom,
			vy: canvasY / this.zoom + this.scrollY / this.zoom,
		};
	}

	/**
	 * Find a table at the given canvas-relative CSS pixel coordinates.
	 * Returns the table, page index, and the page's top-left in canvas CSS pixels.
	 */
	findTableAtCanvasCoords(canvasX: number, canvasY: number): TableAtCoordsResult | null {
		if (!this.layoutResult || !this.canvas) return null;

		const { vx, vy } = this.canvasToVirtualCoords(canvasX, canvasY);
		const cssWidth = this.canvas.width / (this.dpr * this.zoom);
		const pages = this.layoutResult.pages;
		const virtualScrollY = this.scrollY / this.zoom;

		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi);
			const pageX = (cssWidth - page.width) / 2;

			// Check if point is within this page
			if (vx < pageX || vx > pageX + page.width) continue;
			if (vy < pageY || vy > pageY + page.height) continue;

			// Search blocks for a table containing the point
			for (const block of page.blocks) {
				if (!isLayoutTable(block)) continue;
				const tableLeft = pageX + block.x;
				const tableTop = pageY + block.y;
				if (
					vx >= tableLeft &&
					vx <= tableLeft + block.width &&
					vy >= tableTop &&
					vy <= tableTop + block.height
				) {
					return {
						table: block,
						pageIndex: pi,
						pageX: (pageX - virtualScrollY + pageY) * 0 + pageX, // just pageX in virtual coords
						pageY: (pageY - virtualScrollY) * this.zoom, // canvas CSS pixel Y of page top
						pageVirtualX: pageX,
						pageVirtualY: pageY,
					};
				}
			}
		}
		return null;
	}

	/**
	 * Find a column border near the given canvas-relative coords.
	 * threshold is in CSS pixels.
	 */
	findColumnBorderAtCoords(
		canvasX: number,
		canvasY: number,
		threshold = 4,
	): ColumnBorderResult | null {
		const tableResult = this.findTableAtCanvasCoords(canvasX, canvasY);
		if (!tableResult) return null;

		const { table, pageVirtualX, pageVirtualY } = tableResult;
		const { vx } = this.canvasToVirtualCoords(canvasX, canvasY);
		const vThreshold = threshold / this.zoom;

		// Check column right-edges using cells from first row
		if (table.rows.length === 0) return null;
		const firstRow = table.rows[0];

		for (let ci = 0; ci < firstRow.cells.length; ci++) {
			const cell = firstRow.cells[ci];
			const cellRight = pageVirtualX + table.x + cell.x + cell.width;

			if (Math.abs(vx - cellRight) <= vThreshold) {
				return {
					table,
					columnIndex: ci,
					borderX: (cellRight - pageVirtualX) * this.zoom, // relative to page in canvas px (not used directly)
					borderVirtualX: cellRight,
					pageIndex: tableResult.pageIndex,
					pageVirtualX,
					pageVirtualY,
				};
			}
		}

		return null;
	}

	/**
	 * Find a row border near the given canvas-relative coords.
	 * threshold is in CSS pixels.
	 */
	findRowBorderAtCoords(
		canvasX: number,
		canvasY: number,
		threshold = 4,
	): RowBorderResult | null {
		const tableResult = this.findTableAtCanvasCoords(canvasX, canvasY);
		if (!tableResult) return null;

		const { table, pageVirtualX, pageVirtualY } = tableResult;
		const { vy } = this.canvasToVirtualCoords(canvasX, canvasY);
		const vThreshold = threshold / this.zoom;

		for (let ri = 0; ri < table.rows.length; ri++) {
			const row = table.rows[ri];
			const rowBottom = pageVirtualY + table.y + row.y + row.height;

			if (Math.abs(vy - rowBottom) <= vThreshold) {
				return {
					table,
					rowIndex: ri,
					borderY: rowBottom,
					borderVirtualY: rowBottom,
					pageIndex: tableResult.pageIndex,
					pageVirtualX,
					pageVirtualY,
				};
			}
		}

		return null;
	}

	/**
	 * Convert virtual doc coords to canvas CSS pixel coords (for overlay positioning).
	 */
	virtualToCanvas(virtualX: number, virtualY: number): { cx: number; cy: number } {
		const virtualScrollY = this.scrollY / this.zoom;
		return {
			cx: virtualX * this.zoom,
			cy: (virtualY - virtualScrollY) * this.zoom,
		};
	}

	destroy(): void {
		this.cursorRenderer.destroy();
		this.imageRenderer.clearCache();
		this.detach();
	}
}
