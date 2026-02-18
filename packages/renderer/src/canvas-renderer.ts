import type { LayoutBlock, LayoutPage, LayoutResult } from '@jpoffice/layout';
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
import type { SelectionStyle } from './selection-renderer';
import { TableRenderer } from './table-renderer';
import { TextRenderer } from './text-renderer';

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
	 * Get the total content height (for scroll calculations).
	 */
	getTotalHeight(): number {
		if (!this.layoutResult) return 0;
		return this.pageRenderer.getTotalHeight(this.layoutResult.pages);
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
	 */
	render(): void {
		const { canvas, ctx, layoutResult } = this;
		if (!canvas || !ctx || !layoutResult) return;

		const cssWidth = canvas.width / this.dpr;
		const cssHeight = canvas.height / this.dpr;

		ctx.save();
		ctx.scale(this.dpr, this.dpr);

		// Clear workspace
		this.pageRenderer.renderWorkspace(ctx, cssWidth, cssHeight);

		// Render visible pages
		const pages = layoutResult.pages;
		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi) - this.scrollY;
			const pageX = (cssWidth - page.width) / 2;

			// Skip off-screen pages
			if (pageY + page.height < 0 || pageY > cssHeight) continue;

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

			// Content area offset
			const contentX = pageX + page.contentArea.x;
			const contentY = pageY + page.contentArea.y;

			// Render blocks (with block-level viewport culling)
			this.renderPageBlocks(ctx, page, contentX, contentY, cssHeight);

			// Render footer
			if (page.footer) {
				this.renderHeaderFooterBlocks(
					ctx,
					page.footer.blocks,
					pageX + page.contentArea.x,
					pageY + page.footer.rect.y,
				);
			}

			// Selection highlight
			if (this.currentSelection) {
				this.selectionRenderer.renderSelection(
					ctx,
					page,
					this.currentSelection,
					contentX,
					contentY,
				);
			}

			// Cursor
			if (this.currentSelection) {
				this.cursorRenderer.renderCursor(
					ctx,
					page,
					this.currentSelection.focus,
					contentX,
					contentY,
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

		const cssWidth = this.canvas.width / this.dpr;
		// Adjust for scroll
		const adjustedY = canvasY + this.scrollY;

		return this.hitTester.hitTest(canvasX, adjustedY, this.layoutResult.pages, cssWidth);
	}

	/**
	 * Get visible page range for viewport culling.
	 */
	getVisiblePages(): { first: number; last: number } {
		if (!this.layoutResult || !this.canvas) return { first: 0, last: 0 };

		const cssHeight = this.canvas.height / this.dpr;
		const pages = this.layoutResult.pages;
		let first = 0;
		let last = 0;

		for (let pi = 0; pi < pages.length; pi++) {
			const pageY = this.pageRenderer.getPageY(pages, pi) - this.scrollY;
			if (pageY + pages[pi].height >= 0) {
				first = pi;
				break;
			}
		}

		for (let pi = first; pi < pages.length; pi++) {
			last = pi;
			const pageY = this.pageRenderer.getPageY(pages, pi) - this.scrollY;
			if (pageY > cssHeight) break;
		}

		return { first, last };
	}

	destroy(): void {
		this.cursorRenderer.destroy();
		this.imageRenderer.clearCache();
		this.detach();
	}
}
