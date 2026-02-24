import type {
	JPInlineNode,
	JPParagraph,
	JPParagraphProperties,
	JPRun,
	JPRunProperties,
	JPTable,
	JPTableCell,
	JPTableRow,
} from '@jpoffice/model';
import {
	createHyperlink,
	createParagraph,
	createRun,
	createTable,
	createTableCell,
	createTableRow,
	createText,
	generateId,
} from '@jpoffice/model';

/**
 * A document fragment produced by parsing HTML.
 * Contains paragraphs and optionally tables at the block level.
 */
export interface DocumentFragment {
	readonly paragraphs: ReadonlyArray<JPParagraph | JPTable>;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Parse an HTML string into a DocumentFragment of JPOffice nodes.
 * Uses the browser-native DOMParser. Returns an empty fragment when
 * DOMParser is unavailable (SSR) or the HTML is empty.
 */
export function parseHtmlToFragment(html: string): DocumentFragment {
	if (typeof DOMParser === 'undefined') {
		return { paragraphs: [] };
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const body = doc.body;
	if (!body) return { paragraphs: [] };

	const blocks = walkBlockNodes(body);

	// If the HTML only had inline content (e.g. "hello <b>world</b>")
	// the walker may not have produced any block. Wrap loose runs in a paragraph.
	if (blocks.length === 0) {
		const runs = collectInlineNodes(body, {});
		if (runs.length > 0) {
			blocks.push(createParagraph(generateId(), runs));
		}
	}

	return { paragraphs: blocks };
}

// ── Block-level walker ──────────────────────────────────────────────

const BLOCK_TAGS = new Set([
	'P',
	'DIV',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'LI',
	'BLOCKQUOTE',
	'PRE',
	'DT',
	'DD',
	'FIGCAPTION',
	'HEADER',
	'FOOTER',
	'ARTICLE',
	'SECTION',
	'ASIDE',
	'NAV',
	'MAIN',
]);

function isBlockElement(el: Element): boolean {
	return BLOCK_TAGS.has(el.tagName) || el.tagName === 'TABLE';
}

/**
 * Walk the children of a container, producing block-level nodes
 * (JPParagraph / JPTable). Inline-only sequences are gathered into
 * a single paragraph.
 */
function walkBlockNodes(container: Node): Array<JPParagraph | JPTable> {
	const blocks: Array<JPParagraph | JPTable> = [];
	let pendingInlines: JPInlineNode[] = [];

	const flushInlines = (): void => {
		if (pendingInlines.length > 0) {
			blocks.push(createParagraph(generateId(), pendingInlines));
			pendingInlines = [];
		}
	};

	for (let i = 0; i < container.childNodes.length; i++) {
		const child = container.childNodes[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent ?? '';
			if (text.length > 0) {
				pendingInlines.push(createRun(generateId(), [createText(generateId(), text)]));
			}
			continue;
		}

		if (child.nodeType !== Node.ELEMENT_NODE) continue;
		const el = child as Element;

		// --- Tables ---
		if (el.tagName === 'TABLE') {
			flushInlines();
			const table = parseTable(el);
			if (table) blocks.push(table);
			continue;
		}

		// --- Lists: unwrap to LI items ---
		if (el.tagName === 'UL' || el.tagName === 'OL') {
			flushInlines();
			const items = parseList(el);
			blocks.push(...items);
			continue;
		}

		// --- Block elements ---
		if (isBlockElement(el)) {
			flushInlines();
			const para = parseBlockElement(el);
			if (para) blocks.push(para);
			continue;
		}

		// --- BR → flush current inline into paragraph ---
		if (el.tagName === 'BR') {
			flushInlines();
			continue;
		}

		// --- Inline element: collect runs ---
		const inlineRuns = collectInlineNodes(el, {});
		pendingInlines.push(...inlineRuns);
	}

	flushInlines();
	return blocks;
}

// ── Block element parsing ───────────────────────────────────────────

function parseBlockElement(el: Element): JPParagraph | null {
	const paraProps = buildParagraphProperties(el);
	const inheritedRunProps = extractRunPropertiesFromStyles(el);
	const inlines = collectInlineNodes(el, inheritedRunProps);

	// Ensure at least one run (empty paragraph)
	if (inlines.length === 0) {
		inlines.push(createRun(generateId(), [createText(generateId(), '')]));
	}

	return createParagraph(generateId(), inlines, paraProps);
}

function buildParagraphProperties(el: Element): JPParagraphProperties {
	const props: Record<string, unknown> = {};
	const tag = el.tagName;

	// Headings → outlineLevel
	const headingMatch = /^H([1-6])$/.exec(tag);
	if (headingMatch) {
		props.outlineLevel = Number.parseInt(headingMatch[1], 10) - 1;
	}

	// Alignment from style
	const style = (el as HTMLElement).style;
	if (style) {
		const textAlign = style.textAlign;
		if (
			textAlign === 'center' ||
			textAlign === 'right' ||
			textAlign === 'justify' ||
			textAlign === 'left'
		) {
			props.alignment = textAlign;
		}
	}

	return props as JPParagraphProperties;
}

// ── Inline content collection ───────────────────────────────────────

/**
 * Recursively collect inline content under an element.
 * Returns an array of JPRun and JPHyperlink nodes.
 * `inheritedProps` accumulates formatting from ancestor inline elements.
 */
function collectInlineNodes(
	container: Node,
	inheritedProps: Partial<JPRunProperties>,
): JPInlineNode[] {
	const result: JPInlineNode[] = [];

	for (let i = 0; i < container.childNodes.length; i++) {
		const child = container.childNodes[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent ?? '';
			if (text.length > 0) {
				const runProps = cleanRunProperties(inheritedProps);
				result.push(createRun(generateId(), [createText(generateId(), text)], runProps));
			}
			continue;
		}

		if (child.nodeType !== Node.ELEMENT_NODE) continue;
		const el = child as Element;

		// Skip block elements inside inline context (shouldn't happen in well-formed HTML)
		if (isBlockElement(el)) continue;

		// BR → add run with newline (acts as a soft return)
		if (el.tagName === 'BR') {
			result.push(
				createRun(
					generateId(),
					[createText(generateId(), '\n')],
					cleanRunProperties(inheritedProps),
				),
			);
			continue;
		}

		// Hyperlink
		if (el.tagName === 'A') {
			const href = el.getAttribute('href') ?? '';
			const linkProps = mergeInlineProperties(inheritedProps, el);
			const linkRuns = collectInlineRuns(el, linkProps);
			if (linkRuns.length > 0) {
				const hyperlink = createHyperlink(generateId(), linkRuns, href);
				result.push(hyperlink);
			}
			continue;
		}

		// Other inline elements: merge their formatting and recurse
		const mergedProps = mergeInlineProperties(inheritedProps, el);
		const childInlines = collectInlineNodes(el, mergedProps);
		result.push(...childInlines);
	}

	return result;
}

/**
 * Collect runs only (no hyperlinks) — used inside <a> elements.
 */
function collectInlineRuns(container: Node, inheritedProps: Partial<JPRunProperties>): JPRun[] {
	const runs: JPRun[] = [];

	for (let i = 0; i < container.childNodes.length; i++) {
		const child = container.childNodes[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent ?? '';
			if (text.length > 0) {
				runs.push(
					createRun(
						generateId(),
						[createText(generateId(), text)],
						cleanRunProperties(inheritedProps),
					),
				);
			}
			continue;
		}

		if (child.nodeType !== Node.ELEMENT_NODE) continue;
		const el = child as Element;

		if (el.tagName === 'BR') {
			runs.push(
				createRun(
					generateId(),
					[createText(generateId(), '\n')],
					cleanRunProperties(inheritedProps),
				),
			);
			continue;
		}

		const merged = mergeInlineProperties(inheritedProps, el);
		const childRuns = collectInlineRuns(el, merged);
		runs.push(...childRuns);
	}

	return runs;
}

// ── Inline property merging ─────────────────────────────────────────

/**
 * Merge inherited run properties with those implied by an inline element
 * (its tag name + its inline styles).
 */
function mergeInlineProperties(
	inherited: Partial<JPRunProperties>,
	el: Element,
): Partial<JPRunProperties> {
	const tagProps = tagToRunProperties(el.tagName);
	const styleProps = extractRunPropertiesFromStyles(el);
	return { ...inherited, ...tagProps, ...styleProps };
}

/**
 * Map an HTML tag to JPRunProperties.
 */
function tagToRunProperties(tag: string): Partial<JPRunProperties> {
	switch (tag) {
		case 'B':
		case 'STRONG':
			return { bold: true };
		case 'I':
		case 'EM':
		case 'CITE':
		case 'DFN':
		case 'VAR':
			return { italic: true };
		case 'U':
		case 'INS':
			return { underline: 'single' };
		case 'S':
		case 'DEL':
		case 'STRIKE':
			return { strikethrough: true };
		case 'SUP':
			return { superscript: true };
		case 'SUB':
			return { subscript: true };
		case 'CODE':
		case 'KBD':
		case 'SAMP':
		case 'TT':
			return { fontFamily: 'Courier New' };
		default:
			return {};
	}
}

/**
 * Extract JPRunProperties from an element's inline CSS styles.
 */
function extractRunPropertiesFromStyles(el: Element): Partial<JPRunProperties> {
	const htmlEl = el as HTMLElement;
	if (!htmlEl.style) return {};

	const style = htmlEl.style;
	const props: Record<string, unknown> = {};

	// font-weight
	const fw = style.fontWeight;
	if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900') {
		props.bold = true;
	}

	// font-style
	if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') {
		props.italic = true;
	}

