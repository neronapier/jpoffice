import type { JPDocument, JPPath, JPPoint, JPRange, JPText } from '@jpoffice/model';
import {
	generateId,
	getNodeAtPath,
	isElement,
	isText,
	parentPath,
	pathEquals,
	traverseTexts,
} from '@jpoffice/model';
import type { JPEditor } from '../editor';
import { SelectionManager } from '../selection/selection-manager';
import type { JPCommand } from './command';

// ── Helpers ──────────────────────────────────────────────

interface TextInfo {
	node: JPText;
	textPath: JPPath;
	offset: number;
	runPath: JPPath;
	textIdx: number;
	paraPath: JPPath;
	runIdx: number;
}

function getTextInfo(doc: JPDocument, point: JPPoint): TextInfo | null {
	try {
		const node = getNodeAtPath(doc, point.path);
		if (!isText(node)) return null;
		const textPath = point.path;
		const runPath = parentPath(textPath);
		const paraPath = parentPath(runPath);
		return {
			node,
			textPath,
			offset: point.offset,
			runPath,
			textIdx: textPath[textPath.length - 1],
			paraPath,
			runIdx: runPath[runPath.length - 1],
		};
	} catch {
		return null;
	}
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
 * Delete a range of selected content.
 * Handles same-text, same-paragraph, and cross-paragraph cases.
 */
function deleteRange(editor: JPEditor, range: JPRange): void {
	const norm = SelectionManager.normalize(range);
	const start = norm.anchor;
	const end = norm.focus;

	// Same text node — simple delete
	if (pathEquals(start.path, end.path)) {
		const node = getNodeAtPath(editor.getDocument(), start.path);
		if (!isText(node)) return;
		editor.apply({
			type: 'delete_text',
			path: start.path,
			offset: start.offset,
			text: node.text.slice(start.offset, end.offset),
		});
		return;
	}

	// Cross-node deletion
	const startRunPath = start.path.slice(0, -1);
	const endRunPath = end.path.slice(0, -1);
	const startParaPath = start.path.slice(0, -2);
	const endParaPath = end.path.slice(0, -2);
	const sameParagraph = pathEquals(startParaPath, endParaPath);

	// Step 1: Truncate end text (delete from 0 to endOffset)
	if (end.offset > 0) {
		const endNode = getNodeAtPath(editor.getDocument(), end.path);
		if (isText(endNode)) {
			editor.apply({
				type: 'delete_text',
				path: end.path,
				offset: 0,
				text: endNode.text.slice(0, end.offset),
			});
		}
	}

	// Step 2: Truncate start text (delete from startOffset to end)
	{
		const startNode = getNodeAtPath(editor.getDocument(), start.path);
		if (isText(startNode) && start.offset < startNode.text.length) {
			editor.apply({
				type: 'delete_text',
				path: start.path,
				offset: start.offset,
				text: startNode.text.slice(start.offset),
			});
		}
	}

	if (sameParagraph) {
		// Same paragraph, different runs: remove intermediate runs, then merge
		const startRunIdx = startRunPath[startRunPath.length - 1];
		const endRunIdx = endRunPath[endRunPath.length - 1];

		// Remove runs between start and end (reverse order to preserve indices)
		for (let i = endRunIdx - 1; i > startRunIdx; i--) {
			const runPath = [...startParaPath, i];
			editor.apply({
				type: 'remove_node',
				path: runPath,
				node: getNodeAtPath(editor.getDocument(), runPath),
			});
		}

		// Merge end run into start run (if different runs)
		if (startRunIdx !== endRunIdx) {
			const newEndRunPath = [...startParaPath, startRunIdx + 1];
			const startRun = getNodeAtPath(editor.getDocument(), startRunPath);
			if (isElement(startRun)) {
				editor.apply({
					type: 'merge_node',
					path: newEndRunPath,
					position: startRun.children.length,
					properties: {},
				});
			}
		}
	} else {
		// Cross-paragraph: remove intermediate content, merge paragraphs
		const startRunIdx = startRunPath[startRunPath.length - 1];
		const endRunIdx = endRunPath[endRunPath.length - 1];
		const startParaIdx = startParaPath[startParaPath.length - 1];
		const endParaIdx = endParaPath[endParaPath.length - 1];

		// Remove runs after startRun in start paragraph (reverse order)
		const startPara = getNodeAtPath(editor.getDocument(), startParaPath);
		if (isElement(startPara)) {
			for (let i = startPara.children.length - 1; i > startRunIdx; i--) {
				editor.apply({
					type: 'remove_node',
					path: [...startParaPath, i],
					node: getNodeAtPath(editor.getDocument(), [...startParaPath, i]),
				});
			}
		}

		// Remove runs before endRun in end paragraph (reverse order)
		for (let i = endRunIdx - 1; i >= 0; i--) {
			editor.apply({
				type: 'remove_node',
				path: [...endParaPath, i],
				node: getNodeAtPath(editor.getDocument(), [...endParaPath, i]),
			});
		}

		// Remove intermediate paragraphs (reverse order to preserve indices)
		const sectionPath = startParaPath.slice(0, -1);
		for (let i = endParaIdx - 1; i > startParaIdx; i--) {
			const paraPath = [...sectionPath, i];
			editor.apply({
				type: 'remove_node',
				path: paraPath,
				node: getNodeAtPath(editor.getDocument(), paraPath),
			});
		}

		// Merge end paragraph into start paragraph
		const newEndParaPath = [...sectionPath, startParaIdx + 1];
		const updatedStartPara = getNodeAtPath(editor.getDocument(), startParaPath);
		if (isElement(updatedStartPara)) {
			editor.apply({
				type: 'merge_node',
				path: newEndParaPath,
				position: updatedStartPara.children.length,
				properties: {},
			});
		}
	}
}

// ── Commands ─────────────────────────────────────────────

export const insertTextCommand: JPCommand<{ text: string }> = {
	id: 'text.insert',
	name: 'Insert Text',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor, args) {
		const selection = editor.getSelection();
		if (!selection) return;

		editor.batch(() => {
			// Delete existing selection first
			if (!SelectionManager.isCollapsed(selection)) {
				const norm = SelectionManager.normalize(selection);
				deleteRange(editor, selection);
				// After delete, collapse at start
				editor.apply({
					type: 'set_selection',
					oldSelection: editor.getSelection(),
					newSelection: SelectionManager.collapse(norm.anchor.path, norm.anchor.offset),
				});
			}

			const cursor = editor.getSelection();
			if (!cursor) return;

			const info = getTextInfo(editor.getDocument(), cursor.anchor);
			if (!info) return;

			// Insert text
			editor.apply({
				type: 'insert_text',
				path: info.textPath,
				offset: info.offset,
				text: args.text,
			});

			// Move cursor forward
			editor.apply({
				type: 'set_selection',
				oldSelection: editor.getSelection(),
				newSelection: SelectionManager.collapse(info.textPath, info.offset + args.text.length),
			});
		});
	},
};

