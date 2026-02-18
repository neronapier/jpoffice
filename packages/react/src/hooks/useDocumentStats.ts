'use client';

import { getPlainText } from '@jpoffice/model';
import { useMemo } from 'react';
import { useEditorState } from './useEditorState';
import { useLayout } from './useLayout';

export interface DocumentStats {
	pageCount: number;
	wordCount: number;
	charCount: number;
}

/**
 * Compute document statistics: page count, word count, character count.
 */
export function useDocumentStats(): DocumentStats {
	const state = useEditorState();
	const layout = useLayout();

	return useMemo(() => {
		const pageCount = layout ? layout.pages.length : 1;
		const text = getPlainText(state.document);
		const trimmed = text.trim();
		const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
		const charCount = text.length;

		return { pageCount, wordCount, charCount };
	}, [state.document, layout]);
}
