import { generateId } from './node';
import type { JPElement } from './node';
import type { JPParagraph } from './paragraph';
import type { JPShapeFill, JPShapeStroke } from './shape';

/**
 * JPTextBox is an element node that contains paragraphs.
 * Text boxes are positioned absolutely on the page using EMU coordinates,
 * similar to shapes but with editable rich text content.
 */
export interface JPTextBox extends JPElement {
	readonly type: 'textbox';
	readonly id: string;
	readonly x: number; // EMU from page left
	readonly y: number; // EMU from page top
	readonly width: number; // EMU
	readonly height: number; // EMU
	readonly children: readonly JPParagraph[];
	readonly fill?: JPShapeFill;
	readonly stroke?: JPShapeStroke;
	readonly rotation?: number; // degrees clockwise
	readonly zIndex?: number;
}

/**
 * Create a text box node with the given position and dimensions.
 * Initially contains an empty paragraph.
 */
export function createTextBox(
	x: number,
	y: number,
	width: number,
	height: number,
	options?: {
		id?: string;
		children?: readonly JPParagraph[];
		fill?: JPShapeFill;
		stroke?: JPShapeStroke;
		rotation?: number;
		zIndex?: number;
	},
): JPTextBox {
	return {
		type: 'textbox',
		id: options?.id ?? generateId(),
		x,
		y,
		width,
		height,
		children: options?.children ?? [],
		fill: options?.fill,
		stroke: options?.stroke,
		rotation: options?.rotation,
		zIndex: options?.zIndex,
	};
}

/**
 * Type guard for JPTextBox nodes.
 */
export function isTextBox(node: unknown): node is JPTextBox {
	return (
		typeof node === 'object' &&
		node !== null &&
		'type' in node &&
		(node as { type: string }).type === 'textbox'
	);
}