export const insertParagraphCommand: JPCommand<void> = {
	id: 'text.insertParagraph',
	name: 'Insert Paragraph',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor) {
		const selection = editor.getSelection();
		if (!selection) return;

		editor.batch(() => {
			// Delete existing selection first
			if (!SelectionManager.isCollapsed(selection)) {
				const norm = SelectionManager.normalize(selection);
				deleteRange(editor, selection);
				editor.apply({
					type: 'set_selection',
					oldSelection: editor.getSelection(),
					newSelection: SelectionManager.collapse(norm.anchor.path, norm.anchor.offset),
				});
			}

			const cursor = editor.getSelection();
			if (!cursor) return;

			const info = getTextInfo(editor.getDocument(), cursor.anchor);
			if (!info) return;

			// Split text node at character offset
			editor.apply({
				type: 'split_node',
				path: info.textPath,
				position: info.offset,
				properties: { id: generateId() },
			});

			// Split run at text index + 1
			editor.apply({
				type: 'split_node',
				path: info.runPath,
				position: info.textIdx + 1,
				properties: { id: generateId() },
			});

			// Split paragraph at run index + 1
			editor.apply({
				type: 'split_node',
				path: info.paraPath,
				position: info.runIdx + 1,
				properties: { id: generateId() },
			});

			// Cursor moves to start of new paragraph's first text
			const newParaIdx = info.paraPath[info.paraPath.length - 1] + 1;
			const newParaPath = [...info.paraPath.slice(0, -1), newParaIdx];
			const newTextPath = [...newParaPath, 0, 0];

			editor.apply({
				type: 'set_selection',
				oldSelection: editor.getSelection(),
				newSelection: SelectionManager.collapse(newTextPath, 0),
			});
		});
	},
};

