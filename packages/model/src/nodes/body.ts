import type { JPElement } from './node';
import type { JPSection } from './section';

/**
 * JPBody is the single child of JPDocument.
 * It contains one or more sections.
 */
export interface JPBody extends JPElement {
	readonly type: 'body';
	readonly children: readonly JPSection[];
}

export function createBody(id: string, sections: readonly JPSection[]): JPBody {
	return { type: 'body', id, children: sections };
}

export function isBody(node: { type: string }): node is JPBody {
	return node.type === 'body';
}