	// text-decoration
	const td = style.textDecoration || style.textDecorationLine;
	if (td) {
		if (td.includes('underline')) {
			props.underline = 'single';
		}
		if (td.includes('line-through')) {
			props.strikethrough = true;
		}
	}

	// font-size → half-points
	const fs = style.fontSize;
	if (fs) {
		const px = parseCssSize(fs);
		if (px !== null) {
			// half-points = px * 2 * 72/96 = px * 1.5
			props.fontSize = Math.round(px * 1.5);
		}
	}

	// font-family
	const ff = style.fontFamily;
	if (ff) {
		// Take the first font, strip quotes
		const first = ff
			.split(',')[0]
			.trim()
			.replace(/^['"]|['"]$/g, '');
		if (first) {
			props.fontFamily = first;
		}
	}

	// color
	const color = style.color;
	if (color) {
		const hex = cssColorToHex(color);
		if (hex) props.color = hex;
	}

	// background-color
	const bgColor = style.backgroundColor;
	if (bgColor) {
		const hex = cssColorToHex(bgColor);
		if (hex) props.backgroundColor = hex;
	}

	return props as Partial<JPRunProperties>;
}

// ── List parsing ────────────────────────────────────────────────────

function parseList(listEl: Element): JPParagraph[] {
	const result: JPParagraph[] = [];

	for (let i = 0; i < listEl.children.length; i++) {
		const child = listEl.children[i];
		if (child.tagName === 'LI') {
			const para = parseBlockElement(child);
			if (para) result.push(para);
		}
	}

	return result;
}

// ── Table parsing ───────────────────────────────────────────────────

function parseTable(tableEl: Element): JPTable | null {
	const rows: JPTableRow[] = [];

	// Gather rows from tbody, thead, tfoot, or directly under table
	const rowElements = tableEl.querySelectorAll(
		':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr',
	);

	for (let r = 0; r < rowElements.length; r++) {
		const rowEl = rowElements[r];
		const cells: JPTableCell[] = [];

		for (let c = 0; c < rowEl.children.length; c++) {
			const cellEl = rowEl.children[c];
			if (cellEl.tagName !== 'TD' && cellEl.tagName !== 'TH') continue;

			const cellContent = walkBlockNodes(cellEl);
			// Ensure at least one paragraph in cell
			if (cellContent.length === 0) {
				cellContent.push(
					createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), '')])]),
				);
			}
			cells.push(createTableCell(generateId(), cellContent));
		}

		if (cells.length > 0) {
			rows.push(createTableRow(generateId(), cells));
		}
	}

	if (rows.length === 0) return null;
	return createTable(generateId(), rows);
}

