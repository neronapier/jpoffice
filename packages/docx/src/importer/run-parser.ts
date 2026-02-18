import type {
	JPAlignment,
	JPBorderDef,
	JPBorderStyle,
	JPInlineNode,
	JPLineSpacingRule,
	JPParagraphBorders,
	JPParagraphProperties,
	JPRunProperties,
	JPShading,
	JPTabLeader,
	JPTabStop,
	JPTabStopType,
	JPTableBorders,
	JPTableCellMargins,
	JPUnderlineStyle,
} from '@jpoffice/model';
import { createColumnBreak, createRun, createTab, createText, generateId } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild, textContent } from '../xml/xml-parser';

// ─── Run Parsing ───────────────────────────────────────────────────────────

/** Parse a w:r element into a JPRun. */
export function parseRun(el: Element): ReturnType<typeof createRun> {
	const rPr = getFirstChild(el, NS.w, 'rPr');
	const properties = rPr ? parseRunProperties(rPr) : {};

	const children: ReturnType<typeof createText>[] = [];

	const nodes = el.childNodes;
	for (let i = 0; i < nodes.length; i++) {
		const child = nodes[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI !== NS.w) continue;

		switch (ce.localName) {
			case 't': {
				const text = textContent(ce);
				children.push(createText(generateId(), text));
				break;
			}
			case 'br': {
				// All break types stored as text content in a run
				children.push(createText(generateId(), '\n'));
				break;
			}
			case 'tab':
				children.push(createText(generateId(), '\t'));
				break;
			case 'cr':
				children.push(createText(generateId(), '\n'));
				break;
		}
	}

	// If no text children, add empty text so run is valid
	if (children.length === 0) {
		children.push(createText(generateId(), ''));
	}

	return createRun(generateId(), children, properties);
}

/**
 * Parse all inline content of a w:r, returning the run and any
 * break elements that should be siblings (page/column breaks).
 */
export function parseRunWithBreaks(el: Element): JPInlineNode[] {
	const rPr = getFirstChild(el, NS.w, 'rPr');
	const properties = rPr ? parseRunProperties(rPr) : {};

	const result: JPInlineNode[] = [];
	let textChildren: ReturnType<typeof createText>[] = [];

	const flushRun = () => {
		if (textChildren.length > 0) {
			result.push(createRun(generateId(), textChildren, properties));
			textChildren = [];
		}
	};

	const nodes = el.childNodes;
	for (let i = 0; i < nodes.length; i++) {
		const child = nodes[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI !== NS.w) continue;

		switch (ce.localName) {
			case 't':
				textChildren.push(createText(generateId(), textContent(ce)));
				break;
			case 'br': {
				const brType = attrNS(ce, NS.w, 'type');
				if (brType === 'column') {
					flushRun();
					result.push(createColumnBreak(generateId()));
				} else if (brType === 'page') {
					// Page breaks are block nodes in the model,
					// convert to line break in inline context
					textChildren.push(createText(generateId(), '\n'));
				} else {
					textChildren.push(createText(generateId(), '\n'));
				}
				break;
			}
			case 'tab':
				flushRun();
				result.push(createTab(generateId()));
				break;
			case 'cr':
				textChildren.push(createText(generateId(), '\n'));
				break;
		}
	}

	flushRun();
	return result;
}

// ─── Run Properties ────────────────────────────────────────────────────────

/** Parse w:rPr element into JPRunProperties. */
export function parseRunProperties(el: Element): JPRunProperties {
	const props: Record<string, unknown> = {};

	const rStyle = getFirstChild(el, NS.w, 'rStyle');
	if (rStyle) props.styleId = wVal(rStyle);

	if (toggleVal(el, 'b')) props.bold = true;
	if (toggleVal(el, 'i')) props.italic = true;

	const u = getFirstChild(el, NS.w, 'u');
	if (u) {
		const uVal = wVal(u);
		if (uVal && uVal !== 'none') props.underline = uVal as JPUnderlineStyle;
	}

	if (toggleVal(el, 'strike')) props.strikethrough = true;
	if (toggleVal(el, 'dstrike')) props.doubleStrikethrough = true;

	const vertAlign = getFirstChild(el, NS.w, 'vertAlign');
	if (vertAlign) {
		const val = wVal(vertAlign);
		if (val === 'superscript') props.superscript = true;
		if (val === 'subscript') props.subscript = true;
	}

	const rFonts = getFirstChild(el, NS.w, 'rFonts');
	if (rFonts) {
		const font =
			attrNS(rFonts, NS.w, 'ascii') || attrNS(rFonts, NS.w, 'hAnsi') || attrNS(rFonts, NS.w, 'cs');
		if (font) props.fontFamily = font;
	}

	const sz = getFirstChild(el, NS.w, 'sz');
	if (sz) {
		const val = wValInt(sz);
		if (val !== undefined) props.fontSize = val;
	}

	const color = getFirstChild(el, NS.w, 'color');
	if (color) {
		const val = wVal(color);
		if (val && val !== 'auto') props.color = val;
	}

	const highlight = getFirstChild(el, NS.w, 'highlight');
	if (highlight) {
		const val = wVal(highlight);
		if (val) props.highlight = val;
	}

	const shd = getFirstChild(el, NS.w, 'shd');
	if (shd) {
		const fill = attrNS(shd, NS.w, 'fill');
		if (fill && fill !== 'auto') props.backgroundColor = fill;
	}

	if (toggleVal(el, 'caps')) props.allCaps = true;
	if (toggleVal(el, 'smallCaps')) props.smallCaps = true;

	const spacing = getFirstChild(el, NS.w, 'spacing');
	if (spacing) {
		const val = wValInt(spacing);
		if (val !== undefined) props.letterSpacing = val;
	}

	const lang = getFirstChild(el, NS.w, 'lang');
	if (lang) {
		const val = wVal(lang);
		if (val) props.language = val;
	}

	return props as JPRunProperties;
}

