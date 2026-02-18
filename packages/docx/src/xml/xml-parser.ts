/**
 * Isomorphic XML parser.
 *
 * Browser: uses native DOMParser (zero cost).
 * Node.js/SSR: falls back to @xmldom/xmldom.
 */

let cachedParser: DOMParser | null = null;

function getParser(): DOMParser {
	if (cachedParser) return cachedParser;

	if (typeof globalThis.DOMParser !== 'undefined') {
		cachedParser = new globalThis.DOMParser();
		return cachedParser;
	}

	// Node.js fallback
	try {
		// biome-ignore lint/suspicious/noExplicitAny: dynamic require for conditional SSR dependency
		const xmldom = require('@xmldom/xmldom') as any;
		cachedParser = new xmldom.DOMParser() as DOMParser;
		return cachedParser!;
	} catch {
		throw new Error(
			'@xmldom/xmldom is required for XML parsing in Node.js. ' +
				'Install it with: pnpm add @xmldom/xmldom',
		);
	}
}

/** Parse an XML string into a DOM Document. */
export function parseXml(xmlString: string): Document {
	const parser = getParser();
	return parser.parseFromString(xmlString, 'application/xml');
}

/** Get direct child elements matching a namespace URI and local name. */
export function getDirectChildren(parent: Element, nsUri: string, localName: string): Element[] {
	const result: Element[] = [];
	const children = parent.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (
			child.nodeType === 1 &&
			(child as Element).namespaceURI === nsUri &&
			(child as Element).localName === localName
		) {
			result.push(child as Element);
		}
	}
	return result;
}

/** Get the first direct child element matching namespace + localName. */
export function getFirstChild(parent: Element, nsUri: string, localName: string): Element | null {
	const children = parent.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (
			child.nodeType === 1 &&
			(child as Element).namespaceURI === nsUri &&
			(child as Element).localName === localName
		) {
			return child as Element;
		}
	}
	return null;
}

/** Get all descendant elements matching namespace + localName. */
export function getAllElements(parent: Element, nsUri: string, localName: string): Element[] {
	const nodes = parent.getElementsByTagNameNS(nsUri, localName);
	const result: Element[] = [];
	for (let i = 0; i < nodes.length; i++) {
		result.push(nodes[i] as Element);
	}
	return result;
}

/** Get an attribute value, or null if not present. */
export function attr(el: Element, name: string): string | null {
	return el.getAttribute(name);
}

/** Get a namespaced attribute value. */
export function attrNS(el: Element, nsUri: string, localName: string): string | null {
	return el.getAttributeNS(nsUri, localName);
}

/** Parse an integer attribute, returning fallback if absent or NaN. */
export function intAttr(el: Element, name: string, fallback = 0): number {
	const v = el.getAttribute(name);
	if (v === null) return fallback;
	const parsed = Number.parseInt(v, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse an OOXML boolean attribute.
 * OOXML booleans: '1', 'true', 'on', '' (absent val on toggle prop) = true
 *                 '0', 'false', 'off' = false
 * Returns undefined if the attribute is not present.
 */
export function boolAttr(el: Element, name: string): boolean | undefined {
	const v = el.getAttribute(name);
	if (v === null) return undefined;
	return v !== '0' && v !== 'false' && v !== 'off';
}

/**
 * Check if a toggle property element is "on".
 * In OOXML, `<w:b/>` (no w:val) means true, `<w:b w:val="0"/>` means false.
 */
export function isToggleOn(el: Element | null): boolean | undefined {
	if (!el) return undefined;
	const val = attrNS(el, el.namespaceURI || '', 'val');
	if (val === null) return true; // element present with no val = true
	return val !== '0' && val !== 'false' && val !== 'off';
}

/** Get all direct child elements (any namespace). */
export function allDirectChildren(parent: Element): Element[] {
	const result: Element[] = [];
	const children = parent.childNodes;
	for (let i = 0; i < children.length; i++) {
		if (children[i].nodeType === 1) {
			result.push(children[i] as Element);
		}
	}
	return result;
}

/** Get the text content of an element. */
export function textContent(el: Element): string {
	return el.textContent || '';
}
