/**
 * Table layout: resolve column widths, row heights, cell content,
 * and merged cells to produce positioned LayoutTable output.
 */

import type {
	JPPath,
	JPStyleRegistry,
	JPTable,
	JPTableCell,
	JPTableCellProperties,
	JPTableRow,
} from '@jpoffice/model';
import { twipsToPx } from '@jpoffice/model';
import type { TextMeasurer } from './text-measurer';
import type {
	LayoutBlock,
	LayoutRect,
	LayoutTable,
	LayoutTableCell,
	LayoutTableRow,
} from './types';

// ============================================================
// Cell grid for merge resolution
// ============================================================

export interface CellGridEntry {
	readonly ownerRow: number;
	readonly ownerCol: number;
	readonly rowSpan: number;
	readonly colSpan: number;
	readonly cell: JPTableCell;
}

/**
 * Build a grid map from the table's row/cell structure,
 * resolving verticalMerge and gridSpan into concrete spans.
 */
export function buildCellGrid(table: JPTable): CellGridEntry[][] {
	const rowCount = table.children.length;
	if (rowCount === 0) return [];

	const colCount =
		table.grid.length > 0
			? table.grid.length
			: Math.max(
					...table.children.map((r) => {
						let cols = 0;
						for (const c of r.children) {
							cols += c.properties.gridSpan ?? 1;
						}
						return cols;
					}),
				);

	const grid: (CellGridEntry | null)[][] = Array.from({ length: rowCount }, () =>
		Array.from({ length: colCount }, () => null),
	);

	for (let ri = 0; ri < rowCount; ri++) {
		const row = table.children[ri];
		let gridCol = 0;

		for (let ci = 0; ci < row.children.length; ci++) {
			while (gridCol < colCount && grid[ri][gridCol] !== null) {
				gridCol++;
			}
			if (gridCol >= colCount) break;

			const cell = row.children[ci];
			const colSpan = cell.properties.gridSpan ?? 1;

			let rowSpan = 1;
			if (cell.properties.verticalMerge === 'restart') {
				for (let nextRow = ri + 1; nextRow < rowCount; nextRow++) {
					const nextCell = findCellAtGridCol(table.children[nextRow], gridCol);
					if (nextCell && nextCell.properties.verticalMerge === 'continue') {
						rowSpan++;
					} else {
						break;
					}
				}
			} else if (cell.properties.verticalMerge === 'continue') {
				gridCol += colSpan;
				continue;
			}

			const entry: CellGridEntry = { ownerRow: ri, ownerCol: gridCol, rowSpan, colSpan, cell };

			for (let r = ri; r < ri + rowSpan && r < rowCount; r++) {
				for (let c = gridCol; c < gridCol + colSpan && c < colCount; c++) {
					grid[r][c] = entry;
				}
			}

			gridCol += colSpan;
		}
	}

	return grid as CellGridEntry[][];
}

function findCellAtGridCol(row: JPTableRow, targetCol: number): JPTableCell | null {
	let col = 0;
	for (const cell of row.children) {
		const span = cell.properties.gridSpan ?? 1;
		if (col === targetCol) return cell;
		col += span;
		if (col > targetCol) return null;
	}
	return null;
}

// ============================================================
// Column width resolution
// ============================================================

export function resolveColumnWidths(table: JPTable, availableWidthPx: number): number[] {
	const colCount =
		table.grid.length > 0
			? table.grid.length
			: Math.max(
					1,
					...table.children.map((r) => {
						let cols = 0;
						for (const c of r.children) cols += c.properties.gridSpan ?? 1;
						return cols;
					}),
				);

	if (table.grid.length > 0) {
		const widths = table.grid.map((g) => twipsToPx(g.width));
		const total = widths.reduce((a, b) => a + b, 0);
		if (total > 0 && Math.abs(total - availableWidthPx) > 1) {
			const scale = availableWidthPx / total;
			return widths.map((w) => w * scale);
		}
		return widths;
	}

	if (table.properties.width) {
		const tw = table.properties.width;
		let tableWidth = availableWidthPx;
		if (tw.type === 'dxa') {
			tableWidth = twipsToPx(tw.value);
		} else if (tw.type === 'pct') {
			tableWidth = availableWidthPx * (tw.value / 5000);
		}
		return Array.from({ length: colCount }, () => tableWidth / colCount);
	}

	return Array.from({ length: colCount }, () => availableWidthPx / colCount);
}

