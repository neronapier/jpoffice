import type { JPDrawingProperties } from '../properties/image-props';
import type { JPImage } from './image';
import type { JPElement } from './node';

/**
 * JPDrawing wraps an image with positioning information
 * (inline or floating). In OOXML this maps to w:drawing.
 */
export interface JPDrawing extends JPElement {
	readonly type: 'drawing';
	readonly children: readonly [JPImage];
	readonly properties: JPDrawingProperties;
}

export function createDrawing(
	id: string,
	image: JPImage,
	properties: JPDrawingProperties,
): JPDrawing {
	return { type: 'drawing', id, children: [image], properties };
}

export function isDrawing(node: { type: string }): node is JPDrawing {
	return node.type === 'drawing';
}
