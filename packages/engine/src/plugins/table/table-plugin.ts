import type { JPPath, JPTableCell, JPTableGridCol } from '@jpoffice/model';
import {
	createParagraph,
	createRun,
	createTable,
	createTableCell,
	createTableRow,
	createText,
	generateId,
	getNodeAtPath,
	isElement,
	traverseTexts,
} from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

/**
 * TablePlugin handles table insertion and structural modifications.
 */
export class TablePlugin implements JPPlugin {
	readonly id = 'jpoffice.table';
	readonly name = 'Table';

	initialize(editor: JPEditor): void {
		editor.registerCommand<{ rows: number; cols: number }>({
			id: 'table.insert',
			name: 'Insert Table',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertTable(editor, args.rows, args.cols),
		});

		editor.registerCommand<{ position: 'above' | 'below' }>({
			id: 'table.insertRow',
			name: 'Insert Row',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.insertRow(editor, args.position),
		});

		editor.registerCommand<{ position: 'left' | 'right' }>({
			id: 'table.insertColumn',
			name: 'Insert Column',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.insertColumn(editor, args.position),
		});

		editor.registerCommand({
			id: 'table.deleteRow',
			name: 'Delete Row',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: () => this.deleteRow(editor),
		});

		editor.registerCommand({
			id: 'table.deleteColumn',
			name: 'Delete Column',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: () => this.deleteColumn(editor),
		});

		editor.registerCommand({
			id: 'table.mergeCells',
			name: 'Merge Cells',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: () => this.mergeCellsHorizontal(editor),
		});

		editor.registerCommand({
			id: 'table.splitCell',
			name: 'Split Cell',
			canExecute: () => !editor.isReadOnly() && this.isInMergedCell(editor),
			execute: () => this.splitCell(editor),
		});

		editor.registerCommand<{ color: string }>({
			id: 'table.setCellShading',
			name: 'Cell Shading',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.setCellShading(editor, args.color),
		});

		editor.registerCommand<{ style: string; width: number; color: string }>({
			id: 'table.setCellBorders',
			name: 'Cell Borders',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.setCellBorders(editor, args),
		});

		editor.registerCommand<{ alignment: 'top' | 'center' | 'bottom' }>({
			id: 'table.setCellVerticalAlign',
			name: 'Cell Vertical Alignment',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.setCellVerticalAlign(editor, args.alignment),
		});

		editor.registerCommand({
			id: 'table.toggleHeaderRow',
			name: 'Toggle Header Row',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: () => this.toggleHeaderRow(editor),
		});

		editor.registerCommand({
			id: 'table.navigateNext',
			name: 'Next Cell',
			canExecute: () => this.isInTable(editor),
			execute: () => this.navigateCell(editor, 'next'),
		});

		editor.registerCommand({
			id: 'table.navigatePrev',
			name: 'Previous Cell',
			canExecute: () => this.isInTable(editor),
			execute: () => this.navigateCell(editor, 'prev'),
		});

		editor.registerCommand<{ columnIndex: number; width: number }>({
			id: 'table.setColumnWidth',
			name: 'Set Column Width',
			canExecute: () => !editor.isReadOnly() && this.isInTable(editor),
			execute: (_ed, args) => this.setColumnWidth(editor, args.columnIndex, args.width),
		});

		editor.registerCommand<{
			tablePath: JPPath;
			changes: Array<{ columnIndex: number; width: number }>;
		}>({
			id: 'table.resizeColumnsAtPath',
			name: 'Resize Columns At Path',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.resizeColumnsAtPath(editor, args.tablePath, args.changes),
		});

		editor.registerCommand<{
			tablePath: JPPath;
			rowIndex: number;
			height: number;
			rule?: 'auto' | 'exact' | 'atLeast';
		}>({
			id: 'table.setRowHeightAtPath',
			name: 'Set Row Height At Path',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) =>
				this.setRowHeightAtPath(editor, args.tablePath, args.rowIndex, args.height, args.rule),
		});
	}

	private isInTable(editor: JPEditor): boolean {
		const sel = editor.getSelection();
		if (!sel) return false;
		return this.findTableContext(editor) !== null;
	}

	private findTableContext(editor: JPEditor): {
		tablePath: JPPath;
		rowIndex: number;
		cellIndex: number;
	} | null {
		const sel = editor.getSelection();
		if (!sel) return null;

		const doc = editor.getDocument();
		const path = sel.anchor.path;

		// Walk up the path looking for a table-cell, table-row, table
		for (let i = path.length - 1; i >= 2; i--) {
			const subPath = path.slice(0, i);
			try {
				const node = getNodeAtPath(doc, subPath);
				if (node.type === 'table') {
					// The indices just after the table path are row and cell
					const rowIndex = path[i];
					const cellIndex = path[i + 1];
					if (rowIndex !== undefined && cellIndex !== undefined) {
						return { tablePath: subPath, rowIndex, cellIndex };
					}
				}
			} catch {
				/* skip invalid path */
			}
		}
		return null;
	}

	private insertTable(editor: JPEditor, rows: number, cols: number): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		const defaultColWidth = 2400; // twips (~1.67 inches)
		const grid: JPTableGridCol[] = Array.from({ length: cols }, () => ({
			width: defaultColWidth,
		}));

		const tableRows = Array.from({ length: rows }, () =>
			createTableRow(
				generateId(),
				Array.from({ length: cols }, () =>
					createTableCell(generateId(), [
						createParagraph(generateId(), [
							createRun(generateId(), [createText(generateId(), '')]),
						]),
					]),
				),
			),
		);

		const table = createTable(generateId(), tableRows, {}, grid);

		// Insert table after current paragraph
		const insertPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex + 1];

		editor.batch(() => {
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: table,
			});

			// Move cursor to first cell
			const firstCellTextPath: JPPath = [...insertPath, 0, 0, 0, 0, 0];
			const newPoint = { path: firstCellTextPath, offset: 0 };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		});
	}

	private insertRow(editor: JPEditor, position: 'above' | 'below'): void {
		const tableCtx = this.findTableContext(editor);
		if (!tableCtx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, tableCtx.tablePath);
		if (!isElement(table)) return;

		const existingRow = table.children[tableCtx.rowIndex];
		if (!isElement(existingRow)) return;

		const colCount = existingRow.children.length;
		const newRow = createTableRow(
			generateId(),
			Array.from({ length: colCount }, () =>
				createTableCell(generateId(), [
					createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), '')])]),
				]),
			),
		);

		const insertIdx = position === 'above' ? tableCtx.rowIndex : tableCtx.rowIndex + 1;
		const insertPath: JPPath = [...tableCtx.tablePath, insertIdx];

		editor.apply({
			type: 'insert_node',
			path: insertPath,
			node: newRow,
		});
	}

	private insertColumn(editor: JPEditor, position: 'left' | 'right'): void {
		const tableCtx = this.findTableContext(editor);
		if (!tableCtx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, tableCtx.tablePath);
		if (!isElement(table)) return;

		const colIdx = position === 'left' ? tableCtx.cellIndex : tableCtx.cellIndex + 1;

		editor.batch(() => {
			// Insert a cell in each row
			for (let rowIdx = 0; rowIdx < table.children.length; rowIdx++) {
				const cellPath: JPPath = [...tableCtx.tablePath, rowIdx, colIdx];
				const newCell = createTableCell(generateId(), [
					createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), '')])]),
				]);
				editor.apply({
					type: 'insert_node',
					path: cellPath,
					node: newCell,
				});
			}
		});
	}

	private deleteRow(editor: JPEditor): void {
		const tableCtx = this.findTableContext(editor);
		if (!tableCtx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, tableCtx.tablePath);
		if (!isElement(table)) return;

		if (table.children.length <= 1) {
			// Last row — remove entire table
			editor.apply({
				type: 'remove_node',
				path: tableCtx.tablePath,
				node: table,
			});
		} else {
			const rowPath: JPPath = [...tableCtx.tablePath, tableCtx.rowIndex];
			const row = table.children[tableCtx.rowIndex];
			editor.apply({
				type: 'remove_node',
				path: rowPath,
				node: row,
			});
		}
	}

	private deleteColumn(editor: JPEditor): void {
		const tableCtx = this.findTableContext(editor);
		if (!tableCtx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, tableCtx.tablePath);
		if (!isElement(table)) return;

		// Check if this is the last column
		const firstRow = table.children[0];
		if (!isElement(firstRow)) return;

		if (firstRow.children.length <= 1) {
			// Last column — remove entire table
			editor.apply({
				type: 'remove_node',
				path: tableCtx.tablePath,
				node: table,
			});
			return;
		}

		editor.batch(() => {
			// Remove cell from each row, in reverse order to keep indices valid
			for (let rowIdx = table.children.length - 1; rowIdx >= 0; rowIdx--) {
				const row = table.children[rowIdx];
				if (!isElement(row)) continue;
				const cellPath: JPPath = [...tableCtx.tablePath, rowIdx, tableCtx.cellIndex];
				const cell = row.children[tableCtx.cellIndex];
				if (cell) {
					editor.apply({
						type: 'remove_node',
						path: cellPath,
						node: cell,
					});
				}
			}
		});
	}

	// ── Helper: isInMergedCell ─────────────────────────────────────

	private isInMergedCell(editor: JPEditor): boolean {
		const ctx = this.findTableContext(editor);
		if (!ctx) return false;
		const doc = editor.getDocument();
		const cellPath: JPPath = [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex];
		try {
			const cell = getNodeAtPath(doc, cellPath);
			if (cell.type !== 'table-cell') return false;
			const tcCell = cell as JPTableCell;
			return (
				(tcCell.properties?.gridSpan ?? 1) > 1 || tcCell.properties?.verticalMerge === 'restart'
			);
		} catch {
			return false;
		}
	}

	// ── Helper: findCellPath ──────────────────────────────────────

	private findCellPath(editor: JPEditor): JPPath | null {
		const ctx = this.findTableContext(editor);
		if (!ctx) return null;
		return [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex];
	}

	// ── Helper: find first text node in a subtree ─────────────────

	private findFirstTextInSubtree(
		doc: { type: string; children?: readonly unknown[] },
		basePath: JPPath,
	): JPPath | null {
		const node = getNodeAtPath(doc as never, basePath);
		for (const [, textPath] of traverseTexts(node as never, basePath)) {
			return textPath;
		}
		return null;
	}

	// ── Merge Cells Horizontal ────────────────────────────────────

	private mergeCellsHorizontal(editor: JPEditor): void {
		const ctx = this.findTableContext(editor);
		if (!ctx) return;

		const doc = editor.getDocument();
		const row = getNodeAtPath(doc, [...ctx.tablePath, ctx.rowIndex]);
		if (!isElement(row)) return;

		// Need at least one cell to the right
		if (ctx.cellIndex >= row.children.length - 1) return;

		const cellPath: JPPath = [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex];
		const currentCell = getNodeAtPath(doc, cellPath) as JPTableCell;
		const rightCellPath: JPPath = [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex + 1];
		const rightCell = getNodeAtPath(doc, rightCellPath) as JPTableCell;

		const currentSpan = currentCell.properties?.gridSpan ?? 1;
		const rightSpan = rightCell.properties?.gridSpan ?? 1;
		const newSpan = currentSpan + rightSpan;

		editor.batch(() => {
			// 1. Append paragraphs from right cell into current cell
			if (isElement(rightCell)) {
				for (let i = 0; i < rightCell.children.length; i++) {
					const child = rightCell.children[i];
					const insertIdx = isElement(currentCell) ? currentCell.children.length + i : i;
					editor.apply({
						type: 'insert_node',
						path: [...cellPath, insertIdx],
						node: child,
					});
				}
			}

			// 2. Remove the right cell (its index is still cellIndex + 1 because
			//    we only inserted children *inside* the current cell, not at the row level)
			editor.apply({
				type: 'remove_node',
				path: rightCellPath,
				node: rightCell,
			});

			// 3. Set gridSpan on the current cell
			editor.apply({
				type: 'set_properties',
				path: cellPath,
				properties: { gridSpan: newSpan },
				oldProperties: { gridSpan: currentCell.properties?.gridSpan ?? undefined },
			});
		});
	}

	// ── Split Cell ────────────────────────────────────────────────

	private splitCell(editor: JPEditor): void {
		const ctx = this.findTableContext(editor);
		if (!ctx) return;

		const doc = editor.getDocument();
		const cellPath: JPPath = [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex];
		const cell = getNodeAtPath(doc, cellPath) as JPTableCell;

		const gridSpan = cell.properties?.gridSpan ?? 1;
		if (gridSpan <= 1) return;

		editor.batch(() => {
			// 1. Reduce gridSpan to 1 on the current cell
			editor.apply({
				type: 'set_properties',
				path: cellPath,
				properties: { gridSpan: 1 },
				oldProperties: { gridSpan },
			});

			// 2. Insert (gridSpan - 1) new empty cells after the current cell
			for (let i = 0; i < gridSpan - 1; i++) {
				const newCellPath: JPPath = [...ctx.tablePath, ctx.rowIndex, ctx.cellIndex + 1 + i];
				const newCell = createTableCell(generateId(), [
					createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), '')])]),
				]);
				editor.apply({
					type: 'insert_node',
					path: newCellPath,
					node: newCell,
				});
			}
		});
	}

	// ── Set Cell Shading ──────────────────────────────────────────

	private setCellShading(editor: JPEditor, color: string): void {
		const cellPath = this.findCellPath(editor);
		if (!cellPath) return;

		const doc = editor.getDocument();
		const cell = getNodeAtPath(doc, cellPath) as JPTableCell;

		editor.apply({
			type: 'set_properties',
			path: cellPath,
			properties: { shading: { fill: color } },
			oldProperties: { shading: cell.properties?.shading ?? undefined },
		});
	}

	// ── Set Cell Borders ──────────────────────────────────────────

	private setCellBorders(
		editor: JPEditor,
		args: { style: string; width: number; color: string },
	): void {
		const cellPath = this.findCellPath(editor);
		if (!cellPath) return;

		const doc = editor.getDocument();
		const cell = getNodeAtPath(doc, cellPath) as JPTableCell;

		const borderDef = {
			style: args.style,
			width: args.width,
			color: args.color,
		};

		const borders = {
			top: borderDef,
			bottom: borderDef,
			left: borderDef,
			right: borderDef,
		};

		editor.apply({
			type: 'set_properties',
			path: cellPath,
			properties: { borders },
			oldProperties: { borders: cell.properties?.borders ?? undefined },
		});
	}

	// ── Set Cell Vertical Alignment ───────────────────────────────

	private setCellVerticalAlign(editor: JPEditor, alignment: 'top' | 'center' | 'bottom'): void {
		const cellPath = this.findCellPath(editor);
		if (!cellPath) return;

		const doc = editor.getDocument();
		const cell = getNodeAtPath(doc, cellPath) as JPTableCell;

		editor.apply({
			type: 'set_properties',
			path: cellPath,
			properties: { verticalAlignment: alignment },
			oldProperties: {
				verticalAlignment: cell.properties?.verticalAlignment ?? undefined,
			},
		});
	}

	// ── Toggle Header Row ─────────────────────────────────────────

	private toggleHeaderRow(editor: JPEditor): void {
		const ctx = this.findTableContext(editor);
		if (!ctx) return;

		const doc = editor.getDocument();
		const firstRowPath: JPPath = [...ctx.tablePath, 0];
		const firstRow = getNodeAtPath(doc, firstRowPath);
		if (firstRow.type !== 'table-row') return;

		const currentIsHeader =
			(firstRow as { properties?: { isHeader?: boolean } }).properties?.isHeader ?? false;

		editor.apply({
			type: 'set_properties',
			path: firstRowPath,
			properties: { isHeader: !currentIsHeader },
			oldProperties: { isHeader: currentIsHeader || undefined },
		});
	}

	// ── Navigate Cell (Tab / Shift+Tab) ───────────────────────────

	private navigateCell(editor: JPEditor, direction: 'next' | 'prev'): void {
		const ctx = this.findTableContext(editor);
		if (!ctx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, ctx.tablePath);
		if (!isElement(table)) return;

		let targetRowIdx = ctx.rowIndex;
		let targetCellIdx = ctx.cellIndex;

		if (direction === 'next') {
			targetCellIdx++;
			const currentRow = table.children[targetRowIdx];
			if (!isElement(currentRow) || targetCellIdx >= currentRow.children.length) {
				// Move to first cell of next row
				targetRowIdx++;
				targetCellIdx = 0;
				if (targetRowIdx >= table.children.length) {
					// Past last row — insert a new row and move there
					const lastRow = table.children[table.children.length - 1];
					if (!isElement(lastRow)) return;
					const colCount = lastRow.children.length;
					const newRow = createTableRow(
						generateId(),
						Array.from({ length: colCount }, () =>
							createTableCell(generateId(), [
								createParagraph(generateId(), [
									createRun(generateId(), [createText(generateId(), '')]),
								]),
							]),
						),
					);
					const newRowPath: JPPath = [...ctx.tablePath, targetRowIdx];
					editor.apply({
						type: 'insert_node',
						path: newRowPath,
						node: newRow,
					});
					// Set selection to first text in the new row's first cell
					const firstTextPath: JPPath = [...newRowPath, 0, 0, 0, 0];
					const point = { path: firstTextPath, offset: 0 };
					editor.setSelection({ anchor: point, focus: point });
					return;
				}
			}
		} else {
			// prev
			targetCellIdx--;
			if (targetCellIdx < 0) {
				targetRowIdx--;
				if (targetRowIdx < 0) {
					// Already at the very first cell; do nothing
					return;
				}
				const prevRow = table.children[targetRowIdx];
				if (!isElement(prevRow)) return;
				targetCellIdx = prevRow.children.length - 1;
			}
		}

		// Move cursor to first text node of target cell
		const targetCellPath: JPPath = [...ctx.tablePath, targetRowIdx, targetCellIdx];
		const updatedDoc = editor.getDocument();
		const textPath = this.findFirstTextInSubtree(updatedDoc, targetCellPath);
		if (textPath) {
			const point = { path: textPath, offset: 0 };
			editor.setSelection({ anchor: point, focus: point });
		}
	}

	// ── Resize Columns At Path (overlay-driven) ─────────────────

	private resizeColumnsAtPath(
		editor: JPEditor,
		tablePath: JPPath,
		changes: Array<{ columnIndex: number; width: number }>,
	): void {
		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, tablePath);
		if (table.type !== 'table') return;

		const tableTyped = table as unknown as { grid: readonly JPTableGridCol[]; properties: unknown };
		const grid = tableTyped.grid;

		const newGrid = grid.map((col, i) => {
			const change = changes.find((c) => c.columnIndex === i);
			return change ? { ...col, width: change.width } : col;
		});

		editor.apply({
			type: 'set_properties',
			path: tablePath,
			properties: { grid: newGrid },
			oldProperties: { grid },
		});
	}

	// ── Set Row Height At Path (overlay-driven) ──────────────────

	private setRowHeightAtPath(
		editor: JPEditor,
		tablePath: JPPath,
		rowIndex: number,
		height: number,
		rule: 'auto' | 'exact' | 'atLeast' = 'atLeast',
	): void {
		const doc = editor.getDocument();
		const rowPath: JPPath = [...tablePath, rowIndex];
		const row = getNodeAtPath(doc, rowPath);
		if (row.type !== 'table-row') return;

		const oldHeight = (
			row as unknown as { properties: { height?: { value: number; rule: string } } }
		).properties?.height;

		editor.apply({
			type: 'set_properties',
			path: rowPath,
			properties: { height: { value: height, rule } },
			oldProperties: { height: oldHeight ?? undefined },
		});
	}

	// ── Set Column Width ──────────────────────────────────────────

	private setColumnWidth(editor: JPEditor, columnIndex: number, width: number): void {
		const ctx = this.findTableContext(editor);
		if (!ctx) return;

		const doc = editor.getDocument();
		const table = getNodeAtPath(doc, ctx.tablePath);
		if (table.type !== 'table') return;

		const tableTyped = table as unknown as { grid: readonly JPTableGridCol[]; properties: unknown };
		const grid = tableTyped.grid;
		if (columnIndex < 0 || columnIndex >= grid.length) return;

		// Build a new grid array with the updated width
		const newGrid = grid.map((col, i) => (i === columnIndex ? { ...col, width } : col));

		// Use set_properties on the table to update the grid
		// The grid is a top-level field on JPTable, not inside properties,
		// so we use set_properties with the grid field
		editor.apply({
			type: 'set_properties',
			path: ctx.tablePath,
			properties: { grid: newGrid },
			oldProperties: { grid },
		});
	}
}