// ─── Paragraph Properties ──────────────────────────────────────────────────

/** Parse w:pPr element into JPParagraphProperties. */
export function parseParagraphProperties(el: Element): JPParagraphProperties {
	const props: Record<string, unknown> = {};

	const pStyle = getFirstChild(el, NS.w, 'pStyle');
	if (pStyle) props.styleId = wVal(pStyle);

	const jc = getFirstChild(el, NS.w, 'jc');
	if (jc) {
		const val = wVal(jc);
		props.alignment = mapAlignment(val);
	}

	const spacingEl = getFirstChild(el, NS.w, 'spacing');
	if (spacingEl) {
		const spacing: Record<string, unknown> = {};
		const before = wAttrInt(spacingEl, 'before');
		const after = wAttrInt(spacingEl, 'after');
		const line = wAttrInt(spacingEl, 'line');
		const lineRule = attrNS(spacingEl, NS.w, 'lineRule');
		if (before !== undefined) spacing.before = before;
		if (after !== undefined) spacing.after = after;
		if (line !== undefined) spacing.line = line;
		if (lineRule) spacing.lineRule = lineRule as JPLineSpacingRule;
		if (Object.keys(spacing).length > 0) props.spacing = spacing;
	}

	const ind = getFirstChild(el, NS.w, 'ind');
	if (ind) {
		const indent: Record<string, unknown> = {};
		const left = wAttrInt(ind, 'left') ?? wAttrInt(ind, 'start');
		const right = wAttrInt(ind, 'right') ?? wAttrInt(ind, 'end');
		const firstLine = wAttrInt(ind, 'firstLine');
		const hanging = wAttrInt(ind, 'hanging');
		if (left !== undefined) indent.left = left;
		if (right !== undefined) indent.right = right;
		if (firstLine !== undefined) indent.firstLine = firstLine;
		if (hanging !== undefined) indent.hanging = hanging;
		if (Object.keys(indent).length > 0) props.indent = indent;
	}

	const numPr = getFirstChild(el, NS.w, 'numPr');
	if (numPr) {
		const numId = getFirstChild(numPr, NS.w, 'numId');
		const ilvl = getFirstChild(numPr, NS.w, 'ilvl');
		if (numId) {
			props.numbering = {
				numId: wValInt(numId) ?? 0,
				level: wValInt(ilvl) ?? 0,
			};
		}
	}

	const outlineLvl = getFirstChild(el, NS.w, 'outlineLvl');
	if (outlineLvl) {
		const val = wValInt(outlineLvl);
		if (val !== undefined) props.outlineLevel = val;
	}

	if (toggleVal(el, 'keepNext')) props.keepNext = true;
	if (toggleVal(el, 'keepLines')) props.keepLines = true;
	if (toggleVal(el, 'pageBreakBefore')) props.pageBreakBefore = true;

	const widowControl = getFirstChild(el, NS.w, 'widowControl');
	if (widowControl) {
		const val = attrNS(widowControl, NS.w, 'val');
		props.widowControl = val !== '0' && val !== 'false';
	}

	const pBdr = getFirstChild(el, NS.w, 'pBdr');
	if (pBdr) props.borders = parseParagraphBorders(pBdr);

	const shd = getFirstChild(el, NS.w, 'shd');
	if (shd) props.shading = parseShading(shd);

	const tabs = getFirstChild(el, NS.w, 'tabs');
	if (tabs) props.tabs = parseTabs(tabs);

	const rPr = getFirstChild(el, NS.w, 'rPr');
	if (rPr) props.runProperties = parseRunProperties(rPr);

	return props as JPParagraphProperties;
}

// ─── Border Parsing ────────────────────────────────────────────────────────

