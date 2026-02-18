import type { JPSectionProperties } from '../properties/section-props';
import type { JPPageBreak } from './break';
import type { JPElement } from './node';
import type { JPParagraph } from './paragraph';
import type { JPTable } from './table';

/**
 * Block-level nodes that can appear in a section.
 */
export type JPBlockNode = JPParagraph | JPTable | JPPageBreak;

/**
 * JPSection represents a page layout region.
 * Different sections can have different page sizes, margins,
 * orientations, columns, and headers/footers.
 */
export interface JPSection extends JPElement {
	readonly type: 'section';
	readonly children: readonly JPBlockNode[];
	readonly properties: JPSectionProperties;
}

export function createSection(
	id: string,
	children: readonly JPBlockNode[],
	properties: JPSectionProperties,
): JPSection {
	return { type: 'section', id, children, properties };
}

export function isSection(node: { type: string }): node is JPSection {
	return node.type === 'section';
}
