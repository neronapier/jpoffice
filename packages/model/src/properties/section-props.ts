/**
 * Section-level properties define page layout.
 * A document can have multiple sections with different page sizes,
 * margins, orientations, columns, and headers/footers.
 */

export type JPOrientation = 'portrait' | 'landscape';

export type JPHeaderFooterType = 'default' | 'first' | 'even';

export interface JPHeaderFooterRef {
	readonly type: JPHeaderFooterType;
	readonly id: string; // references a JPHeader or JPFooter node by id
}

export interface JPSectionColumns {
	readonly count: number;
	readonly space: number; // twips between columns
	readonly separator: boolean;
}

export interface JPWatermark {
	readonly text: string;
	readonly fontFamily: string;
	readonly fontSize: number; // pt
	readonly color: string;
	readonly rotation: number; // degrees
	readonly opacity: number; // 0-1
}

export interface JPPageBorderSide {
	readonly style: string; // 'single', 'double', 'dashed', 'dotted', etc.
	readonly color: string;
	readonly width: number; // in eighths of a point (OOXML)
	readonly space: number; // spacing from text/page edge in pt
}

export interface JPPageBorders {
	readonly top?: JPPageBorderSide;
	readonly bottom?: JPPageBorderSide;
	readonly left?: JPPageBorderSide;
	readonly right?: JPPageBorderSide;
	readonly display: 'allPages' | 'firstPage' | 'notFirstPage';
	readonly offsetFrom: 'page' | 'text';
}

export interface JPLineNumbering {
	readonly start: number;
	readonly countBy: number;
	readonly restart: 'newPage' | 'newSection' | 'continuous';
	readonly distance: number; // twips
}

export interface JPSectionProperties {
	readonly pageSize: {
		readonly width: number; // twips (Letter: 12240, A4: 11906)
		readonly height: number; // twips (Letter: 15840, A4: 16838)
	};
	readonly margins: {
		readonly top: number; // twips
		readonly right: number;
		readonly bottom: number;
		readonly left: number;
		readonly header: number; // distance from edge to header
		readonly footer: number; // distance from edge to footer
		readonly gutter: number;
	};
	readonly orientation: JPOrientation;
	readonly columns?: JPSectionColumns;
	readonly headerReferences?: readonly JPHeaderFooterRef[];
	readonly footerReferences?: readonly JPHeaderFooterRef[];
	readonly watermark?: JPWatermark;
	readonly pageBorders?: JPPageBorders;
	readonly lineNumbering?: JPLineNumbering;
}

/**
 * Default section properties for a standard A4 document.
 */
export const DEFAULT_SECTION_PROPERTIES: JPSectionProperties = {
	pageSize: {
		width: 11906, // A4 width in twips
		height: 16838, // A4 height in twips
	},
	margins: {
		top: 1440, // 1 inch
		right: 1440,
		bottom: 1440,
		left: 1440,
		header: 720, // 0.5 inch
		footer: 720,
		gutter: 0,
	},
	orientation: 'portrait',
};
