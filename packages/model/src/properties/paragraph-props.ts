/**
 * Paragraph-level properties.
 * These map directly to OOXML w:pPr elements.
 */

import type { JPParagraphBorders, JPShading } from './border-props';
import type { JPRunProperties } from './run-props';

export type JPAlignment = 'left' | 'center' | 'right' | 'justify' | 'distribute';

export type JPLineSpacingRule = 'auto' | 'exact' | 'atLeast';

export type JPTabStopType = 'left' | 'center' | 'right' | 'decimal' | 'bar';

export type JPTabLeader = 'none' | 'dot' | 'hyphen' | 'underscore';

export interface JPTabStop {
	readonly position: number; // twips from left margin
	readonly type: JPTabStopType;
	readonly leader?: JPTabLeader;
}

export interface JPNumberingRef {
	readonly numId: number;
	readonly level: number; // 0-8 nesting depth
}

export interface JPParagraphProperties {
	readonly styleId?: string;
	readonly alignment?: JPAlignment;
	readonly spacing?: {
		readonly before?: number; // twips
		readonly after?: number; // twips
		readonly line?: number; // 240 = single, 480 = double
		readonly lineRule?: JPLineSpacingRule;
	};
	readonly indent?: {
		readonly left?: number; // twips
		readonly right?: number; // twips
		readonly firstLine?: number; // positive = first-line indent
		readonly hanging?: number; // hanging indent
	};
	readonly numbering?: JPNumberingRef;
	readonly outlineLevel?: number; // 0-8, used for headings
	readonly keepNext?: boolean;
	readonly keepLines?: boolean;
	readonly pageBreakBefore?: boolean;
	readonly widowControl?: boolean;
	readonly borders?: JPParagraphBorders;
	readonly shading?: JPShading;
	readonly tabs?: readonly JPTabStop[];
	readonly runProperties?: JPRunProperties; // default run properties for paragraph
}
