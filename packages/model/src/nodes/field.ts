import type { JPLeaf } from './node';

/**
 * Supported field types that map to OOXML field codes.
 */
export type JPFieldType = 'PAGE' | 'NUMPAGES' | 'DATE' | 'TIME' | 'AUTHOR' | 'TITLE' | 'FILENAME';

/**
 * JPField is a leaf node representing a dynamic field in the document.
 * Fields display a computed value (e.g. page number, date) that can be
 * updated at any time. Maps to OOXML w:fldSimple / w:fldChar sequences.
 */
export interface JPField extends JPLeaf {
	readonly type: 'field';
	readonly id: string;
	readonly fieldType: JPFieldType;
	readonly instruction: string;
	readonly cachedResult: string;
	readonly format?: string;
}

/**
 * Create a new field node.
 */
export function createField(
	id: string,
	fieldType: JPFieldType,
	options?: { instruction?: string; cachedResult?: string; format?: string },
): JPField {
	return {
		type: 'field',
		id,
		fieldType,
		instruction: options?.instruction ?? fieldType,
		cachedResult: options?.cachedResult ?? '',
		format: options?.format,
	};
}

/**
 * Type guard for field nodes.
 */
export function isField(node: { type: string }): node is JPField {
	return node.type === 'field';
}
