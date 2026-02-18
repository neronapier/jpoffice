import type { JPElement } from './node';
import type { JPParagraph } from './paragraph';
import type { JPTable } from './table';

export type JPHeaderFooterContent = JPParagraph | JPTable;

export interface JPHeader extends JPElement {
	readonly type: 'header';
	readonly children: readonly JPHeaderFooterContent[];
}

export interface JPFooter extends JPElement {
	readonly type: 'footer';
	readonly children: readonly JPHeaderFooterContent[];
}

export function createHeader(id: string, children: readonly JPHeaderFooterContent[]): JPHeader {
	return { type: 'header', id, children };
}

export function createFooter(id: string, children: readonly JPHeaderFooterContent[]): JPFooter {
	return { type: 'footer', id, children };
}
