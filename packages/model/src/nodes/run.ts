import type { JPRunProperties } from '../properties/run-props';
import type { JPElement } from './node';
import type { JPText } from './text';

/**
 * JPRun is an inline text span with uniform formatting.
 * It contains one or more JPText leaf nodes.
 *
 * In OOXML, a run (w:r) has run properties (w:rPr) and text (w:t).
 * We model runs as elements containing JPText children so that
 * text operations (split, merge) work uniformly.
 */
export interface JPRun extends JPElement {
	readonly type: 'run';
	readonly children: readonly JPText[];
	readonly properties: JPRunProperties;
}

export function createRun(
	id: string,
	children: readonly JPText[],
	properties: JPRunProperties = {},
): JPRun {
	return { type: 'run', id, children, properties };
}

export function isRun(node: { type: string }): node is JPRun {
	return node.type === 'run';
}