export function parseBorderDef(el: Element): JPBorderDef | undefined {
	const style = attrNS(el, NS.w, 'val');
	if (!style || style === 'none' || style === 'nil') return undefined;

	const sz = attrNS(el, NS.w, 'sz');
	const color = attrNS(el, NS.w, 'color');
	const space = attrNS(el, NS.w, 'space');

	return {
		style: mapBorderStyle(style),
		width: sz ? Number.parseInt(sz, 10) : 4,
		color: color && color !== 'auto' ? color : '000000',
		spacing: space ? Number.parseInt(space, 10) : undefined,
	};
}

export function parseParagraphBorders(el: Element): JPParagraphBorders {
	const borders: Record<string, JPBorderDef | undefined> = {};
	for (const side of ['top', 'bottom', 'left', 'right', 'between'] as const) {
		const child = getFirstChild(el, NS.w, side);
		if (child) borders[side] = parseBorderDef(child);
	}
	return borders as JPParagraphBorders;
}

export function parseTableBorders(el: Element): JPTableBorders {
	const borders: Record<string, JPBorderDef | undefined> = {};
	for (const side of ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'] as const) {
		const child = getFirstChild(el, NS.w, side);
		if (child) borders[side] = parseBorderDef(child);
	}
	return borders as JPTableBorders;
}

export function parseShading(el: Element): JPShading {
	const fill = attrNS(el, NS.w, 'fill') || 'auto';
	const pattern = attrNS(el, NS.w, 'val') ?? undefined;
	const color = attrNS(el, NS.w, 'color') ?? undefined;
	return { fill, pattern, color };
}

export function parseCellMargins(el: Element): JPTableCellMargins {
	return {
		top: marginSide(el, 'top'),
		right: marginSide(el, 'right') || marginSide(el, 'end'),
		bottom: marginSide(el, 'bottom'),
		left: marginSide(el, 'left') || marginSide(el, 'start'),
	};
}

function marginSide(parent: Element, name: string): number {
	const child = getFirstChild(parent, NS.w, name);
	if (!child) return 0;
	const w = attrNS(child, NS.w, 'w');
	return w ? Number.parseInt(w, 10) : 0;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function parseTabs(el: Element): JPTabStop[] {
	const tabs: JPTabStop[] = [];
	const children = getDirectChildren(el, NS.w, 'tab');
	for (const tab of children) {
		const val = attrNS(tab, NS.w, 'val');
		const pos = attrNS(tab, NS.w, 'pos');
		if (!pos) continue;
		const leader = attrNS(tab, NS.w, 'leader');
		tabs.push({
			position: Number.parseInt(pos, 10),
			type: (val as JPTabStopType) || 'left',
			leader: leader ? (leader as JPTabLeader) : undefined,
		});
	}
	return tabs;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Get w:val attribute from an element in the w: namespace. */
function wVal(el: Element | null): string | undefined {
	if (!el) return undefined;
	return attrNS(el, NS.w, 'val') ?? undefined;
}

/** Get w:val as integer. */
function wValInt(el: Element | null): number | undefined {
	const v = wVal(el);
	if (v === undefined) return undefined;
	const n = Number.parseInt(v, 10);
	return Number.isNaN(n) ? undefined : n;
}

/** Get a w: namespaced attribute as integer. */
function wAttrInt(el: Element, localName: string): number | undefined {
	const v = attrNS(el, NS.w, localName);
	if (v === null) return undefined;
	const n = Number.parseInt(v, 10);
	return Number.isNaN(n) ? undefined : n;
}

/** Check if a toggle property child element is on. */
function toggleVal(parent: Element, localName: string): boolean {
	const child = getFirstChild(parent, NS.w, localName);
	if (!child) return false;
	const val = attrNS(child, NS.w, 'val');
	if (val === null) return true; // present with no val = true
	return val !== '0' && val !== 'false' && val !== 'off';
}

function mapAlignment(val: string | undefined): JPAlignment | undefined {
	if (!val) return undefined;
	switch (val) {
		case 'left':
		case 'start':
			return 'left';
		case 'center':
			return 'center';
		case 'right':
		case 'end':
			return 'right';
		case 'both':
			return 'justify';
		case 'distribute':
			return 'distribute';
		default:
			return 'left';
	}
}

function mapBorderStyle(val: string): JPBorderStyle {
	switch (val) {
		case 'single':
			return 'single';
		case 'double':
			return 'double';
		case 'dashed':
		case 'dashSmallGap':
			return 'dashed';
		case 'dotted':
			return 'dotted';
		case 'thick':
			return 'thick';
		case 'dashDot':
		case 'dotDash':
			return 'dashDot';
		case 'dashDotDot':
		case 'dotDotDash':
			return 'dashDotDot';
		case 'wave':
			return 'wave';
		case 'threeDEmboss':
		case 'thinThickSmallGap':
		case 'thinThickMediumGap':
		case 'thinThickLargeGap':
			return 'threeDEmboss';
		case 'threeDEngrave':
		case 'thickThinSmallGap':
		case 'thickThinMediumGap':
		case 'thickThinLargeGap':
			return 'threeDEngrave';
		default:
			return 'none';
	}
}
