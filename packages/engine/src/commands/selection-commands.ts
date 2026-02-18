import type { JPDocument, JPPath, JPText } from '@jpoffice/model';
import { pathEquals, traverseTexts } from '@jpoffice/model';
import type { JPCommand } from './command';

interface MoveArgs {
	direction: string;
	extend: boolean;
	word: boolean;
}

function collectTexts(doc: JPDocument): { path: JPPath; node: JPText }[] {
	const result: { path: JPPath; node: JPText }[] = [];
	for (const [node, path] of traverseTexts(doc)) {
		result.push({ path, node });
	}
	return result;
}

function findTextIndex(texts: { path: JPPath }[], targetPath: JPPath): number {
	return texts.findIndex((t) => pathEquals(t.path, targetPath));
}

/**
 * Find the next word boundary from the current position.
 * Returns new { path, offset } or null if at end.
 */
function findWordBoundary(
	texts: { path: JPPath; node: JPText }[],
	currentIdx: number,
	currentOffset: number,
	forward: boolean,
): { path: JPPath; offset: number } | null {
	if (forward) {
		// Move forward to next word boundary
		let idx = currentIdx;
		let offset = currentOffset;

		// Skip non-whitespace
		while (idx < texts.length) {
			const t = texts[idx].node.text;
			while (offset < t.length && !/\s/.test(t[offset])) {
				offset++;
			}
			if (offset < t.length) break;
			// Move to next text
			idx++;
			offset = 0;
		}

		// Skip whitespace
		while (idx < texts.length) {
			const t = texts[idx].node.text;
			while (offset < t.length && /\s/.test(t[offset])) {
				offset++;
			}
			if (offset < t.length || offset > 0) break;
			idx++;
			offset = 0;
		}

		if (idx >= texts.length) {
			const last = texts[texts.length - 1];
			return { path: last.path, offset: last.node.text.length };
		}
		return { path: texts[idx].path, offset };
	}

	// Move backward to previous word boundary
	let idx = currentIdx;
	let offset = currentOffset;

	// Skip whitespace backward
	while (idx >= 0) {
		const t = texts[idx].node.text;
		while (offset > 0 && /\s/.test(t[offset - 1])) {
			offset--;
		}
		if (offset > 0) break;
		idx--;
		if (idx >= 0) offset = texts[idx].node.text.length;
	}

	// Skip non-whitespace backward
	while (idx >= 0) {
		const t = texts[idx].node.text;
		while (offset > 0 && !/\s/.test(t[offset - 1])) {
			offset--;
		}
		if (offset >= 0) break;
		idx--;
		if (idx >= 0) offset = texts[idx].node.text.length;
	}

	if (idx < 0) return { path: texts[0].path, offset: 0 };
	return { path: texts[idx].path, offset };
}

export const moveCommand: JPCommand<MoveArgs> = {
	id: 'selection.move',
	name: 'Move Cursor',

	canExecute(editor) {
		return editor.getSelection() !== null;
	},

	execute(editor, args) {
		const selection = editor.getSelection();
		if (!selection) return;

		const doc = editor.getDocument();
		const texts = collectTexts(doc);
		if (texts.length === 0) return;

		const { direction, extend, word } = args;
		const focus = selection.focus;
		const idx = findTextIndex(texts, focus.path);
		if (idx === -1) return;

		let newPath: JPPath;
		let newOffset: number;

		switch (direction) {
			case 'ArrowLeft': {
				if (word) {
					const boundary = findWordBoundary(texts, idx, focus.offset, false);
					if (!boundary) return;
					newPath = boundary.path;
					newOffset = boundary.offset;
				} else if (focus.offset > 0) {
					newPath = focus.path;
					newOffset = focus.offset - 1;
				} else if (idx > 0) {
					// Move to end of previous text
					newPath = texts[idx - 1].path;
					newOffset = texts[idx - 1].node.text.length;
				} else {
					return; // Already at start
				}
				break;
			}

			case 'ArrowRight': {
				const currentText = texts[idx].node;
				if (word) {
					const boundary = findWordBoundary(texts, idx, focus.offset, true);
					if (!boundary) return;
					newPath = boundary.path;
					newOffset = boundary.offset;
				} else if (focus.offset < currentText.text.length) {
					newPath = focus.path;
					newOffset = focus.offset + 1;
				} else if (idx < texts.length - 1) {
					// Move to start of next text
					newPath = texts[idx + 1].path;
					newOffset = 0;
				} else {
					return; // Already at end
				}
				break;
			}

			case 'Home': {
				// Move to start of document (v1 simplification — should be line start)
				newPath = texts[0].path;
				newOffset = 0;
				break;
			}

			case 'End': {
				// Move to end of document (v1 simplification — should be line end)
				const last = texts[texts.length - 1];
				newPath = last.path;
				newOffset = last.node.text.length;
				break;
			}

			default:
				// ArrowUp, ArrowDown — would need layout info. No-op for v1.
				return;
		}

		const newFocus = { path: newPath, offset: newOffset };

		if (extend) {
			// Extend selection: keep anchor, move focus
			editor.setSelection({
				anchor: selection.anchor,
				focus: newFocus,
			});
		} else {
			// Collapse to new position
			editor.setSelection({
				anchor: newFocus,
				focus: newFocus,
			});
		}
	},
};

export const selectAllCommand: JPCommand<void> = {
	id: 'selection.selectAll',
	name: 'Select All',
	shortcuts: ['Ctrl+A', 'Meta+A'],

	canExecute(editor) {
		return editor.getSelection() !== null;
	},

	execute(editor) {
		const doc = editor.getDocument();
		const texts = collectTexts(doc);
		if (texts.length === 0) return;

		const first = texts[0];
		const last = texts[texts.length - 1];

		editor.setSelection({
			anchor: { path: first.path, offset: 0 },
			focus: { path: last.path, offset: last.node.text.length },
		});
	},
};

export const SELECTION_COMMANDS = [moveCommand, selectAllCommand] as const;
