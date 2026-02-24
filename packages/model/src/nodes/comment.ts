import type { JPLeaf } from './node';

export interface JPCommentRangeStart extends JPLeaf {
	readonly type: 'comment-range-start';
	readonly id: string;
	readonly commentId: string;
}

export interface JPCommentRangeEnd extends JPLeaf {
	readonly type: 'comment-range-end';
	readonly id: string;
	readonly commentId: string;
}

export interface JPComment {
	readonly id: string;
	readonly author: string;
	readonly date: string;
	readonly text: string;
	readonly resolved: boolean;
	readonly parentId?: string;
}

export function createCommentRangeStart(id: string, commentId: string): JPCommentRangeStart {
	return { type: 'comment-range-start', id, commentId };
}

export function createCommentRangeEnd(id: string, commentId: string): JPCommentRangeEnd {
	return { type: 'comment-range-end', id, commentId };
}

export function createComment(config: {
	id: string;
	author: string;
	text: string;
	date?: string;
	resolved?: boolean;
	parentId?: string;
}): JPComment {
	return {
		id: config.id,
		author: config.author,
		date: config.date ?? new Date().toISOString(),
		text: config.text,
		resolved: config.resolved ?? false,
		parentId: config.parentId,
	};
}
