import type { JPEditorState } from '@jpoffice/engine';
import { useCallback, useSyncExternalStore } from 'react';
import { useEditor } from './useEditor';

/**
 * Subscribe to editor state changes using React 18+ useSyncExternalStore.
 * Re-renders when the editor state changes.
 */
export function useEditorState(): JPEditorState {
	const editor = useEditor();

	const subscribe = useCallback((callback: () => void) => editor.subscribe(callback), [editor]);

	const getSnapshot = useCallback(() => editor.getState(), [editor]);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
