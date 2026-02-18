import { useCallback } from 'react';
import { useEditor } from './useEditor';

/**
 * Returns execute and canExecute helpers for a given command ID.
 */
export function useCommand(commandId: string) {
	const editor = useEditor();

	const execute = useCallback(
		(args?: unknown) => {
			editor.executeCommand(commandId, args);
		},
		[editor, commandId],
	);

	const canExecute = useCallback(
		(args?: unknown) => {
			return editor.canExecuteCommand(commandId, args);
		},
		[editor, commandId],
	);

	return { execute, canExecute };
}
