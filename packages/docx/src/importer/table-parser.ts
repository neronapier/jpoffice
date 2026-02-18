import type {
	JPCellContent,
	JPTableCellProperties,
	JPTableGridCol,
	JPTableProperties,
	JPTableRowProperties,
	JPTableWidth,
	JPTextDirection,
	JPVerticalMerge,
} from '@jpoffice/model';
import {
	createParagraph,
	createTable,
	createTableCell,
	createTableRow,
	generateId,
} from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild } from '../xml/xml-parser';
import type { RelationshipMap } from './relationships-parser';
import { parseCellMargins, parseShading, parseTableBorders } from './run-parser';

// Forward-declared to avoid circular dependency:
// parseParagraphContent is passed as a callback from document-parser
export type ParagraphParser = (
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
) => ReturnType<typeof createParagraph>;

export type MediaBag = Map<string, { data: Uint8Array; contentType: string; fileName: string }>;

/** Parse a w:tbl element into a JPTable. */
export function parseTable(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
	parsePara: ParagraphParser,
): ReturnType<typeof createTable> {
	const tblPr = getFirstChild(el, NS.w, 'tblPr');
	const properties = tblPr ? parseTableProperties(tblPr) : {};

	const tblGrid = getFirstChild(el, NS.w, 'tblGrid');
	const grid: JPTableGridCol[] = tblGrid
		? getDirectChildren(tblGrid, NS.w, 'gridCol').map((gc) => ({
				width: intOrZero(attrNS(gc, NS.w, 'w')),
			}))
		: [];

	const trEls = getDirectChildren(el, NS.w, 'tr');
	const rows = trEls.map((tr) => parseTableRow(tr, rels, mediaBag, parsePara));

	return createTable(generateId(), rows, properties, grid);
}

function parseTableRow(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
	parsePara: ParagraphParser,
): ReturnType<typeof createTableRow> {
	const trPr = getFirstChild(el, NS.w, 'trPr');
	const properties = trPr ? parseRowProperties(trPr) : {};

	const tcEls = getDirectChildren(el, NS.w, 'tc');
	const cells = tcEls.map((tc) => parseTableCell(tc, rels, mediaBag, parsePara));

	return createTableRow(generateId(), cells, properties);
}

function parseTableCell(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
	parsePara: ParagraphParser,
): ReturnType<typeof createTableCell> {
	const tcPr = getFirstChild(el, NS.w, 'tcPr');
	const properties = tcPr ? parseCellProperties(tcPr) : {};

	const content: JPCellContent[] = [];
	const children = el.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI !== NS.w) continue;

		if (ce.localName === 'p') {
			content.push(parsePara(ce, rels, mediaBag));
		} else if (ce.localName === 'tbl') {
			content.push(parseTable(ce, rels, mediaBag, parsePara));
		}
	}

	// Cell must have at least one paragraph
	if (content.length === 0) {
		content.push(createParagraph(generateId(), []));
	}

	return createTableCell(generateId(), content, properties);
}

// ─── Property Parsers ──────────────────────────────────────────────────────

function parseTableProperties(el: Element): JPTableProperties {
	const props: Record<string, unknown> = {};

	const tblStyle = getFirstChild(el, NS.w, 'tblStyle');
	if (tblStyle) props.styleId = attrNS(tblStyle, NS.w, 'val') ?? undefined;

	const tblW = getFirstChild(el, NS.w, 'tblW');
	if (tblW) props.width = parseWidth(tblW);

	const jc = getFirstChild(el, NS.w, 'jc');
	if (jc) {
		const val = attrNS(jc, NS.w, 'val');
		if (val === 'center' || val === 'right' || val === 'left') {
			props.alignment = val;
		}
	}

	const tblBorders = getFirstChild(el, NS.w, 'tblBorders');
	if (tblBorders) props.borders = parseTableBorders(tblBorders);

	const tblCellMar = getFirstChild(el, NS.w, 'tblCellMar');
	if (tblCellMar) props.cellMargins = parseCellMargins(tblCellMar);

	const tblLayout = getFirstChild(el, NS.w, 'tblLayout');
	if (tblLayout) {
		const type = attrNS(tblLayout, NS.w, 'type');
		if (type === 'fixed' || type === 'autofit') props.layout = type;
	}

	const tblInd = getFirstChild(el, NS.w, 'tblInd');
	if (tblInd) {
		const w = attrNS(tblInd, NS.w, 'w');
		if (w) props.indent = Number.parseInt(w, 10);
	}

	return props as JPTableProperties;
}

