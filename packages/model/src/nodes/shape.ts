import { generateId } from './node';
import type { JPLeaf } from './node';

/**
 * Supported shape types for drawing primitives.
 */
export type JPShapeType =
	| 'rectangle'
	| 'rounded-rectangle'
	| 'ellipse'
	| 'triangle'
	| 'diamond'
	| 'pentagon'
	| 'hexagon'
	| 'star'
	| 'arrow-right'
	| 'arrow-left'
	| 'arrow-up'
	| 'arrow-down'
	| 'line'
	| 'curved-line'
	| 'connector'
	| 'callout'
	| 'cloud'
	| 'heart';

/**
 * Fill options for shapes and text boxes.
 */
export interface JPShapeFill {
	readonly type: 'solid' | 'gradient' | 'none';
	readonly color?: string;
	readonly gradientStops?: readonly { readonly offset: number; readonly color: string }[];
}

/**
 * Stroke options for shapes and text boxes.
 */
export interface JPShapeStroke {
	readonly color: string;
	readonly width: number; // in EMU
	readonly dashStyle?: 'solid' | 'dash' | 'dot' | 'dashDot';
}

/**
 * JPShape is a leaf node representing a drawing shape.
 * Shapes are positioned absolutely on the page using EMU coordinates.
 */
export interface JPShape extends JPLeaf {
	readonly type: 'shape';
	readonly id: string;
	readonly shapeType: JPShapeType;
	readonly x: number; // EMU from page left
	readonly y: number; // EMU from page top
	readonly width: number; // EMU
	readonly height: number; // EMU
	readonly rotation?: number; // degrees clockwise
	readonly fill?: JPShapeFill;
	readonly stroke?: JPShapeStroke;
	readonly text?: string;
	readonly zIndex?: number;
}

/**
 * Create a shape node with the given parameters.
 */
export function createShape(
	shapeType: JPShapeType,
	x: number,
	y: number,
	width: number,
	height: number,
	options?: {
		id?: string;
		rotation?: number;
		fill?: JPShapeFill;
		stroke?: JPShapeStroke;
		text?: string;
		zIndex?: number;
	},
): JPShape {
	return {
		type: 'shape',
		id: options?.id ?? generateId(),
		shapeType,
		x,
		y,
		width,
		height,
		rotation: options?.rotation,
		fill: options?.fill,
		stroke: options?.stroke,
		text: options?.text,
		zIndex: options?.zIndex,
	};
}

/**
 * Type guard for JPShape nodes.
 */
export function isShape(node: unknown): node is JPShape {
	return (
		typeof node === 'object' &&
		node !== null &&
		'type' in node &&
		(node as { type: string }).type === 'shape'
	);
}
