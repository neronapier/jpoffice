/**
 * Converts LayoutTable objects into PDF graphics operators.
 * Renders cell backgrounds, cell borders, and table outer border.
 */

import type { LayoutTable, LayoutTableCell } from '@jpoffice/layout';
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

	/** Paint a cell's border (simple rectangle). */
	paintCellBorder(cell: LayoutTableCell, offsetX: number, offsetY: number): void {
		const x = pxToPt(offsetX + cell.x);
		const y = pxToPt(offsetY + cell.y);
		const w = pxToPt(cell.width);
		const h = pxToPt(cell.height);
		const pdfY = flipY(y + h, this.pageHeightPt);

		this.stream
			.save()
			.setStrokeColor(0, 0, 0)
			.setLineWidth(0.375)
			.rect(round(x), round(pdfY), round(w), round(h))
			.stroke()
			.restore();
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
