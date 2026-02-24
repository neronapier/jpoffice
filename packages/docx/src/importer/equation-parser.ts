import type { JPEquation } from '@jpoffice/model';
import { createEquation } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { getFirstChild, textContent } from '../xml/xml-parser';

/**
 * Parse m:oMath or m:oMathPara elements into JPEquation nodes.
 * Extracts the text content from m:r/m:t elements and stores it as the equation text.
 */
export function parseEquation(el: Element): JPEquation | null {
	const isBlock = el.localName === 'oMathPara';
	const display = isBlock ? 'block' : 'inline';

	let mathEl = el;
	if (isBlock) {
		const inner = getFirstChild(el, NS.m, 'oMath');
		if (!inner) return null;
		mathEl = inner;
	}

	const text = extractMathText(mathEl);
	if (!text) return null;

	return createEquation(text, display);
}

function extractMathText(el: Element): string {
	const parts: string[] = [];
	const children = el.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;

		if (ce.localName === 'r' && ce.namespaceURI === NS.m) {
			const t = getFirstChild(ce, NS.m, 't');
			if (t) parts.push(textContent(t));
		} else {
			const inner = extractMathText(ce);
			if (inner) parts.push(inner);
		}
	}
	return parts.join('');
}
