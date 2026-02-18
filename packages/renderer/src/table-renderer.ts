import type { LayoutTable, LayoutTableCell } from '@jpoffice/layout';
import { isLayoutParagraph } from '@jpoffice/layout';
import type { TextRenderer } from './text-renderer';

/**
 * Renders tables: borders, cell backgrounds, and cell content.
 */
export class TableRenderer {
	private textRenderer: TextRenderer;

	constructor(textRenderer: TextRenderer) {
		this.textRenderer = textRenderer;
	}

	/**
	 * Render a complete table.
	 */
	renderTable(
		ctx: CanvasRenderingContext2D,
		table: LayoutTable,
		offsetX: number,
		offsetY: number,
	): void {
		// Render cell content and grid lines
		for (const row of table.rows) {
			for (const cell of row.cells) {
				this.renderCell(ctx, cell, offsetX, offsetY);
			}
		}

		// Render outer border
		this.renderBorders(ctx, table, offsetX, offsetY);
	}

	private renderCell(
		ctx: CanvasRenderingContext2D,
		cell: LayoutTableCell,
		offsetX: number,
		offsetY: number,
	): void {
		// Cell background (shading)
		if (cell.shading?.fill && cell.shading.fill !== 'auto') {
			ctx.fillStyle = `#${cell.shading.fill}`;
			ctx.fillRect(offsetX + cell.x, offsetY + cell.y, cell.width, cell.height);
		}

		// Render cell content blocks
		for (const block of cell.blocks) {
			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					this.textRenderer.renderLine(
						ctx,
						line,
						offsetX + cell.contentRect.x,
						offsetY + cell.contentRect.y,
					);
				}
			}
		}

		// Cell border
		ctx.save();
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(offsetX + cell.x, offsetY + cell.y, cell.width, cell.height);
		ctx.restore();
	}

	private renderBorders(
		ctx: CanvasRenderingContext2D,
		table: LayoutTable,
		offsetX: number,
		offsetY: number,
	): void {
		ctx.save();
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 1;
		ctx.strokeRect(offsetX + table.x, offsetY + table.y, table.width, table.height);
		ctx.restore();
	}
}
