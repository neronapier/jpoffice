import type { JPLeaf, JPNodeType } from './node';

/**
 * JPText is the leaf node containing actual text content.
 * It exists inside a JPRun.
 */
export interface JPText extends JPLeaf {
	readonly type: 'text';
	readonly text: string;
}

export function createText(id: string, text: string): JPText {
	return { type: 'text' as JPNodeType as 'text', id, text };
}

export function isText(node: { type: string }): node is JPText {
	return node.type === 'text';
}
