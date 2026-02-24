import {
	createComment,
	createCommentRangeEnd,
	createCommentRangeStart,
	generateId,
	traverseNodes,
} from '@jpoffice/model';
import type { JPComment, JPPath } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

export interface AddCommentArgs {
	text: string;
	author: string;
}

export interface ReplyCommentArgs {
	commentId: string;
	text: string;
	author: string;
}

export class CommentPlugin implements JPPlugin {
	readonly id = 'jpoffice.comment';
	readonly name = 'Comment';

	private onCommentsChange?: (comments: readonly JPComment[]) => void;

	setOnCommentsChange(callback: (comments: readonly JPComment[]) => void): void {
		this.onCommentsChange = callback;
	}

	initialize(editor: JPEditor): void {
		editor.registerCommand<AddCommentArgs>({
			id: 'comment.add',
			name: 'Add Comment',
			canExecute: () => {
				const sel = editor.getSelection();
				return !editor.isReadOnly() && sel !== null && !SelectionManager.isCollapsed(sel);
			},
			execute: (_ed, args) => this.addComment(editor, args),
		});

		editor.registerCommand<{ commentId: string }>({
			id: 'comment.resolve',
			name: 'Resolve Comment',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.resolveComment(editor, args.commentId),
		});

		editor.registerCommand<{ commentId: string }>({
			id: 'comment.delete',
			name: 'Delete Comment',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.deleteComment(editor, args.commentId),
		});

		editor.registerCommand<ReplyCommentArgs>({
			id: 'comment.reply',
			name: 'Reply to Comment',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.replyComment(editor, args),
		});
	}

	private addComment(editor: JPEditor, args: AddCommentArgs): void {
		const sel = editor.getSelection();
		if (!sel || SelectionManager.isCollapsed(sel)) return;

		const commentId = generateId();
		const comment = createComment({
			id: commentId,
			author: args.author,
			text: args.text,
		});

		const rangeStart = createCommentRangeStart(generateId(), commentId);
		const rangeEnd = createCommentRangeEnd(generateId(), commentId);

		const doc = editor.getDocument();

		// Determine anchor and focus (normalized: anchor before focus)
		const normalized = SelectionManager.normalize(sel);
		const anchorCtx = resolveSelectionContext(doc, normalized.anchor);
		const focusCtx = resolveSelectionContext(doc, normalized.focus);

		editor.batch(() => {
			// Insert range-end marker first (so paths for range-start don't shift)
			// Insert after the focus run
			const focusRunPath = focusCtx.textPath.slice(0, -1);
			const focusRunIdx = focusRunPath[focusRunPath.length - 1];
			const focusParaPath = focusRunPath.slice(0, -1);
			const endInsertPath: JPPath = [...focusParaPath, focusRunIdx + 1];
			editor.apply({
				type: 'insert_node',
				path: endInsertPath,
				node: rangeEnd,
			});

			// Insert range-start marker before the anchor run
			const anchorRunPath = anchorCtx.textPath.slice(0, -1);
			const anchorRunIdx = anchorRunPath[anchorRunPath.length - 1];
			const anchorParaPath = anchorRunPath.slice(0, -1);
			const startInsertPath: JPPath = [...anchorParaPath, anchorRunIdx];
			editor.apply({
				type: 'insert_node',
				path: startInsertPath,
				node: rangeStart,
			});

			// Update the document's comments array
			const currentComments = editor.getDocument().comments ?? [];
			const newComments = [...currentComments, comment];
			// We store comments on the document root via set_properties
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { comments: newComments },
				oldProperties: { comments: currentComments },
			});
		});

		this.notifyCommentsChange(editor);
	}

	private resolveComment(editor: JPEditor, commentId: string): void {
		const doc = editor.getDocument();
		const comments = doc.comments ?? [];
		const idx = comments.findIndex((c) => c.id === commentId);
		if (idx === -1) return;

		const updatedComments = comments.map((c) =>
			c.id === commentId ? { ...c, resolved: true } : c,
		);

		editor.apply({
			type: 'set_properties',
			path: [],
			properties: { comments: updatedComments },
			oldProperties: { comments: comments },
		});

		this.notifyCommentsChange(editor);
	}

	private deleteComment(editor: JPEditor, commentId: string): void {
		const doc = editor.getDocument();

		editor.batch(() => {
			// Remove comment range markers from document tree
			const markers: { path: JPPath; node: { type: string; id: string; commentId: string } }[] = [];
			for (const [node, path] of traverseNodes(doc)) {
				if (
					(node.type === 'comment-range-start' || node.type === 'comment-range-end') &&
					'commentId' in node &&
					(node as { commentId: string }).commentId === commentId
				) {
					markers.push({
						path: [...path],
						node: node as { type: string; id: string; commentId: string },
					});
				}
			}

			// Remove in reverse order to preserve paths
			markers.sort((a, b) => {
				for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
					if (a.path[i] !== b.path[i]) return b.path[i] - a.path[i];
				}
				return b.path.length - a.path.length;
			});

			for (const marker of markers) {
				editor.apply({
					type: 'remove_node',
					path: marker.path,
					node: marker.node as unknown as import('@jpoffice/model').JPNode,
				});
			}

			// Remove comment and its replies from comments array
			const comments = editor.getDocument().comments ?? [];
			const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { comments: filtered },
				oldProperties: { comments },
			});
		});

		this.notifyCommentsChange(editor);
	}

	private replyComment(editor: JPEditor, args: ReplyCommentArgs): void {
		const doc = editor.getDocument();
		const comments = doc.comments ?? [];

		const reply = createComment({
			id: generateId(),
			author: args.author,
			text: args.text,
			parentId: args.commentId,
		});

		const newComments = [...comments, reply];
		editor.apply({
			type: 'set_properties',
			path: [],
			properties: { comments: newComments },
			oldProperties: { comments: comments },
		});

		this.notifyCommentsChange(editor);
	}

	private notifyCommentsChange(editor: JPEditor): void {
		if (this.onCommentsChange) {
			const doc = editor.getDocument();
			this.onCommentsChange(doc.comments ?? []);
		}
	}

	/** Get all comments for external use */
	getComments(editor: JPEditor): readonly JPComment[] {
		return editor.getDocument().comments ?? [];
	}

	/** Get comment threads (top-level comments with their replies) */
	getCommentThreads(editor: JPEditor): { comment: JPComment; replies: JPComment[] }[] {
		const comments = this.getComments(editor);
		const topLevel = comments.filter((c) => !c.parentId);
		return topLevel.map((comment) => ({
			comment,
			replies: comments.filter((c) => c.parentId === comment.id),
		}));
	}
}
