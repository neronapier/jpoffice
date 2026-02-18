/**
 * Serializes JPTable to RTF table commands.
 */

import type { JPBorderDef, JPTable, JPTableCell, JPTableRow } from '@jpoffice/model';
import { serializeParagraph } from './rtf-paragraph';
import type { RtfWriter } from './rtf-writer';

/** Convert a border style to RTF border commands. */
function buildBorderRtf(
	position: string,
	border: { style: string; width: number; color: string } | undefined,
	writer: RtfWriter,
): string {
	if (!border || border.style === 'none') return '';

	const styleMap: Record<string, string> = {
		single: '\\brdrs',
		double: '\\brdrdb',
		dashed: '\\brdrdash',
		dotted: '\\brdrdot',
		thick: '\\brdrth',
		dashDot: '\\brdrdashd',
		dashDotDot: '\\brdrdashdd',
		wave: '\\brdrwavy',
	};

	let rtf = position;
	rtf += styleMap[border.style] ?? '\\brdrs';
	rtf += `\\brdrw${border.width}`;

	if (border.color) {
		const ci = writer.addColor(border.color);
		rtf += `\\brdrcf${ci}`;
	}

	return rtf;
}

/** Serialize cell borders to RTF. */
function buildCellBorders(
	borders:
		| { top?: JPBorderDef; bottom?: JPBorderDef; left?: JPBorderDef; right?: JPBorderDef }
		| undefined,
	writer: RtfWriter,
): string {
	if (!borders) return '';
	let rtf = '';
	rtf += buildBorderRtf('\\clbrdrt', borders.top, writer);
	rtf += buildBorderRtf('\\clbrdrb', borders.bottom, writer);
	rtf += buildBorderRtf('\\clbrdrl', borders.left, writer);
	rtf += buildBorderRtf('\\clbrdrr', borders.right, writer);
	return rtf;
}

/** Serialize a single table row to RTF. */
function serializeTableRow(
	row: JPTableRow,
	grid: readonly { width: number }[],
	cellStartIndex: number,
	writer: RtfWriter,
): string {
	let rtf = '\\trowd';

	// Row height
	if (row.properties.height) {
		const { value, rule } = row.properties.height;
		if (rule === 'exact') {
			rtf += `\\trrh-${value}`; // negative = exact in RTF
		} else {
			rtf += `\\trrh${value}`;
		}
	}

	// Header row
	if (row.properties.isHeader) {
		rtf += '\\trhdr';
	}

	// Cell definitions (must come before cell content)
	let cellX = 0;
	for (let ci = 0; ci < row.children.length; ci++) {
		const cell = row.children[ci];
		const gridSpan = cell.properties.gridSpan ?? 1;

		// Cell borders
		rtf += buildCellBorders(cell.properties.borders, writer);

		// Shading
		if (cell.properties.shading?.fill) {
			const colorIdx = writer.addColor(cell.properties.shading.fill);
			rtf += `\\clshdng0\\clcbpat${colorIdx}`;
		}

		// Vertical alignment
		if (cell.properties.verticalAlignment) {
			const vaMap: Record<string, string> = {
				top: '\\clvertalt',
				center: '\\clvertalc',
				bottom: '\\clvertalb',
			};
			rtf += vaMap[cell.properties.verticalAlignment] ?? '';
		}

		// Vertical merge
		if (cell.properties.verticalMerge === 'restart') {
			rtf += '\\clvmgf';
		} else if (cell.properties.verticalMerge === 'continue') {
			rtf += '\\clvmrg';
		}

		// Cell right boundary (cumulative width in twips)
		for (let g = 0; g < gridSpan; g++) {
			const gridIdx = cellStartIndex + ci + g;
			if (gridIdx < grid.length) {
				cellX += grid[gridIdx].width;
			}
		}
		rtf += `\\cellx${cellX}`;
	}

	// Cell content
	for (const cell of row.children) {
		rtf += serializeCell(cell, writer);
	}

	rtf += '\\row\n';
	return rtf;
}

/** Serialize a single cell's content. */
function serializeCell(cell: JPTableCell, writer: RtfWriter): string {
	let rtf = '';

	for (const child of cell.children) {
		if (child.type === 'paragraph') {
			rtf += serializeParagraph(child, writer);
		} else if (child.type === 'table') {
			// Nested table — RTF supports this with \itap
			rtf += serializeTable(child as JPTable, writer);
		}
	}

	// Replace last \par with \cell
	rtf = rtf.replace(/\\par\n$/, '\\cell\n');

	return rtf;
}

/** Serialize a complete table to RTF. */
export function serializeTable(table: JPTable, writer: RtfWriter): string {
	let rtf = '';

	for (const row of table.children) {
		rtf += serializeTableRow(row, table.grid, 0, writer);
	}

	return rtf;
}
