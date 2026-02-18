import { useContext } from 'react';
import { EditorContext } from '../context/editor-context';

/**
 * Access the JPEditor instance from context.
 * Must be used within a JPOfficeEditor or EditorContext.Provider.
 */
export function useEditor() {
	const ctx = useContext(EditorContext);
	if (!ctx) {
		throw new Error('useEditor must be used within a JPOfficeEditor or EditorContext.Provider');
	}
	return ctx.editor;
}
