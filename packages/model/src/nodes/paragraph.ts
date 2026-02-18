import type { JPParagraphProperties } from '../properties/paragraph-props';
import type { JPBookmarkEnd, JPBookmarkStart } from './bookmark';
import type { JPColumnBreak, JPLineBreak, JPTab } from './break';
import type { JPDrawing } from './drawing';
import type { JPHyperlink } from './hyperlink';
import type { JPElement } from './node';
import type { JPRun } from './run';

/**
 * Inline node types that can appear inside a paragraph.
 */
export type JPInlineNode =
	| JPRun
	| JPDrawing
	| JPHyperlink
	| JPBookmarkStart
	| JPBookmarkEnd
	| JPLineBreak
	| JPColumnBreak
	| JPTab;

/**
 * JPParagraph is the primary block element containing inline content.
 * Maps to OOXML w:p.
 */
export interface JPParagraph extends JPElement {
	readonly type: 'paragraph';
	readonly children: readonly JPInlineNode[];
	readonly properties: JPParagraphProperties;
}

export function createParagraph(
	id: string,
	children: readonly JPInlineNode[],
	properties: JPParagraphProperties = {},
): JPParagraph {
	return { type: 'paragraph', id, children, properties };
}

export function isParagraph(node: { type: string }): node is JPParagraph {
	return node.type === 'paragraph';
}
