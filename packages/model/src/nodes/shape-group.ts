import { generateId } from './node';
import type { JPElement } from './node';
import type { JPShape } from './shape';

/** A group of shapes that move and resize together. */
export interface JPShapeGroup extends JPElement {
	readonly type: 'shape-group';
	readonly id: string;
	readonly children: readonly JPShape[];
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export function createShapeGroup(
	shapes: JPShape[],
	bounds?: { x: number; y: number; width: number; height: number },
): JPShapeGroup {
	const x = bounds?.x ?? Math.min(...shapes.map((s) => s.x));
	const y = bounds?.y ?? Math.min(...shapes.map((s) => s.y));
	const maxX = Math.max(...shapes.map((s) => s.x + s.width));
	const maxY = Math.max(...shapes.map((s) => s.y + s.height));
	return {
		type: 'shape-group',
		id: generateId(),
		children: shapes,
		x,
		y,
		width: bounds?.width ?? maxX - x,
		height: bounds?.height ?? maxY - y,
	};
}

export function isShapeGroup(node: unknown): node is JPShapeGroup {
	return (
		typeof node === 'object' && node !== null && (node as { type: string }).type === 'shape-group'
	);
}
