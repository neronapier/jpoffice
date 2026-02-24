/**
 * Layout types: the output of the layout engine.
 * These describe positioned boxes ready for rendering.
 */

import type { JPCellBorders, JPPath, JPShading, JPTableBorders, JPWrapping } from '@jpoffice/model';

// -- Geometry --

export interface LayoutRect {
	readonly x: number; // px
	readonly y: number; // px
	readonly width: number;
	readonly height: number;
}

// -- Resolved styles --

/**
 * Fully resolved run style with all inheritance applied.
 * This is what the renderer actually uses to draw text.
 */
export interface ResolvedRunStyle {
	readonly fontFamily: string;
	readonly fontSize: number; // px
	readonly bold: boolean;
	readonly italic: boolean;
	readonly underline: string | false; // 'single', 'double', etc. or false
	readonly strikethrough: boolean;
	readonly doubleStrikethrough: boolean;
	readonly superscript: boolean;
	readonly subscript: boolean;
	readonly color: string; // CSS color, e.g. '#000000'
	readonly backgroundColor: string | null;
	readonly highlight: string | null;
	readonly allCaps: boolean;
	readonly smallCaps: boolean;
	readonly letterSpacing: number; // px
}

// -- Layout tree --

/**
 * A text fragment within a line. Maps to (part of) a JPRun.
 */
export interface LayoutFragment {
	readonly text: string;
	readonly rect: LayoutRect;
	readonly runPath: JPPath;
	readonly runOffset: number; // character offset within the run's text
	readonly charCount: number;
	readonly style: ResolvedRunStyle;
	readonly href?: string; // hyperlink URL if this fragment is inside a hyperlink
}

/**
 * A laid-out line within a paragraph.
 */
export interface LayoutLine {
	readonly rect: LayoutRect;
	readonly baseline: number; // Y offset of baseline within line (from top of line)
	readonly fragments: readonly LayoutFragment[];
	readonly paragraphPath: JPPath;
	readonly lineIndex: number; // index within the paragraph
}

/**
 * A laid-out paragraph.
 */
export interface LayoutParagraph {
	readonly kind?: 'paragraph';
	readonly rect: LayoutRect;
	readonly lines: readonly LayoutLine[];
	readonly nodePath: JPPath;
	readonly outlineLevel?: number; // 0-5 for H1-H6, used for PDF document outlines
	readonly columnIndex?: number; // which column this block belongs to (multi-column layout)
}

/**
 * A laid-out table cell with full content.
 */
export interface LayoutTableCell {
	readonly nodeId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly contentRect: LayoutRect;
	readonly blocks: readonly LayoutBlock[];
	readonly borders?: JPCellBorders;
	readonly shading?: JPShading;
	readonly verticalAlignment: 'top' | 'center' | 'bottom';
	readonly gridSpan: number;
	readonly rowSpan: number;
}

/**
 * A laid-out table row.
 */
export interface LayoutTableRow {
	readonly nodeId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly cells: readonly LayoutTableCell[];
	readonly isHeader: boolean;
}

/**
 * A laid-out table.
 */
export interface LayoutTable {
	readonly kind: 'table';
	readonly nodeId: string;
	readonly path: JPPath;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly rows: readonly LayoutTableRow[];
	readonly borders?: JPTableBorders;
	readonly columnIndex?: number; // which column this block belongs to (multi-column layout)
}

/**
 * A laid-out image (inline or block-level).
 */
export interface LayoutImage {
	readonly kind: 'image';
	readonly rect: LayoutRect;
	readonly nodePath: JPPath;
	readonly src: string;
	readonly mimeType?: string;
	readonly columnIndex?: number; // which column this block belongs to (multi-column layout)
}

/**
 * Union of block-level layout elements.
 */
export type LayoutBlock = LayoutParagraph | LayoutTable | LayoutImage;

/**
 * A positioned floating image.
 */
export interface LayoutFloat {
	readonly nodeId: string;
	readonly imageNodeId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly src: string;
	readonly mimeType: string;
	readonly behindText: boolean;
	readonly wrapping: JPWrapping;
}

/**
 * Laid-out header or footer content.
 */
export interface LayoutHeaderFooter {
	readonly rect: LayoutRect;
	readonly blocks: readonly LayoutBlock[];
}

/**
 * Column metadata for a multi-column page.
 */
export interface LayoutPageColumns {
	readonly count: number;
	readonly space: number; // px between columns
	readonly separator: boolean;
	readonly columnWidths: readonly number[]; // width of each column in px
}

/**
 * A laid-out page.
 */
export interface LayoutPage {
	readonly index: number;
	readonly width: number; // px
	readonly height: number; // px
	readonly contentArea: LayoutRect; // inside margins
	readonly blocks: readonly LayoutBlock[];
	readonly floats?: readonly LayoutFloat[];
	readonly header?: LayoutHeaderFooter;
	readonly footer?: LayoutHeaderFooter;
	readonly columns?: LayoutPageColumns; // present when section has multi-column layout
}

/**
 * The complete layout result.
 */
export interface LayoutResult {
	readonly pages: readonly LayoutPage[];
	readonly version: number; // incremented on each layout pass
}

// -- Font metrics --

export interface FontMetrics {
	readonly ascent: number; // px, positive upward
	readonly descent: number; // px, positive downward
	readonly lineHeight: number; // px
	readonly emSize: number; // px (1em)
}

export interface TextMeasurement {
	readonly width: number; // px
	readonly height: number; // px
}

// -- Type guards --

export function isLayoutParagraph(block: LayoutBlock): block is LayoutParagraph {
	return 'lines' in block;
}

export function isLayoutTable(block: LayoutBlock): block is LayoutTable {
	return 'kind' in block && block.kind === 'table';
}

export function isLayoutImage(block: LayoutBlock): block is LayoutImage {
	return 'kind' in block && block.kind === 'image';
}
