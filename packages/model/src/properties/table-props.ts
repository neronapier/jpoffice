/**
 * Table, row, and cell properties.
 * These map to OOXML w:tblPr, w:trPr, and w:tcPr.
 */

import type { JPCellBorders, JPShading, JPTableBorders } from './border-props';

export type JPTableWidthType = 'dxa' | 'pct' | 'auto';

export interface JPTableWidth {
	readonly value: number;
	readonly type: JPTableWidthType;
}

export type JPTableLayout = 'fixed' | 'autofit';

export interface JPTableCellMargins {
	readonly top: number; // twips
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

export interface JPTableProperties {
	readonly styleId?: string;
	readonly width?: JPTableWidth;
	readonly alignment?: 'left' | 'center' | 'right';
	readonly borders?: JPTableBorders;
	readonly cellMargins?: JPTableCellMargins;
	readonly layout?: JPTableLayout;
	readonly indent?: number; // twips
}

export interface JPTableGridCol {
	readonly width: number; // twips
}

export interface JPTableRowProperties {
	readonly height?: {
		readonly value: number; // twips
		readonly rule: 'auto' | 'exact' | 'atLeast';
	};
	readonly isHeader?: boolean;
	readonly cantSplit?: boolean;
}

export type JPVerticalMerge = 'restart' | 'continue';

export type JPTextDirection = 'lrTb' | 'tbRl' | 'btLr';

export interface JPTableCellProperties {
	readonly width?: JPTableWidth;
	readonly verticalMerge?: JPVerticalMerge;
	readonly gridSpan?: number; // horizontal merge
	readonly borders?: JPCellBorders;
	readonly shading?: JPShading;
	readonly verticalAlignment?: 'top' | 'center' | 'bottom';
	readonly margins?: JPTableCellMargins;
	readonly textDirection?: JPTextDirection;
}
