import type { JPImageProperties } from '../properties/image-props';
import type { JPLeaf } from './node';

/**
 * JPImage is a leaf node representing an embedded image.
 * It can exist inside a JPDrawing (for positioning) or
 * directly as an inline element.
 */
export interface JPImage extends JPLeaf {
	readonly type: 'image';
	readonly properties: JPImageProperties;
}

export function createImage(id: string, properties: JPImageProperties): JPImage {
	return { type: 'image', id, properties };
}

export function isImage(node: { type: string }): node is JPImage {
	return node.type === 'image';
}
