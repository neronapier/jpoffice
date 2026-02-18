import type { JPLeaf } from './node';

export interface JPPageBreak extends JPLeaf {
	readonly type: 'page-break';
}

export interface JPLineBreak extends JPLeaf {
	readonly type: 'line-break';
}

export interface JPColumnBreak extends JPLeaf {
	readonly type: 'column-break';
}

export interface JPTab extends JPLeaf {
	readonly type: 'tab';
}

export function createPageBreak(id: string): JPPageBreak {
	return { type: 'page-break', id };
}

export function createLineBreak(id: string): JPLineBreak {
	return { type: 'line-break', id };
}

export function createColumnBreak(id: string): JPColumnBreak {
	return { type: 'column-break', id };
}

export function createTab(id: string): JPTab {
	return { type: 'tab', id };
}
