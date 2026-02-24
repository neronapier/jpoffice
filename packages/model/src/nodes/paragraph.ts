import type { JPParagraphProperties } from '../properties/paragraph-props';
import type { JPBookmarkEnd, JPBookmarkStart } from './bookmark';
import type { JPColumnBreak, JPLineBreak, JPTab } from './break';
import type { JPCommentRangeEnd, JPCommentRangeStart } from './comment';
import type { JPDrawing } from './drawing';
import type { JPEquation } from './equation';
import type { JPField } from './field';
import type { JPEndnoteRef, JPFootnoteRef } from './footnote';
import type { JPHyperlink } from './hyperlink';
import type { JPElement } from './node';
import type { JPRun } from './run';
import type { JPMention } from './mention';
import type { JPShape } from './shape';

/**
 * Inline node types that can appear inside a paragraph.
 */
export type JPInlineNode =
	| JPRun
	| JPDrawing
	| JPHyperlink
	| JPBookmarkStart
	| JPBookmarkEnd
	| JPCommentRangeStart
	| JPCommentRangeEnd
	| JPLineBreak
	| JPColumnBreak
	| JPTab
	| JPField
	| JPFootnoteRef
	| JPEndnoteRef
	| JPEquation
	| JPShape
	| JPMention;

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