function parseRowProperties(el: Element): JPTableRowProperties {
	const props: Record<string, unknown> = {};

	const trHeight = getFirstChild(el, NS.w, 'trHeight');
	if (trHeight) {
		const val = attrNS(trHeight, NS.w, 'val');
		const rule = attrNS(trHeight, NS.w, 'hRule');
		if (val) {
			props.height = {
				value: Number.parseInt(val, 10),
				rule: rule === 'exact' ? 'exact' : rule === 'atLeast' ? 'atLeast' : 'auto',
			};
		}
	}

	const tblHeader = getFirstChild(el, NS.w, 'tblHeader');
	if (tblHeader) {
		const val = attrNS(tblHeader, NS.w, 'val');
		if (val !== '0' && val !== 'false') props.isHeader = true;
	}

	const cantSplit = getFirstChild(el, NS.w, 'cantSplit');
	if (cantSplit) {
		const val = attrNS(cantSplit, NS.w, 'val');
		if (val !== '0' && val !== 'false') props.cantSplit = true;
	}

	return props as JPTableRowProperties;
}

function parseCellProperties(el: Element): JPTableCellProperties {
	const props: Record<string, unknown> = {};

	const tcW = getFirstChild(el, NS.w, 'tcW');
	if (tcW) props.width = parseWidth(tcW);

	const vMerge = getFirstChild(el, NS.w, 'vMerge');
	if (vMerge) {
		const val = attrNS(vMerge, NS.w, 'val');
		props.verticalMerge = (val === 'restart' ? 'restart' : 'continue') as JPVerticalMerge;
	}

	const gridSpan = getFirstChild(el, NS.w, 'gridSpan');
	if (gridSpan) {
		const val = attrNS(gridSpan, NS.w, 'val');
		if (val) props.gridSpan = Number.parseInt(val, 10);
	}

	const tcBorders = getFirstChild(el, NS.w, 'tcBorders');
	if (tcBorders) props.borders = parseTableBorders(tcBorders);

	const shd = getFirstChild(el, NS.w, 'shd');
	if (shd) props.shading = parseShading(shd);

	const vAlign = getFirstChild(el, NS.w, 'vAlign');
	if (vAlign) {
		const val = attrNS(vAlign, NS.w, 'val');
		if (val === 'top' || val === 'center' || val === 'bottom') {
			props.verticalAlignment = val;
		}
	}

	const tcMar = getFirstChild(el, NS.w, 'tcMar');
	if (tcMar) props.margins = parseCellMargins(tcMar);

	const textDirection = getFirstChild(el, NS.w, 'textDirection');
	if (textDirection) {
		const val = attrNS(textDirection, NS.w, 'val');
		if (val === 'lrTb' || val === 'tbRl' || val === 'btLr') {
			props.textDirection = val as JPTextDirection;
		}
	}

	return props as JPTableCellProperties;
}

function parseWidth(el: Element): JPTableWidth {
	const w = attrNS(el, NS.w, 'w');
	const type = attrNS(el, NS.w, 'type');
	return {
		value: w ? Number.parseInt(w, 10) : 0,
		type: type === 'pct' ? 'pct' : type === 'auto' ? 'auto' : 'dxa',
	};
}

function intOrZero(val: string | null | undefined): number {
	if (!val) return 0;
	const n = Number.parseInt(val, 10);
	return Number.isNaN(n) ? 0 : n;
}
