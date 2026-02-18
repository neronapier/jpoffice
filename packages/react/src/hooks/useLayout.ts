import { LayoutEngine } from '@jpoffice/layout';
import type { LayoutResult } from '@jpoffice/layout';
import { useMemo, useRef } from 'react';
import { useEditorState } from './useEditorState';

/**
 * Compute layout for the current document.
 * Creates a LayoutEngine once and re-runs layout when the document changes.
 */
export function useLayout(): LayoutResult | null {
	const engineRef = useRef<LayoutEngine | null>(null);
	if (!engineRef.current) {
		engineRef.current = new LayoutEngine();
	}

	const state = useEditorState();

	return useMemo(() => {
		if (!engineRef.current) return null;
		return engineRef.current.layout(state.document);
	}, [state.document]);
}
