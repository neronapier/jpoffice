import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';

/**
 * HistoryPlugin registers undo/redo commands that delegate to
 * the editor's built-in undo/redo functionality.
 */
export class HistoryPlugin implements JPPlugin {
	readonly id = 'jpoffice.history';
	readonly name = 'History';

	initialize(editor: JPEditor): void {
		editor.registerCommand({
			id: 'history.undo',
			name: 'Undo',
			shortcuts: ['Ctrl+Z', 'Meta+Z'],
			canExecute: () => editor.canUndo(),
			execute: () => editor.undo(),
		});

		editor.registerCommand({
			id: 'history.redo',
			name: 'Redo',
			shortcuts: ['Ctrl+Y', 'Ctrl+Shift+Z', 'Meta+Shift+Z'],
			canExecute: () => editor.canRedo(),
			execute: () => editor.redo(),
		});
	}
}
