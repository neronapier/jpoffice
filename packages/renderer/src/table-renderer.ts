import type { LayoutTable, LayoutTableCell } from '@jpoffice/layout';
import { isLayoutParagraph } from '@jpoffice/layout';
import type { JPBorderDef } from '@jpoffice/model';
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

		// Cell borders
		const cx = offsetX + cell.x;
		const cy = offsetY + cell.y;
		const cw = cell.width;
		const ch = cell.height;

		ctx.save();
		this.drawBorder(ctx, cell.borders?.top, cx, cy, cx + cw, cy);
		this.drawBorder(ctx, cell.borders?.bottom, cx, cy + ch, cx + cw, cy + ch);
		this.drawBorder(ctx, cell.borders?.left, cx, cy, cx, cy + ch);
		this.drawBorder(ctx, cell.borders?.right, cx + cw, cy, cx + cw, cy + ch);
		ctx.restore();
	}

	private drawBorder(
		ctx: CanvasRenderingContext2D,
		border: JPBorderDef | undefined,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): void {
		if (border && border.style === 'none') return;
		ctx.strokeStyle = border?.color ? `#${border.color}` : '#000000';
		ctx.lineWidth = border?.width ? border.width / 8 : 0.5;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	private renderBorders(
		ctx: CanvasRenderingContext2D,
		table: LayoutTable,
		offsetX: number,
		offsetY: number,
	): void {
		const tx = offsetX + table.x;
		const ty = offsetY + table.y;
		const tw = table.width;
		const th = table.height;

		ctx.save();
		this.drawBorder(ctx, table.borders?.top, tx, ty, tx + tw, ty);
		this.drawBorder(ctx, table.borders?.bottom, tx, ty + th, tx + tw, ty + th);
		this.drawBorder(ctx, table.borders?.left, tx, ty, tx, ty + th);
		this.drawBorder(ctx, table.borders?.right, tx + tw, ty, tx + tw, ty + th);
		ctx.restore();
	}
}
