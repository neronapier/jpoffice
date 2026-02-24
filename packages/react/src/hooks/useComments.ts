/**
 * Hook for managing document comments.
 * Provides access to comment threads and mutation functions
 * via the CommentPlugin on the editor.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { CommentPlugin } from '@jpoffice/engine';
import type { JPComment } from '@jpoffice/model';
import { useCallback, useEffect, useState } from 'react';

export interface UseCommentsReturn {
	readonly comments: readonly JPComment[];
	readonly addComment: (text: string, author: string) => void;
	readonly resolveComment: (commentId: string) => void;
	readonly deleteComment: (commentId: string) => void;
}

export function useComments(editor: JPEditor | null): UseCommentsReturn {
	const [comments, setComments] = useState<readonly JPComment[]>([]);

	useEffect(() => {
		if (!editor) return;

		const plugin = editor.getPlugin('jpoffice.comment') as CommentPlugin | undefined;
		if (!plugin) return;

		// Sync initial state
		setComments(plugin.getComments(editor));

		// Listen for changes
		plugin.setOnCommentsChange((updated: readonly JPComment[]) => {
			setComments(updated);
		});

		// Also subscribe to editor state changes in case document is replaced
		const unsubscribe = editor.subscribe(() => {
			setComments(plugin.getComments(editor));
		});

		return () => {
			unsubscribe();
		};
	}, [editor]);

	const addComment = useCallback(
		(text: string, author: string) => {
			if (!editor) return;
			editor.executeCommand('comment.add', { text, author });
		},
		[editor],
	);

	const resolveComment = useCallback(
		(commentId: string) => {
			if (!editor) return;
			editor.executeCommand('comment.resolve', { commentId });
		},
		[editor],
	);

	const deleteComment = useCallback(
		(commentId: string) => {
			if (!editor) return;
			editor.executeCommand('comment.delete', { commentId });
		},
		[editor],
	);

	return { comments, addComment, resolveComment, deleteComment };
}
