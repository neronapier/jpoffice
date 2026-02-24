import { generateId } from './node';
import type { JPLeaf } from './node';
import type { JPParagraph } from './paragraph';

/**
 * Inline marker that references a footnote.
 * Placed inside a paragraph's children (like a run).
 * Maps to OOXML w:footnoteReference.
 */
export interface JPFootnoteRef extends JPLeaf {
	readonly type: 'footnote-ref';
	readonly id: string;
	readonly footnoteId: string;
}

/**
 * Inline marker that references an endnote.
 * Placed inside a paragraph's children (like a run).
 * Maps to OOXML w:endnoteReference.
 */
export interface JPEndnoteRef extends JPLeaf {
	readonly type: 'endnote-ref';
	readonly id: string;
	readonly footnoteId: string;
}

/**
 * A footnote or endnote body containing paragraphs.
 * Stored in document.footnotes or document.endnotes arrays.
 */
export interface JPFootnote {
	readonly id: string;
	readonly content: readonly JPParagraph[];
	readonly noteType: 'footnote' | 'endnote';
}

/**
 * Create an inline footnote reference marker.
 */
export function createFootnoteRef(footnoteId: string): JPFootnoteRef {
	return {
		type: 'footnote-ref',
		id: generateId(),
		footnoteId,
	};
}

/**
 * Create an inline endnote reference marker.
 */
export function createEndnoteRef(footnoteId: string): JPEndnoteRef {
	return {
		type: 'endnote-ref',
		id: generateId(),
		footnoteId,
	};
}

/**
 * Create a footnote/endnote body with content paragraphs.
 */
export function createFootnote(
	noteType: 'footnote' | 'endnote',
	content?: JPParagraph[],
): JPFootnote {
	return {
		id: generateId(),
		content: content ?? [],
		noteType,
	};
}

/**
 * Type guard for footnote reference nodes.
 */
export function isFootnoteRef(node: unknown): node is JPFootnoteRef {
	return (
		typeof node === 'object' && node !== null && (node as { type?: string }).type === 'footnote-ref'
	);
}

/**
 * Type guard for endnote reference nodes.
 */
export function isEndnoteRef(node: unknown): node is JPEndnoteRef {
	return (
		typeof node === 'object' && node !== null && (node as { type?: string }).type === 'endnote-ref'
	);
}
