/**
 * Default keybinding map.
 * Maps keyboard shortcuts to command IDs.
 */
export interface KeyBinding {
	readonly shortcut: string; // e.g. 'Ctrl+B', 'Meta+Z'
	readonly commandId: string;
	readonly args?: unknown;
}

export const DEFAULT_KEYBINDINGS: readonly KeyBinding[] = [
	// Formatting
	{ shortcut: 'Ctrl+B', commandId: 'format.bold' },
	{ shortcut: 'Meta+B', commandId: 'format.bold' },
	{ shortcut: 'Ctrl+I', commandId: 'format.italic' },
	{ shortcut: 'Meta+I', commandId: 'format.italic' },
	{ shortcut: 'Ctrl+U', commandId: 'format.underline' },
	{ shortcut: 'Meta+U', commandId: 'format.underline' },

	// History
	{ shortcut: 'Ctrl+Z', commandId: 'history.undo' },
	{ shortcut: 'Meta+Z', commandId: 'history.undo' },
	{ shortcut: 'Ctrl+Y', commandId: 'history.redo' },
	{ shortcut: 'Meta+Shift+Z', commandId: 'history.redo' },
	{ shortcut: 'Ctrl+Shift+Z', commandId: 'history.redo' },

	// Selection
	{ shortcut: 'Ctrl+A', commandId: 'selection.selectAll' },
	{ shortcut: 'Meta+A', commandId: 'selection.selectAll' },
];

/**
 * Normalize a keyboard event to a shortcut string.
 */
export function eventToShortcut(e: {
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	key: string;
}): string {
	const parts: string[] = [];
	if (e.ctrlKey) parts.push('Ctrl');
	if (e.metaKey) parts.push('Meta');
	if (e.altKey) parts.push('Alt');
	if (e.shiftKey) parts.push('Shift');

	const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
	parts.push(key);

	return parts.join('+');
}
