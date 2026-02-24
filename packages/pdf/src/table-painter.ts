/**
 * Converts LayoutTable objects into PDF graphics operators.
 * Renders cell backgrounds, cell borders, and table outer border.
 *
 * Handles merged cells (gridSpan > 1, rowSpan > 1) correctly:
 * the layout engine already provides merged cells with their full
 * spanned dimensions, and only owner cells appear in the output.
 * Individual cell borders (top, bottom, left, right) are painted
 * separately so that merged cells can suppress internal borders
 * via their border definitions.
 */

import type { LayoutTable, LayoutTableCell } from '@jpoffice/layout';
import type { JPBorderDef } from '@jpoffice/model';
import type { ContentStreamBuilder } from './content-stream';
import { colorToRgb, flipY, pxToPt, round } from './unit-utils';

export class TablePainter {
	constructor(
		private stream: ContentStreamBuilder,
		private pageHeightPt: number,
	) {}

	/** Paint table outer border. */
	paintTableBorder(table: LayoutTable, offsetX: number, offsetY: number): void {
		const x = pxToPt(offsetX + table.x);
		const y = pxToPt(offsetY + table.y);
		const w = pxToPt(table.width);
		const h = pxToPt(table.height);
		const pdfY = flipY(y + h, this.pageHeightPt);

		this.stream
			.save()
			.setStrokeColor(0, 0, 0)
			.setLineWidth(0.75)
			.rect(round(x), round(pdfY), round(w), round(h))
			.stroke()
			.restore();
	}

	/** Paint a cell's background shading. */
	paintCellBackground(cell: LayoutTableCell, offsetX: number, offsetY: number): void {
		if (!cell.shading?.fill || cell.shading.fill === 'auto') return;

		const x = pxToPt(offsetX + cell.x);
		const y = pxToPt(offsetY + cell.y);
		const w = pxToPt(cell.width);
		const h = pxToPt(cell.height);
		const pdfY = flipY(y + h, this.pageHeightPt);

		const [r, g, b] = colorToRgb(`#${cell.shading.fill}`);

		this.stream
			.save()
			.setFillColor(r, g, b)
			.rect(round(x), round(pdfY), round(w), round(h))
			.fill()
			.restore();
	}

	/**
	 * Paint a cell's borders individually (top, bottom, left, right).
	 * Respects per-side border definitions from the cell properties,
	 * which allows merged cells to suppress internal borders.
	 */
	paintCellBorder(cell: LayoutTableCell, offsetX: number, offsetY: number): void {
		const cx = pxToPt(offsetX + cell.x);
		const cy = pxToPt(offsetY + cell.y);
		const cw = pxToPt(cell.width);
		const ch = pxToPt(cell.height);

		// PDF Y coords (bottom-left origin)
		const pdfTop = flipY(cy, this.pageHeightPt);
		const pdfBottom = flipY(cy + ch, this.pageHeightPt);
		const pdfLeft = round(cx);
		const pdfRight = round(cx + cw);

		this.stream.save();

		// Top border
		this.paintBorderLine(cell.borders?.top, pdfLeft, round(pdfTop), pdfRight, round(pdfTop));
		// Bottom border
		this.paintBorderLine(
			cell.borders?.bottom,
			pdfLeft,
			round(pdfBottom),
			pdfRight,
			round(pdfBottom),
		);
		// Left border
		this.paintBorderLine(cell.borders?.left, pdfLeft, round(pdfBottom), pdfLeft, round(pdfTop));
		// Right border
		this.paintBorderLine(cell.borders?.right, pdfRight, round(pdfBottom), pdfRight, round(pdfTop));

		this.stream.restore();
	}

	/**
	 * Paint a single border line segment.
	 * Skips if the border style is 'none' or not defined.
	 * Uses border color and width when available, otherwise defaults.
	 */
	private paintBorderLine(
		border: JPBorderDef | undefined,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): void {
		// If no border definition, draw a thin default line
		if (!border) {
			this.stream
				.setStrokeColor(0, 0, 0)
				.setLineWidth(0.375)
				.moveTo(x1, y1)
				.lineTo(x2, y2)
				.stroke();
			return;
		}

		// Skip borders explicitly set to 'none'
		if (border.style === 'none') return;

		// Apply border color and width
		if (border.color) {
			const [r, g, b] = colorToRgb(`#${border.color}`);
			this.stream.setStrokeColor(r, g, b);
		} else {
			this.stream.setStrokeColor(0, 0, 0);
		}

		// Border width is in eighths of a point
		const lineWidth = border.width ? border.width / 8 : 0.375;
		this.stream.setLineWidth(round(lineWidth));

		this.stream.moveTo(x1, y1).lineTo(x2, y2).stroke();
	}

	/** Paint all cells in a table (backgrounds + borders). */
	paintTableCells(table: LayoutTable, offsetX: number, offsetY: number): void {
		for (const row of table.rows) {
			for (const cell of row.cells) {
				this.paintCellBackground(cell, offsetX, offsetY);
				this.paintCellBorder(cell, offsetX, offsetY);
			}
		}
	}
}
