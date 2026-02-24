/**
 * Image and drawing properties.
 * Dimensions are in EMU (914400 per inch).
 */

/**
 * Crop rectangle expressed as percentages (0-1) from each edge.
 * e.g. { top: 0.1, right: 0, bottom: 0.1, left: 0 } crops 10% from top and bottom.
 */
export interface JPImageCrop {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

/**
 * Wrap type for text wrapping around images.
 * - 'inline': image is inline with text (no wrapping)
 * - 'square': text wraps in a rectangular bounding box
 * - 'tight': text wraps tightly around the image contour
 * - 'behind': image is behind the text layer
 * - 'inFront': image is in front of the text layer
 */
export type JPImageWrapType = 'inline' | 'square' | 'tight' | 'behind' | 'inFront';

export interface JPImageProperties {
	readonly src: string; // data URL, blob URL, or relative path
	readonly mimeType: string; // 'image/png', 'image/jpeg', etc.
	readonly width: number; // EMU
	readonly height: number; // EMU
	readonly originalWidth?: number; // EMU - original dimensions for resetSize
	readonly originalHeight?: number; // EMU - original dimensions for resetSize
	readonly altText?: string;
	readonly title?: string;
	readonly crop?: JPImageCrop; // crop percentages from each edge (0-1)
	readonly rotation?: number; // rotation in degrees (clockwise)
	readonly flipH?: boolean; // horizontal flip
	readonly flipV?: boolean; // vertical flip
	readonly wrapType?: JPImageWrapType; // text wrap mode
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
