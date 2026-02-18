import type { JPSelection } from '@jpoffice/model';
import { useEditorState } from './useEditorState';

/**
 * Get the current editor selection.
 * Re-renders when the selection changes.
 */
export function useSelection(): JPSelection {
	return useEditorState().selection;
}
