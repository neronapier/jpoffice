import { describe, it, expect } from 'vitest';
import {
	createTable,
	createTableRow,
	createTableCell,
	createParagraph,
	createRun,
	createText,
	generateId,
} from '@jpoffice/model';
import type { JPTableGridCol } from '@jpoffice/model';
import { buildCellGrid, resolveColumnWidths, layoutTable } from '../src/table-layout';
import type { CellContentLayoutFn } from '../src/table-layout';
import { TextMeasurer } from '../src/text-measurer';
import { createStyleRegistry } from '@jpoffice/model';

const emptyStyles = createStyleRegistry([]);

function makeParagraph(text: string) {
	return createParagraph(
		generateId(),
		[createRun(generateId(), [createText(generateId(), text)])],
		{},
	);
}

function makeCell(text: string, properties = {}) {
	return createTableCell(generateId(), [makeParagraph(text)], properties);
}

function makeRow(cells: ReturnType<typeof makeCell>[], properties = {}) {
	return createTableRow(generateId(), cells, properties);
}

function makeTable(
	rows: ReturnType<typeof makeRow>[],
	grid: JPTableGridCol[] = [],
	properties = {},
) {
	return createTable(generateId(), rows, properties, grid);
}

// Simple content layout callback for tests
const simpleContentLayout: CellContentLayoutFn = (_cell, _path, _width, _styles) => ({
	blocks: [],
	height: 20,
});

describe('buildCellGrid', () => {
	it('builds grid for simple table', () => {
		const table = makeTable([
			makeRow([makeCell('A'), makeCell('B')]),
			makeRow([makeCell('C'), makeCell('D')]),
		]);
		const grid = buildCellGrid(table);
		expect(grid).toHaveLength(2);
		expect(grid[0]).toHaveLength(2);
		expect(grid[1]).toHaveLength(2);
	});

	it('handles gridSpan (horizontal merge)', () => {
		const table = makeTable([
			makeRow([
				makeCell('Merged', { gridSpan: 2 }),
			]),
			makeRow([makeCell('A'), makeCell('B')]),
		]);
		const grid = buildCellGrid(table);
		expect(grid[0][0]).toBe(grid[0][1]); // same entry
		expect(grid[0][0]!.colSpan).toBe(2);
	});

	it('handles vertical merge', () => {
		const table = makeTable([
			makeRow([
				makeCell('Top', { verticalMerge: 'restart' }),
				makeCell('B'),
			]),
			makeRow([
				makeCell('', { verticalMerge: 'continue' }),
				makeCell('D'),
			]),
		]);
		const grid = buildCellGrid(table);
		expect(grid[0][0]).toBe(grid[1][0]); // same entry
		expect(grid[0][0]!.rowSpan).toBe(2);
	});

	it('returns empty array for empty table', () => {
		const table = makeTable([]);
		const grid = buildCellGrid(table);
		expect(grid).toHaveLength(0);
	});
});

describe('resolveColumnWidths', () => {
	it('divides evenly when no grid specified', () => {
		const table = makeTable([
			makeRow([makeCell('A'), makeCell('B'), makeCell('C')]),
		]);
		const widths = resolveColumnWidths(table, 300);
		expect(widths).toHaveLength(3);
		expect(widths[0]).toBeCloseTo(100);
		expect(widths[1]).toBeCloseTo(100);
		expect(widths[2]).toBeCloseTo(100);
	});

	it('uses grid widths when provided', () => {
		const table = makeTable(
			[makeRow([makeCell('A'), makeCell('B')])],
			[{ width: 3000 }, { width: 6000 }],
		);
		const widths = resolveColumnWidths(table, 600);
		expect(widths).toHaveLength(2);
		// 3000 twips and 6000 twips in a 1:2 ratio
		expect(widths[1]).toBeGreaterThan(widths[0]);
	});

	it('scales grid widths to fit available width', () => {
		const table = makeTable(
			[makeRow([makeCell('A'), makeCell('B')])],
			[{ width: 5000 }, { width: 5000 }],
		);
		const widths = resolveColumnWidths(table, 200);
		const total = widths.reduce((a, b) => a + b, 0);
		expect(total).toBeCloseTo(200, 0);
	});

	it('handles percentage-based table width', () => {
		const table = makeTable(
			[makeRow([makeCell('A'), makeCell('B')])],
			[],
			{ width: { type: 'pct', value: 2500 } }, // 50%
		);
		const widths = resolveColumnWidths(table, 600);
		const total = widths.reduce((a, b) => a + b, 0);
		expect(total).toBeCloseTo(300, 0); // 50% of 600
	});
});

describe('layoutTable', () => {
	const measurer = new TextMeasurer();

	it('returns a table with correct structure', () => {
		const table = makeTable(
			[
				makeRow([makeCell('A'), makeCell('B')]),
				makeRow([makeCell('C'), makeCell('D')]),
			],
			[{ width: 3000 }, { width: 3000 }],
		);

		const result = layoutTable(
			table,
			[0, 0],
			400,
			10,
			20,
			emptyStyles,
			measurer,
			simpleContentLayout,
		);

		expect(result.kind).toBe('table');
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0].cells).toHaveLength(2);
		expect(result.rows[1].cells).toHaveLength(2);
	});

	it('positions table at startX and startY', () => {
		const table = makeTable(
			[makeRow([makeCell('A')])],
			[{ width: 3000 }],
		);

		const result = layoutTable(
			table,
			[0, 0],
			200,
			50,
			100,
			emptyStyles,
			measurer,
			simpleContentLayout,
		);

		expect(result.x).toBe(50);
		expect(result.y).toBe(100);
	});

	it('rows are stacked vertically', () => {
		const table = makeTable(
			[
				makeRow([makeCell('Row1')]),
				makeRow([makeCell('Row2')]),
			],
			[{ width: 5000 }],
		);

		const result = layoutTable(
			table,
			[0, 0],
			400,
			0,
			0,
			emptyStyles,
			measurer,
			simpleContentLayout,
		);

		expect(result.rows[1].y).toBeGreaterThan(result.rows[0].y);
	});

	it('total height equals sum of row heights', () => {
		const table = makeTable(
			[
				makeRow([makeCell('A')]),
				makeRow([makeCell('B')]),
			],
			[{ width: 5000 }],
		);

		const result = layoutTable(
			table,
			[0, 0],
			400,
			0,
			0,
			emptyStyles,
			measurer,
			simpleContentLayout,
		);

		const rowHeightSum = result.rows.reduce((sum, row) => sum + row.height, 0);
		expect(result.height).toBeCloseTo(rowHeightSum, 0);
	});

	it('cells have width and height > 0', () => {
		const table = makeTable(
			[makeRow([makeCell('A'), makeCell('B')])],
			[{ width: 3000 }, { width: 3000 }],
		);

		const result = layoutTable(
			table,
			[0, 0],
			400,
			0,
			0,
			emptyStyles,
			measurer,
			simpleContentLayout,
		);

		for (const cell of result.rows[0].cells) {
			expect(cell.width).toBeGreaterThan(0);
			expect(cell.height).toBeGreaterThan(0);
		}
	});
});
