import type { JPLeaf } from './node';

export interface JPBookmarkStart extends JPLeaf {
	readonly type: 'bookmark-start';
	readonly bookmarkId: string;
	readonly name: string;
}

export interface JPBookmarkEnd extends JPLeaf {
	readonly type: 'bookmark-end';
	readonly bookmarkId: string;
}

export function createBookmarkStart(id: string, bookmarkId: string, name: string): JPBookmarkStart {
	return { type: 'bookmark-start', id, bookmarkId, name };
}

export function createBookmarkEnd(id: string, bookmarkId: string): JPBookmarkEnd {
	return { type: 'bookmark-end', id, bookmarkId };
}
