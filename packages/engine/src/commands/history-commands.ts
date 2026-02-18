import type { JPCommand } from './command';

export const undoCommand: JPCommand<void> = {
	id: 'history.undo',
	name: 'Undo',
	shortcuts: ['Ctrl+Z', 'Meta+Z'],

	canExecute(editor) {
		return editor.canUndo();
	},

	execute(editor) {
		editor.undo();
	},
};

export const redoCommand: JPCommand<void> = {
	id: 'history.redo',
	name: 'Redo',
	shortcuts: ['Ctrl+Y', 'Meta+Y', 'Ctrl+Shift+Z', 'Meta+Shift+Z'],

	canExecute(editor) {
		return editor.canRedo();
	},

	execute(editor) {
		editor.redo();
	},
};

export const HISTORY_COMMANDS = [undoCommand, redoCommand] as const;
