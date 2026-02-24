import type { JPFootnote, JPParagraph } from '@jpoffice/model';
import {
	createFootnote,
	createParagraph,
	createRun,
	createText,
	generateId,
} from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild, textContent } from '../xml/xml-parser';
import { parseParagraphProperties, parseRunProperties } from './run-parser';

// ─── Footnote/Endnote Parsing ──────────────────────────────────────────────

/**
 * Parse word/footnotes.xml or word/endnotes.xml into JPFootnote[].
 *
 * Skips special separator/continuationSeparator entries (id -1 and 0).
 * Each real footnote/endnote has its paragraph children parsed into
 * JPParagraph nodes.
 */
export function parseFootnotes(doc: Document, noteType: 'footnote' | 'endnote'): JPFootnote[] {
	const root = doc.documentElement;
	if (!root) return [];

	const tagName = noteType === 'footnote' ? 'footnote' : 'endnote';
	const noteElements = getDirectChildren(root, NS.w, tagName);
	const result: JPFootnote[] = [];

	for (const noteEl of noteElements) {
		// Skip separator and continuationSeparator entries
		const type = attrNS(noteEl, NS.w, 'type');
		if (type === 'separator' || type === 'continuationSeparator') continue;

		const id = attrNS(noteEl, NS.w, 'id');
		if (!id || id === '-1' || id === '0') continue;

		const paragraphs = parseNoteParagraphs(noteEl);
		const footnote = createFootnote(noteType, paragraphs);
		// Override the auto-generated id with the OOXML id for cross-referencing
		result.push({ ...footnote, id });
	}

	return result;
}

// ─── Note Paragraph Parsing ────────────────────────────────────────────────

/**
 * Parse paragraph children of a footnote/endnote element.
 * Each w:p is converted to a JPParagraph with its runs and text.
 */
function parseNoteParagraphs(noteEl: Element): JPParagraph[] {
	const paragraphs: JPParagraph[] = [];
	const pElements = getDirectChildren(noteEl, NS.w, 'p');

	for (const pEl of pElements) {
		const paragraph = parseNoteParagraph(pEl);
		paragraphs.push(paragraph);
	}

	return paragraphs;
}

/**
 * Parse a single w:p element inside a footnote/endnote.
 * Extracts paragraph properties and inline runs with text content.
 */
function parseNoteParagraph(pEl: Element): JPParagraph {
	const pPr = getFirstChild(pEl, NS.w, 'pPr');
	const properties = pPr ? parseParagraphProperties(pPr) : {};

	const children: ReturnType<typeof createRun>[] = [];
	const runElements = getDirectChildren(pEl, NS.w, 'r');

	for (const rEl of runElements) {
		const run = parseNoteRun(rEl);
		children.push(run);
	}

	return createParagraph(generateId(), children, properties);
}

/**
 * Parse a w:r element inside a footnote/endnote paragraph.
 * Extracts run properties and text content from w:t children.
 */
function parseNoteRun(rEl: Element): ReturnType<typeof createRun> {
	const rPr = getFirstChild(rEl, NS.w, 'rPr');
	const properties = rPr ? parseRunProperties(rPr) : {};

	const textChildren: ReturnType<typeof createText>[] = [];

	const nodes = rEl.childNodes;
	for (let i = 0; i < nodes.length; i++) {
		const child = nodes[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI !== NS.w) continue;

		switch (ce.localName) {
			case 't':
				textChildren.push(createText(generateId(), textContent(ce)));
				break;
			case 'br':
				textChildren.push(createText(generateId(), '\n'));
				break;
			case 'tab':
				textChildren.push(createText(generateId(), '\t'));
				break;
			case 'cr':
				textChildren.push(createText(generateId(), '\n'));
				break;
		}
	}

	// Ensure run always has at least one text child
	if (textChildren.length === 0) {
		textChildren.push(createText(generateId(), ''));
	}

	return createRun(generateId(), textChildren, properties);
}
