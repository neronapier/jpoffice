import type { JPTable, JPTableCell, JPTableRow } from '@jpoffice/model';
import type { XmlBuilder } from '../xml/xml-builder';
import type { WriteParagraphFn } from './document-writer';
import type { RelationshipTracker } from './relationships-writer';

/** Serialize a JPTable to w:tbl XML. */
export function writeTable(
	b: XmlBuilder,
	table: JPTable,
	tracker: RelationshipTracker,
	writeParagraph: WriteParagraphFn,
): void {
	b.open('w:tbl');

	// Table properties
	writeTableProperties(b, table);

	// Grid
	if (table.grid.length > 0) {
		b.open('w:tblGrid');
		for (const col of table.grid) {
			b.empty('w:gridCol', { 'w:w': col.width });
		}
		b.close();
	}

	// Rows
	for (const row of table.children as readonly JPTableRow[]) {
		writeTableRow(b, row, tracker, writeParagraph);
	}

	b.close(); // w:tbl
}

function writeTableProperties(b: XmlBuilder, table: JPTable): void {
	const props = table.properties;
	if (!props || Object.keys(props).length === 0) return;

	b.open('w:tblPr');

	if (props.styleId) b.empty('w:tblStyle', { 'w:val': props.styleId });

	if (props.width) {
		b.empty('w:tblW', { 'w:w': props.width.value, 'w:type': props.width.type });
	}

	if (props.alignment) b.empty('w:jc', { 'w:val': props.alignment });

	if (props.indent !== undefined) {
		b.empty('w:tblInd', { 'w:w': props.indent, 'w:type': 'dxa' });
	}

	if (props.borders) {
		b.open('w:tblBorders');
		for (const side of ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'] as const) {
			const border = props.borders[side];
			if (border) {
				b.empty(`w:${side}`, {
					'w:val': border.style,
					'w:sz': border.width,
					'w:color': border.color,
					...(border.spacing !== undefined ? { 'w:space': border.spacing } : {}),
				});
			}
		}
		b.close();
	}

	if (props.cellMargins) {
		b.open('w:tblCellMar');
		b.empty('w:top', { 'w:w': props.cellMargins.top, 'w:type': 'dxa' });
		b.empty('w:start', { 'w:w': props.cellMargins.left, 'w:type': 'dxa' });
		b.empty('w:bottom', { 'w:w': props.cellMargins.bottom, 'w:type': 'dxa' });
		b.empty('w:end', { 'w:w': props.cellMargins.right, 'w:type': 'dxa' });
		b.close();
	}

	if (props.layout) b.empty('w:tblLayout', { 'w:type': props.layout });

	b.close(); // w:tblPr
}

function writeTableRow(
	b: XmlBuilder,
	row: JPTableRow,
	tracker: RelationshipTracker,
	writeParagraph: WriteParagraphFn,
): void {
	b.open('w:tr');

	const props = row.properties;
	if (props && Object.keys(props).length > 0) {
		b.open('w:trPr');
		if (props.height) {
			b.empty('w:trHeight', {
				'w:val': props.height.value,
				'w:hRule': props.height.rule,
			});
		}
		if (props.isHeader) b.empty('w:tblHeader');
		if (props.cantSplit) b.empty('w:cantSplit');
		b.close(); // w:trPr
	}

	for (const cell of row.children as readonly JPTableCell[]) {
		writeTableCell(b, cell, tracker, writeParagraph);
	}

	b.close(); // w:tr
}

function writeTableCell(
	b: XmlBuilder,
	cell: JPTableCell,
	tracker: RelationshipTracker,
	writeParagraph: WriteParagraphFn,
): void {
	b.open('w:tc');

	const props = cell.properties;
	if (props && Object.keys(props).length > 0) {
		b.open('w:tcPr');

		if (props.width) {
			b.empty('w:tcW', { 'w:w': props.width.value, 'w:type': props.width.type });
		}
		if (props.gridSpan) b.empty('w:gridSpan', { 'w:val': props.gridSpan });
		if (props.verticalMerge) {
			if (props.verticalMerge === 'restart') {
				b.empty('w:vMerge', { 'w:val': 'restart' });
			} else {
				b.empty('w:vMerge');
			}
		}
		if (props.borders) {
			b.open('w:tcBorders');
			for (const side of ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'] as const) {
				const border = props.borders[side];
				if (border) {
					b.empty(`w:${side}`, {
						'w:val': border.style,
						'w:sz': border.width,
						'w:color': border.color,
					});
				}
			}
			b.close();
		}
		if (props.shading) {
			b.empty('w:shd', {
				'w:val': props.shading.pattern || 'clear',
				'w:fill': props.shading.fill,
			});
		}
		if (props.verticalAlignment) {
			b.empty('w:vAlign', { 'w:val': props.verticalAlignment });
		}
		if (props.margins) {
			b.open('w:tcMar');
			b.empty('w:top', { 'w:w': props.margins.top, 'w:type': 'dxa' });
			b.empty('w:start', { 'w:w': props.margins.left, 'w:type': 'dxa' });
			b.empty('w:bottom', { 'w:w': props.margins.bottom, 'w:type': 'dxa' });
			b.empty('w:end', { 'w:w': props.margins.right, 'w:type': 'dxa' });
			b.close();
		}
		if (props.textDirection) {
			b.empty('w:textDirection', { 'w:val': props.textDirection });
		}

		b.close(); // w:tcPr
	}

	// Cell content
	for (const child of cell.children) {
		if (child.type === 'paragraph') {
			writeParagraph(b, child, tracker);
		} else if (child.type === 'table') {
			writeTable(b, child, tracker, writeParagraph);
		}
	}

	b.close(); // w:tc
}
