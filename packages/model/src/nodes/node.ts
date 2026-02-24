/**
 * Base node types for the JPOffice document model.
 *
 * The document is a tree of nodes. Each node has a discriminated
 * type tag and a stable id (for React keys and collaborative editing).
 *
 * Element nodes contain children. Leaf nodes do not.
 */

export type JPNodeType =
	| 'document'
	| 'body'
	| 'section'
	| 'paragraph'
	| 'run'
	| 'text'
	| 'table'
	| 'table-row'
	| 'table-cell'
	| 'image'
	| 'drawing'
	| 'page-break'
	| 'line-break'
	| 'column-break'
	| 'tab'
	| 'header'
	| 'footer'
	| 'hyperlink'
	| 'bookmark-start'
	| 'bookmark-end'
	| 'field'
	| 'comment-range-start'
	| 'comment-range-end'
	| 'footnote-ref'
	| 'endnote-ref'
	| 'equation'
	| 'shape'
	| 'shape-group'
	| 'textbox'
	| 'mention';

/**
 * Base interface for all nodes.
 */
export interface JPBaseNode {
	readonly type: JPNodeType;
	readonly id: string;
}

/**
 * Element nodes contain an ordered list of children.
 */
export interface JPElement extends JPBaseNode {
	readonly children: readonly JPNode[];
}

/**
 * Leaf nodes have no children.
 */
export interface JPLeaf extends JPBaseNode {}

/**
 * Union of all node types.
 */
export type JPNode = JPElement | JPLeaf;

/**
 * Check if a node is an element (has children).
 */
export function isElement(node: JPBaseNode): node is JPElement {
	return 'children' in node;
}

/**
 * Check if a node is a leaf (no children).
 */
export function isLeaf(node: JPBaseNode): node is JPLeaf {
	return !('children' in node);
}

// -- ID generation --

let _idCounter = 0;

/**
 * Generate a unique node ID.
 * Uses a simple incrementing counter for performance.
 * In production, nanoid could be used for distributed scenarios.
 */
export function generateId(): string {
	return `jp_${++_idCounter}`;
}

/**
 * Reset the ID counter (for testing only).
 */
export function resetIdCounter(): void {
	_idCounter = 0;
}
