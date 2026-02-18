import type {
	JPTableCellProperties,
	JPTableGridCol,
	JPTableProperties,
	JPTableRowProperties,
} from '../properties/table-props';
import type { JPElement } from './node';
import type { JPParagraph } from './paragraph';

/**
 * Block nodes that can appear inside a table cell.
 * Cells can contain paragraphs and nested tables.
 */
export type JPCellContent = JPParagraph | JPTable;

/**
 * JPTableCell maps to OOXML w:tc.
 */
export interface JPTableCell extends JPElement {
	readonly type: 'table-cell';
	readonly children: readonly JPCellContent[];
	readonly properties: JPTableCellProperties;
}

/**
 * JPTableRow maps to OOXML w:tr.
 */
export interface JPTableRow extends JPElement {
	readonly type: 'table-row';
	readonly children: readonly JPTableCell[];
	readonly properties: JPTableRowProperties;
}

/**
 * JPTable maps to OOXML w:tbl.
 */
export interface JPTable extends JPElement {
	readonly type: 'table';
	readonly children: readonly JPTableRow[];
	readonly properties: JPTableProperties;
	readonly grid: readonly JPTableGridCol[];
}

export function createTable(
	id: string,
	rows: readonly JPTableRow[],
	properties: JPTableProperties = {},
	grid: readonly JPTableGridCol[] = [],
): JPTable {
	return { type: 'table', id, children: rows, properties, grid };
}

export function createTableRow(
	id: string,
	cells: readonly JPTableCell[],
	properties: JPTableRowProperties = {},
): JPTableRow {
	return { type: 'table-row', id, children: cells, properties };
}

export function createTableCell(
	id: string,
	content: readonly JPCellContent[],
	properties: JPTableCellProperties = {},
): JPTableCell {
	return { type: 'table-cell', id, children: content, properties };
}

export function isTable(node: { type: string }): node is JPTable {
	return node.type === 'table';
}

export function isTableRow(node: { type: string }): node is JPTableRow {
	return node.type === 'table-row';
}

export function isTableCell(node: { type: string }): node is JPTableCell {
	return node.type === 'table-cell';
}
