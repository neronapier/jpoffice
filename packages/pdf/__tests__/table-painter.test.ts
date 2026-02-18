import { describe, it, expect } from 'vitest';
import { TablePainter } from '../src/table-painter';
import { ContentStreamBuilder } from '../src/content-stream';
import type { LayoutTable, LayoutTableCell, LayoutTableRow } from '@jpoffice/layout';

function makeCell(overrides: Partial<LayoutTableCell> = {}): LayoutTableCell {
	return {
		nodeId: 'cell-1',
		x: 0,
		y: 0,
		width: 100,
		height: 30,
		contentRect: { x: 2, y: 2, width: 96, height: 26 },
		blocks: [],
		verticalAlignment: 'top',
		gridSpan: 1,
		rowSpan: 1,
		...overrides,
	};
}

function makeRow(cells: LayoutTableCell[]): LayoutTableRow {
	return {
		nodeId: 'row-1',
		x: 0,
		y: 0,
		width: cells.reduce((sum, c) => sum + c.width, 0),
		height: 30,
		cells,
		isHeader: false,
	};
}

function makeTable(rows: LayoutTableRow[]): LayoutTable {
	return {
		kind: 'table',
		nodeId: 'table-1',
		path: [0, 0, 0],
		x: 0,
		y: 0,
		width: 200,
		height: 60,
		rows,
	};
}

describe('TablePainter', () => {
	it('paints table outer border', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);
		const table = makeTable([makeRow([makeCell()])]);

		painter.paintTableBorder(table, 0, 0);

		const result = stream.build();
		expect(result).toContain('re');
		expect(result).toContain('S');
	});

	it('paints cell border', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);
		const cell = makeCell();

		painter.paintCellBorder(cell, 0, 0);

		const result = stream.build();
		expect(result).toContain('re');
		expect(result).toContain('S');
	});

	it('paints cell background when shading is set', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);
		const cell = makeCell({
			shading: { fill: 'CCCCCC' },
		});

		painter.paintCellBackground(cell, 0, 0);

		const result = stream.build();
		expect(result).toContain('rg');
		expect(result).toContain('re');
		expect(result).toContain('f');
	});

	it('skips background when no shading', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);
		const cell = makeCell();

		painter.paintCellBackground(cell, 0, 0);

		const result = stream.build();
		expect(result).toBe('');
	});

	it('skips background when shading is auto', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);
		const cell = makeCell({
			shading: { fill: 'auto' },
		});

		painter.paintCellBackground(cell, 0, 0);

		const result = stream.build();
		expect(result).toBe('');
	});

	it('paints all cells in table', () => {
		const stream = new ContentStreamBuilder();
		const painter = new TablePainter(stream, 842);

		const cell1 = makeCell({ nodeId: 'c1', x: 0, width: 100 });
		const cell2 = makeCell({ nodeId: 'c2', x: 100, width: 100 });
		const row = makeRow([cell1, cell2]);
		const table = makeTable([row]);

		painter.paintTableCells(table, 0, 0);

		const result = stream.build();
		// Should have multiple rect+stroke operations (one per cell)
		const strokeCount = (result.match(/\bS\b/g) || []).length;
		expect(strokeCount).toBe(2);
	});
});
