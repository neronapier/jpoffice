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
	// ── Formatting: Bold / Italic / Underline ───────────────────────────
	{ shortcut: 'Ctrl+B', commandId: 'format.bold' },
	{ shortcut: 'Meta+B', commandId: 'format.bold' },
	{ shortcut: 'Ctrl+I', commandId: 'format.italic' },
	{ shortcut: 'Meta+I', commandId: 'format.italic' },
	{ shortcut: 'Ctrl+U', commandId: 'format.underline' },
	{ shortcut: 'Meta+U', commandId: 'format.underline' },

	// ── Formatting: Strikethrough ───────────────────────────────────────
	{ shortcut: 'Ctrl+Shift+X', commandId: 'format.strikethrough' },
	{ shortcut: 'Meta+Shift+X', commandId: 'format.strikethrough' },
	{ shortcut: 'Ctrl+Shift+5', commandId: 'format.strikethrough' },
	{ shortcut: 'Meta+Shift+5', commandId: 'format.strikethrough' },

	// ── Formatting: Superscript / Subscript ─────────────────────────────
	{ shortcut: 'Ctrl+.', commandId: 'format.superscript' },
	{ shortcut: 'Meta+.', commandId: 'format.superscript' },
	{ shortcut: 'Ctrl+,', commandId: 'format.subscript' },
	{ shortcut: 'Meta+,', commandId: 'format.subscript' },

	// ── Formatting: Clear ───────────────────────────────────────────────
	{ shortcut: 'Ctrl+\\', commandId: 'format.clearFormatting' },
	{ shortcut: 'Meta+\\', commandId: 'format.clearFormatting' },

	// ── Alignment ───────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+L', commandId: 'format.align', args: { alignment: 'left' } },
	{ shortcut: 'Meta+L', commandId: 'format.align', args: { alignment: 'left' } },
	{ shortcut: 'Ctrl+E', commandId: 'format.align', args: { alignment: 'center' } },
	{ shortcut: 'Meta+E', commandId: 'format.align', args: { alignment: 'center' } },
	{ shortcut: 'Ctrl+R', commandId: 'format.align', args: { alignment: 'right' } },
	{ shortcut: 'Meta+R', commandId: 'format.align', args: { alignment: 'right' } },
	{ shortcut: 'Ctrl+J', commandId: 'format.align', args: { alignment: 'justify' } },
	{ shortcut: 'Meta+J', commandId: 'format.align', args: { alignment: 'justify' } },

	// ── Indentation ─────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+]', commandId: 'format.indent', args: { direction: 'increase' } },
	{ shortcut: 'Meta+]', commandId: 'format.indent', args: { direction: 'increase' } },
	{ shortcut: 'Ctrl+[', commandId: 'format.indent', args: { direction: 'decrease' } },
	{ shortcut: 'Meta+[', commandId: 'format.indent', args: { direction: 'decrease' } },

	// ── Line Spacing (Google Docs style) ────────────────────────────────
	{ shortcut: 'Ctrl+1', commandId: 'format.lineSpacing', args: { spacing: 240 } },
	{ shortcut: 'Meta+1', commandId: 'format.lineSpacing', args: { spacing: 240 } },
	{ shortcut: 'Ctrl+2', commandId: 'format.lineSpacing', args: { spacing: 480 } },
	{ shortcut: 'Meta+2', commandId: 'format.lineSpacing', args: { spacing: 480 } },
	{ shortcut: 'Ctrl+5', commandId: 'format.lineSpacing', args: { spacing: 360 } },
	{ shortcut: 'Meta+5', commandId: 'format.lineSpacing', args: { spacing: 360 } },

	// ── Lists ───────────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+Shift+7', commandId: 'list.toggleNumbered' },
	{ shortcut: 'Meta+Shift+7', commandId: 'list.toggleNumbered' },
	{ shortcut: 'Ctrl+Shift+8', commandId: 'list.toggleBullet' },
	{ shortcut: 'Meta+Shift+8', commandId: 'list.toggleBullet' },

	// ── Headings (Google Docs style: Ctrl+Alt+0..6) ─────────────────────
	{ shortcut: 'Ctrl+Alt+0', commandId: 'heading.clear' },
	{ shortcut: 'Meta+Alt+0', commandId: 'heading.clear' },
	{ shortcut: 'Ctrl+Alt+1', commandId: 'heading.set', args: { level: 1 } },
	{ shortcut: 'Meta+Alt+1', commandId: 'heading.set', args: { level: 1 } },
	{ shortcut: 'Ctrl+Alt+2', commandId: 'heading.set', args: { level: 2 } },
	{ shortcut: 'Meta+Alt+2', commandId: 'heading.set', args: { level: 2 } },
	{ shortcut: 'Ctrl+Alt+3', commandId: 'heading.set', args: { level: 3 } },
	{ shortcut: 'Meta+Alt+3', commandId: 'heading.set', args: { level: 3 } },
	{ shortcut: 'Ctrl+Alt+4', commandId: 'heading.set', args: { level: 4 } },
	{ shortcut: 'Meta+Alt+4', commandId: 'heading.set', args: { level: 4 } },
	{ shortcut: 'Ctrl+Alt+5', commandId: 'heading.set', args: { level: 5 } },
	{ shortcut: 'Meta+Alt+5', commandId: 'heading.set', args: { level: 5 } },
	{ shortcut: 'Ctrl+Alt+6', commandId: 'heading.set', args: { level: 6 } },
	{ shortcut: 'Meta+Alt+6', commandId: 'heading.set', args: { level: 6 } },

	// ── History ──────────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+Z', commandId: 'history.undo' },
	{ shortcut: 'Meta+Z', commandId: 'history.undo' },
	{ shortcut: 'Ctrl+Y', commandId: 'history.redo' },
	{ shortcut: 'Meta+Shift+Z', commandId: 'history.redo' },
	{ shortcut: 'Ctrl+Shift+Z', commandId: 'history.redo' },

	// ── Selection ───────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+A', commandId: 'selection.selectAll' },
	{ shortcut: 'Meta+A', commandId: 'selection.selectAll' },

	// ── Clipboard ───────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+C', commandId: 'clipboard.copy' },
	{ shortcut: 'Meta+C', commandId: 'clipboard.copy' },
	{ shortcut: 'Ctrl+X', commandId: 'clipboard.cut' },
	{ shortcut: 'Meta+X', commandId: 'clipboard.cut' },
	{ shortcut: 'Ctrl+V', commandId: 'clipboard.paste' },
	{ shortcut: 'Meta+V', commandId: 'clipboard.paste' },

	// ── Format Painter ──────────────────────────────────────────────────
	{ shortcut: 'Ctrl+Shift+C', commandId: 'format.copyFormat' },
	{ shortcut: 'Meta+Shift+C', commandId: 'format.copyFormat' },
	{ shortcut: 'Ctrl+Shift+V', commandId: 'format.pasteFormat' },
	{ shortcut: 'Meta+Shift+V', commandId: 'format.pasteFormat' },

	// ── Link ────────────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+K', commandId: 'link.showDialog' },
	{ shortcut: 'Meta+K', commandId: 'link.showDialog' },

	// ── Find & Replace ──────────────────────────────────────────────────
	{ shortcut: 'Ctrl+F', commandId: 'find.showUI' },
	{ shortcut: 'Meta+F', commandId: 'find.showUI' },
	{ shortcut: 'Ctrl+H', commandId: 'find.showUI', args: { replace: true } },
	{ shortcut: 'Meta+H', commandId: 'find.showUI', args: { replace: true } },

	// ── Page break ──────────────────────────────────────────────────────
	{ shortcut: 'Ctrl+Enter', commandId: 'text.insertPageBreak' },
	{ shortcut: 'Meta+Enter', commandId: 'text.insertPageBreak' },
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