// ── CSS color utilities ─────────────────────────────────────────────

/**
 * Convert a CSS color value to hex string (without '#').
 * Handles: #hex, rgb(r,g,b), rgba(r,g,b,a), named colors.
 */
function cssColorToHex(cssColor: string): string | null {
	if (!cssColor || cssColor === 'transparent' || cssColor === 'inherit' || cssColor === 'initial') {
		return null;
	}

	// #hex
	const hexMatch = /^#([0-9a-fA-F]{3,8})$/.exec(cssColor.trim());
	if (hexMatch) {
		let hex = hexMatch[1];
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		if (hex.length === 8) {
			hex = hex.slice(0, 6); // drop alpha
		}
		return hex.toUpperCase();
	}

	// rgb(r, g, b) or rgba(r, g, b, a)
	const rgbMatch = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(cssColor);
	if (rgbMatch) {
		const r = Number.parseInt(rgbMatch[1], 10);
		const g = Number.parseInt(rgbMatch[2], 10);
		const b = Number.parseInt(rgbMatch[3], 10);
		return componentToHex(r) + componentToHex(g) + componentToHex(b);
	}

	// Named colors (most common)
	const named = NAMED_COLORS[cssColor.toLowerCase()];
	if (named) return named;

	return null;
}

function componentToHex(c: number): string {
	const hex = Math.max(0, Math.min(255, c)).toString(16).toUpperCase();
	return hex.length === 1 ? `0${hex}` : hex;
}

