import type { JPPath } from '@jpoffice/model';
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
} from '@jpoffice/model';
import type { JPTableGridCol } from '@jpoffice/model';
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
}
