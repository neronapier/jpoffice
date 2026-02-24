/**
 * Run-level properties define inline text formatting.
 * These map directly to OOXML w:rPr elements.
 *
 * Font sizes are in half-points (w:sz): 24 = 12pt.
 */

import type { JPRevisionInfo } from './revision-props';

export type JPUnderlineStyle =
	| 'none'
	| 'single'
	| 'double'
	| 'thick'
	| 'dotted'
	| 'dashed'
	| 'dashDot'
	| 'dashDotDot'
	| 'wave';

export interface JPRunProperties {
	readonly styleId?: string;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly underline?: JPUnderlineStyle;
	readonly strikethrough?: boolean;
	readonly doubleStrikethrough?: boolean;
	readonly superscript?: boolean;
	readonly subscript?: boolean;
	readonly fontFamily?: string;
	readonly fontSize?: number; // half-points (24 = 12pt)
	readonly color?: string; // hex without '#', e.g. 'FF0000'
	readonly highlight?: string; // highlight color name
	readonly backgroundColor?: string; // hex shading
	readonly allCaps?: boolean;
	readonly smallCaps?: boolean;
	readonly letterSpacing?: number; // twips
	readonly language?: string; // BCP47, e.g. 'es-AR'

	readonly direction?: 'ltr' | 'rtl' | 'auto'; // run direction override (BiDi)

	// Track changes / revision tracking
	readonly revision?: JPRevisionInfo;
	/** For formatChange revisions: stores the properties before the format change */
	readonly previousProperties?: Partial<JPRunProperties>;
}