/**
 * Parse a CSS size value to pixels.
 */
function parseCssSize(value: string): number | null {
	const pxMatch = /^([\d.]+)\s*px$/i.exec(value);
	if (pxMatch) return Number.parseFloat(pxMatch[1]);

	const ptMatch = /^([\d.]+)\s*pt$/i.exec(value);
	if (ptMatch) return Number.parseFloat(ptMatch[1]) * (96 / 72);

	const emMatch = /^([\d.]+)\s*em$/i.exec(value);
	if (emMatch) return Number.parseFloat(emMatch[1]) * 16; // assume 16px base

	const remMatch = /^([\d.]+)\s*rem$/i.exec(value);
	if (remMatch) return Number.parseFloat(remMatch[1]) * 16;

	return null;
}

/**
 * Remove undefined properties from run properties.
 */
function cleanRunProperties(props: Partial<JPRunProperties>): JPRunProperties {
	const clean: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(props)) {
		if (value !== undefined) {
			clean[key] = value;
		}
	}
	return clean as JPRunProperties;
}

// ── Common CSS named colors ─────────────────────────────────────────

const NAMED_COLORS: Record<string, string> = {
	black: '000000',
	white: 'FFFFFF',
	red: 'FF0000',
	green: '008000',
	blue: '0000FF',
	yellow: 'FFFF00',
	cyan: '00FFFF',
	magenta: 'FF00FF',
	orange: 'FFA500',
	purple: '800080',
	pink: 'FFC0CB',
	gray: '808080',
	grey: '808080',
	silver: 'C0C0C0',
	navy: '000080',
	teal: '008080',
	maroon: '800000',
	olive: '808000',
	lime: '00FF00',
	aqua: '00FFFF',
	fuchsia: 'FF00FF',
	brown: 'A52A2A',
	coral: 'FF7F50',
	crimson: 'DC143C',
	darkblue: '00008B',
	darkgreen: '006400',
	darkred: '8B0000',
	gold: 'FFD700',
	indigo: '4B0082',
	ivory: 'FFFFF0',
	khaki: 'F0E68C',
	lavender: 'E6E6FA',
	lightblue: 'ADD8E6',
	lightgray: 'D3D3D3',
	lightgrey: 'D3D3D3',
	lightgreen: '90EE90',
	lightyellow: 'FFFFE0',
	linen: 'FAF0E6',
	peru: 'CD853F',
	plum: 'DDA0DD',
	salmon: 'FA8072',
	sienna: 'A0522D',
	skyblue: '87CEEB',
	tan: 'D2B48C',
	tomato: 'FF6347',
	turquoise: '40E0D0',
	violet: 'EE82EE',
	wheat: 'F5DEB3',
};