export const deleteBackwardCommand: JPCommand<void> = {
	id: 'text.deleteBackward',
	name: 'Delete Backward',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor) {
		const selection = editor.getSelection();
		if (!selection) return;

		editor.batch(() => {
			// If range selected, just delete the range
			if (!SelectionManager.isCollapsed(selection)) {
				const norm = SelectionManager.normalize(selection);
				deleteRange(editor, selection);
				editor.apply({
					type: 'set_selection',
					oldSelection: editor.getSelection(),
					newSelection: SelectionManager.collapse(norm.anchor.path, norm.anchor.offset),
				});
				return;
			}

			const info = getTextInfo(editor.getDocument(), selection.anchor);
			if (!info) return;

			if (info.offset > 0) {
				// Delete one character before cursor
				editor.apply({
					type: 'delete_text',
					path: info.textPath,
					offset: info.offset - 1,
					text: info.node.text[info.offset - 1],
				});
				editor.apply({
					type: 'set_selection',
					oldSelection: editor.getSelection(),
					newSelection: SelectionManager.collapse(info.textPath, info.offset - 1),
				});
			} else {
				// At start of text node — check for previous text
				const texts = collectTexts(editor.getDocument());
				const idx = findTextIndex(texts, info.textPath);
				if (idx <= 0) return; // At start of document

				const prevText = texts[idx - 1];
				const prevRunPath = parentPath(prevText.path);
				const prevParaPath = parentPath(prevRunPath);

				if (pathEquals(prevParaPath, info.paraPath)) {
					// Same paragraph: delete last char of previous text
					if (prevText.node.text.length > 0) {
						const lastOffset = prevText.node.text.length - 1;
						editor.apply({
							type: 'delete_text',
							path: prevText.path,
							offset: lastOffset,
							text: prevText.node.text[lastOffset],
						});
						editor.apply({
							type: 'set_selection',
							oldSelection: editor.getSelection(),
							newSelection: SelectionManager.collapse(prevText.path, lastOffset),
						});
					}
				} else {
					// Different paragraph: merge current into previous
					const prevPara = getNodeAtPath(editor.getDocument(), prevParaPath);
					if (isElement(prevPara)) {
						// Cursor will be at the end of the previous paragraph's content
						const cursorPath = prevText.path;
						const cursorOffset = prevText.node.text.length;

						editor.apply({
							type: 'merge_node',
							path: info.paraPath,
							position: prevPara.children.length,
							properties: {},
						});

						editor.apply({
							type: 'set_selection',
							oldSelection: editor.getSelection(),
							newSelection: SelectionManager.collapse(cursorPath, cursorOffset),
						});
					}
				}
			}
		});
	},
};

export const deleteForwardCommand: JPCommand<void> = {
	id: 'text.deleteForward',
	name: 'Delete Forward',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor) {
		const selection = editor.getSelection();
		if (!selection) return;

		editor.batch(() => {
			// If range selected, just delete the range
			if (!SelectionManager.isCollapsed(selection)) {
				const norm = SelectionManager.normalize(selection);
				deleteRange(editor, selection);
				editor.apply({
					type: 'set_selection',
					oldSelection: editor.getSelection(),
					newSelection: SelectionManager.collapse(norm.anchor.path, norm.anchor.offset),
				});
				return;
			}

			const info = getTextInfo(editor.getDocument(), selection.anchor);
			if (!info) return;

			if (info.offset < info.node.text.length) {
				// Delete character at cursor
				editor.apply({
					type: 'delete_text',
					path: info.textPath,
					offset: info.offset,
					text: info.node.text[info.offset],
				});
				// Cursor stays in place
			} else {
				// At end of text node — check for next text
				const texts = collectTexts(editor.getDocument());
				const idx = findTextIndex(texts, info.textPath);
				if (idx === -1 || idx >= texts.length - 1) return; // At end of document

				const nextText = texts[idx + 1];
				const nextRunPath = parentPath(nextText.path);
				const nextParaPath = parentPath(nextRunPath);

				if (pathEquals(nextParaPath, info.paraPath)) {
					// Same paragraph: delete first char of next text
					if (nextText.node.text.length > 0) {
						editor.apply({
							type: 'delete_text',
							path: nextText.path,
							offset: 0,
							text: nextText.node.text[0],
						});
					}
					// Cursor stays in place
				} else {
					// Different paragraph: merge next paragraph into current
					const currentPara = getNodeAtPath(editor.getDocument(), info.paraPath);
					if (isElement(currentPara)) {
						editor.apply({
							type: 'merge_node',
							path: nextParaPath,
							position: currentPara.children.length,
							properties: {},
						});
					}
					// Cursor stays in place
				}
			}
		});
	},
};

export const deleteSelectionCommand: JPCommand<void> = {
	id: 'text.deleteSelection',
	name: 'Delete Selection',

	canExecute(editor) {
		if (editor.isReadOnly()) return false;
		const sel = editor.getSelection();
		return sel !== null && !SelectionManager.isCollapsed(sel);
	},

	execute(editor) {
		const selection = editor.getSelection();
		if (!selection || SelectionManager.isCollapsed(selection)) return;

		editor.batch(() => {
			const norm = SelectionManager.normalize(selection);
			deleteRange(editor, selection);
			editor.apply({
				type: 'set_selection',
				oldSelection: editor.getSelection(),
				newSelection: SelectionManager.collapse(norm.anchor.path, norm.anchor.offset),
			});
		});
	},
};

export const insertLineBreakCommand: JPCommand<void> = {
	id: 'text.insertLineBreak',
	name: 'Insert Line Break',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor) {
		// Insert a newline character (soft line break)
		editor.executeCommand('text.insert', { text: '\n' });
	},
};

export const insertTabCommand: JPCommand<void> = {
	id: 'text.insertTab',
	name: 'Insert Tab',

	canExecute(editor) {
		return !editor.isReadOnly() && editor.getSelection() !== null;
	},

	execute(editor) {
		editor.executeCommand('text.insert', { text: '\t' });
	},
};

export const TEXT_COMMANDS = [
	insertTextCommand,
	insertParagraphCommand,
	deleteBackwardCommand,
	deleteForwardCommand,
	deleteSelectionCommand,
	insertLineBreakCommand,
	insertTabCommand,
] as const;
