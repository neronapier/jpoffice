/**
 * Border definitions used across paragraphs, tables, and cells.
 */

export type JPBorderStyle =
	| 'none'
	| 'single'
	| 'double'
	| 'dashed'
	| 'dotted'
	| 'thick'
	| 'dashDot'
	| 'dashDotDot'
	| 'wave'
	| 'threeDEmboss'
	| 'threeDEngrave';

export interface JPBorderDef {
	readonly style: JPBorderStyle;
	readonly width: number; // eighths of a point
	readonly color: string; // hex without '#', e.g. '000000'
	readonly spacing?: number; // spacing from text in pt
}

export interface JPParagraphBorders {
	readonly top?: JPBorderDef;
	readonly bottom?: JPBorderDef;
	readonly left?: JPBorderDef;
	readonly right?: JPBorderDef;
	readonly between?: JPBorderDef;
}

export interface JPTableBorders {
	readonly top?: JPBorderDef;
	readonly bottom?: JPBorderDef;
	readonly left?: JPBorderDef;
	readonly right?: JPBorderDef;
	readonly insideH?: JPBorderDef;
	readonly insideV?: JPBorderDef;
}

export type JPCellBorders = JPTableBorders;

export interface JPShading {
	readonly fill: string; // hex color
	readonly pattern?: string;
	readonly color?: string;
}
