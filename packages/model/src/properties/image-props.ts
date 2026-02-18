/**
 * Image and drawing properties.
 * Dimensions are in EMU (914400 per inch).
 */

export interface JPImageProperties {
	readonly src: string; // data URL, blob URL, or relative path
	readonly mimeType: string; // 'image/png', 'image/jpeg', etc.
	readonly width: number; // EMU
	readonly height: number; // EMU
	readonly altText?: string;
	readonly title?: string;
}

export type JPWrapSide = 'both' | 'left' | 'right' | 'largest';

export type JPWrapping =
	| { readonly type: 'none' }
	| { readonly type: 'square'; readonly side: JPWrapSide }
	| { readonly type: 'tight'; readonly side: JPWrapSide }
	| { readonly type: 'topAndBottom' };

export type JPFloatRelativeTo = 'page' | 'margin' | 'column' | 'paragraph' | 'character';

export type JPFloatAlign = 'left' | 'center' | 'right' | 'inside' | 'outside';

export interface JPFloatPosition {
	readonly relativeTo: JPFloatRelativeTo;
	readonly align?: JPFloatAlign;
	readonly offset?: number; // EMU
}

export interface JPDrawingProperties {
	readonly positioning: 'inline' | 'floating';
	readonly inline?: {
		readonly distTop: number; // EMU
		readonly distBottom: number;
		readonly distLeft: number;
		readonly distRight: number;
	};
	readonly floating?: {
		readonly horizontalPosition: JPFloatPosition;
		readonly verticalPosition: JPFloatPosition;
		readonly wrapping: JPWrapping;
		readonly behindText?: boolean;
		readonly allowOverlap?: boolean;
	};
}
