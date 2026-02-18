import type { JPElement } from './node';
import type { JPRun } from './run';

/**
 * JPHyperlink wraps runs with a link target.
 */
export interface JPHyperlink extends JPElement {
	readonly type: 'hyperlink';
	readonly children: readonly JPRun[];
	readonly href: string;
	readonly tooltip?: string;
	readonly anchor?: string; // internal bookmark reference
}

export function createHyperlink(
	id: string,
	children: readonly JPRun[],
	href: string,
	tooltip?: string,
): JPHyperlink {
	return { type: 'hyperlink', id, children, href, tooltip };
}
