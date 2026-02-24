/**
 * Hook for managing footnotes and endnotes.
 * Provides access to the document's footnote/endnote lists
 * and mutation functions via the FootnotePlugin.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { FootnotePlugin } from '@jpoffice/engine';
import type { FootnoteWithNumber } from '@jpoffice/engine';
import { useCallback, useEffect, useState } from 'react';

export interface UseFootnotesReturn {
	readonly footnotes: readonly FootnoteWithNumber[];
	readonly endnotes: readonly FootnoteWithNumber[];
	readonly addFootnote: (content?: string) => void;
	readonly addEndnote: (content?: string) => void;
	readonly removeFootnote: (footnoteId: string) => void;
}

export function useFootnotes(editor: JPEditor | null): UseFootnotesReturn {
	const [footnotes, setFootnotes] = useState<readonly FootnoteWithNumber[]>([]);
	const [endnotes, setEndnotes] = useState<readonly FootnoteWithNumber[]>([]);

	useEffect(() => {
		if (!editor) return;

		const plugin = editor.getPlugin('jpoffice.footnote') as FootnotePlugin | undefined;
		if (!plugin) return;

		// Sync initial state
		const doc = editor.getDocument();
		setFootnotes(plugin.getFootnotes(doc));
		setEndnotes(plugin.getEndnotes(doc));

		// Listen for changes
		plugin.onFootnotesChange = () => {
			const currentDoc = editor.getDocument();
			setFootnotes(plugin.getFootnotes(currentDoc));
			setEndnotes(plugin.getEndnotes(currentDoc));
		};

		// Also subscribe to editor state
		const unsubscribe = editor.subscribe(() => {
			const currentDoc = editor.getDocument();
			setFootnotes(plugin.getFootnotes(currentDoc));
			setEndnotes(plugin.getEndnotes(currentDoc));
		});

		return () => {
			unsubscribe();
			plugin.onFootnotesChange = undefined;
		};
	}, [editor]);

	const addFootnote = useCallback(
		(content?: string) => {
			if (!editor) return;
			editor.executeCommand('footnote.insert', content ? { content } : undefined);
		},
		[editor],
	);

	const addEndnote = useCallback(
		(content?: string) => {
			if (!editor) return;
			editor.executeCommand('endnote.insert', content ? { content } : undefined);
		},
		[editor],
	);

	const removeFootnote = useCallback(
		(footnoteId: string) => {
			if (!editor) return;
			// Try footnote first, then endnote
			const doc = editor.getDocument();
			const isFootnote = (doc.footnotes ?? []).some((fn: { id: string }) => fn.id === footnoteId);
			if (isFootnote) {
				editor.executeCommand('footnote.delete', { footnoteId });
			} else {
				editor.executeCommand('endnote.delete', { footnoteId });
			}
		},
		[editor],
	);

	return { footnotes, endnotes, addFootnote, addEndnote, removeFootnote };
}