// ============================================================
// Table layout
// ============================================================

/**
 * Callback for laying out cell content (paragraphs/nested tables).
 * This avoids circular dependency with layout-engine.
 */
export type CellContentLayoutFn = (
	cell: JPTableCell,
	cellPath: JPPath,
	contentWidthPx: number,
	styles: JPStyleRegistry,
) => { blocks: LayoutBlock[]; height: number };

/**
 * Lay out a table, returning a LayoutTable with positioned cells.
 */
export function layoutTable(
	table: JPTable,
	tablePath: JPPath,
	availableWidthPx: number,
	startX: number,
	startY: number,
	styles: JPStyleRegistry,
	_measurer: TextMeasurer,
	layoutCellContent: CellContentLayoutFn,
): LayoutTable {
	const columnWidths = resolveColumnWidths(table, availableWidthPx);
	const grid = buildCellGrid(table);
	const rowCount = table.children.length;
	const colCount = columnWidths.length;

	const defaultCellMargin = table.properties.cellMargins
		? {
				top: twipsToPx(table.properties.cellMargins.top),
				right: twipsToPx(table.properties.cellMargins.right),
				bottom: twipsToPx(table.properties.cellMargins.bottom),
				left: twipsToPx(table.properties.cellMargins.left),
			}
		: { top: 1, right: 5, bottom: 1, left: 5 };

	// Phase 1: Measure cell content heights
	const cellContentHeights: number[][] = Array.from({ length: rowCount }, () =>
		Array.from({ length: colCount }, () => 0),
	);
	const cellBlocks: Map<string, { blocks: LayoutBlock[]; height: number }> = new Map();
	const seen = new Set<string>();

	for (let ri = 0; ri < rowCount; ri++) {
		for (let ci = 0; ci < colCount; ci++) {
			const entry = grid[ri]?.[ci];
			if (!entry) continue;

			const entryKey = `${entry.ownerRow}-${entry.ownerCol}`;
			if (seen.has(entryKey)) continue;
			seen.add(entryKey);

			const cellMargin = getCellMargins(entry.cell.properties, defaultCellMargin);
			const cellWidth = getCellSpanWidth(columnWidths, entry.ownerCol, entry.colSpan);
			const contentWidth = cellWidth - cellMargin.left - cellMargin.right;

			const cellPath: JPPath = [...tablePath, entry.ownerRow, entry.ownerCol];
			const result = layoutCellContent(entry.cell, cellPath, Math.max(contentWidth, 10), styles);
			cellBlocks.set(entryKey, result);
			cellContentHeights[entry.ownerRow][entry.ownerCol] =
				result.height + cellMargin.top + cellMargin.bottom;
		}
	}

	// Phase 2: Compute row heights
	const rowHeights: number[] = Array.from({ length: rowCount }, () => 0);
	for (let ri = 0; ri < rowCount; ri++) {
		const row = table.children[ri];
		let maxHeight = 0;

		for (let ci = 0; ci < colCount; ci++) {
			const entry = grid[ri]?.[ci];
			if (!entry) continue;
			if (entry.ownerRow + entry.rowSpan - 1 !== ri) continue;

			const contentHeight = cellContentHeights[entry.ownerRow]?.[entry.ownerCol] ?? 0;
			let priorRowsHeight = 0;
			for (let r = entry.ownerRow; r < ri; r++) {
				priorRowsHeight += rowHeights[r];
			}
			maxHeight = Math.max(maxHeight, contentHeight - priorRowsHeight);
		}

		const rowProps = row.properties;
		if (rowProps.height) {
			const specifiedHeight = twipsToPx(rowProps.height.value);
			if (rowProps.height.rule === 'exact') {
				maxHeight = specifiedHeight;
			} else if (rowProps.height.rule === 'atLeast') {
				maxHeight = Math.max(maxHeight, specifiedHeight);
			}
		}

		rowHeights[ri] = Math.max(maxHeight, 14);
	}

	// Phase 3: Position rows and cells
	const layoutRows: LayoutTableRow[] = [];
	let currentY = startY;

	for (let ri = 0; ri < rowCount; ri++) {
		const row = table.children[ri];
		const rowHeight = rowHeights[ri];

		const layoutCells: LayoutTableCell[] = [];
		const seenInRow = new Set<string>();

		let cellX = startX;
		for (let ci = 0; ci < colCount; ci++) {
			const entry = grid[ri]?.[ci];
			if (!entry) {
				cellX += columnWidths[ci];
				continue;
			}

			const entryKey = `${entry.ownerRow}-${entry.ownerCol}`;
			if (seenInRow.has(entryKey) || entry.ownerRow !== ri) {
				cellX += columnWidths[ci];
				continue;
			}
			seenInRow.add(entryKey);

			const cellWidth = getCellSpanWidth(columnWidths, entry.ownerCol, entry.colSpan);
			let cellHeight = 0;
			for (let r = ri; r < ri + entry.rowSpan && r < rowCount; r++) {
				cellHeight += rowHeights[r];
			}

			const cellMargin = getCellMargins(entry.cell.properties, defaultCellMargin);
			const contentRect: LayoutRect = {
				x: cellX + cellMargin.left,
				y: currentY + cellMargin.top,
				width: cellWidth - cellMargin.left - cellMargin.right,
				height: cellHeight - cellMargin.top - cellMargin.bottom,
			};

			const cached = cellBlocks.get(entryKey);
			const blocks = cached?.blocks ?? [];

			const vAlign = entry.cell.properties.verticalAlignment ?? 'top';
			let contentY = contentRect.y;
			if (vAlign === 'center' && cached) {
				contentY += (contentRect.height - cached.height) / 2;
			} else if (vAlign === 'bottom' && cached) {
				contentY += contentRect.height - cached.height;
			}

			const repositionedBlocks =
				vAlign !== 'top' && cached ? offsetBlocks(blocks, contentY - contentRect.y) : blocks;

			layoutCells.push({
				nodeId: entry.cell.id,
				x: cellX,
				y: currentY,
				width: cellWidth,
				height: cellHeight,
				contentRect,
				blocks: repositionedBlocks,
				borders: entry.cell.properties.borders,
				shading: entry.cell.properties.shading,
				verticalAlignment: vAlign,
				gridSpan: entry.colSpan,
				rowSpan: entry.rowSpan,
			});

			cellX += cellWidth;
		}

		layoutRows.push({
			nodeId: row.id,
			x: startX,
			y: currentY,
			width: columnWidths.reduce((a, b) => a + b, 0),
			height: rowHeight,
			cells: layoutCells,
			isHeader: row.properties.isHeader ?? false,
		});

		currentY += rowHeight;
	}

	const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
	const totalHeight = currentY - startY;

	return {
		kind: 'table',
		nodeId: table.id,
		path: tablePath,
		x: startX,
		y: startY,
		width: totalWidth,
		height: totalHeight,
		rows: layoutRows,
		borders: table.properties.borders,
	};
}

// ============================================================
// Helpers
// ============================================================

function getCellSpanWidth(columnWidths: number[], startCol: number, colSpan: number): number {
	let w = 0;
	for (let c = startCol; c < startCol + colSpan && c < columnWidths.length; c++) {
		w += columnWidths[c];
	}
	return w;
}

interface Margins {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

function getCellMargins(cellProps: JPTableCellProperties, defaultMargins: Margins): Margins {
	if (cellProps.margins) {
		return {
			top: twipsToPx(cellProps.margins.top),
			right: twipsToPx(cellProps.margins.right),
			bottom: twipsToPx(cellProps.margins.bottom),
			left: twipsToPx(cellProps.margins.left),
		};
	}
	return defaultMargins;
}

function offsetBlocks(blocks: readonly LayoutBlock[], deltaY: number): LayoutBlock[] {
	if (deltaY === 0) return blocks as LayoutBlock[];
	return blocks.map((b) => {
		if ('rect' in b) {
			return { ...b, rect: { ...b.rect, y: b.rect.y + deltaY } } as LayoutBlock;
		}
		// LayoutTable uses flat x/y
		return { ...b, y: (b as LayoutTable).y + deltaY } as LayoutBlock;
	});
}
