import type { JPNode, JPPath } from '@jpoffice/model';
import {
	createParagraph,
	createRun,
	createText,
	generateId,
	getNodeAtPath,
	isElement,
	pathEquals,
} from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import {
	deleteSelectionOps,
	nextTextNode,
	previousTextNode,
	resolveSelectionContext,
} from './text-utils';

/**
 * TextPlugin handles all basic text editing: insert, delete, split paragraphs.
 */
export class TextPlugin implements JPPlugin {
	readonly id = 'jpoffice.text';
	readonly name = 'Text';

	initialize(editor: JPEditor): void {
		editor.registerCommand<{ text: string }>({
			id: 'text.insert',
			name: 'Insert Text',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertText(editor, args.text),
		});

		editor.registerCommand({
			id: 'text.deleteBackward',
			name: 'Delete Backward',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.deleteBackward(editor),
		});

		editor.registerCommand({
			id: 'text.deleteForward',
			name: 'Delete Forward',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.deleteForward(editor),
		});

		editor.registerCommand({
			id: 'text.insertParagraph',
			name: 'Insert Paragraph',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertParagraph(editor),
		});

		editor.registerCommand({
			id: 'text.insertLineBreak',
			name: 'Insert Line Break',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertLineBreak(editor),
		});

		editor.registerCommand({
			id: 'text.insertTab',
			name: 'Insert Tab',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertTab(editor),
		});

		editor.registerCommand({
			id: 'text.deleteSelection',
			name: 'Delete Selection',
			canExecute: () => {
				const sel = editor.getSelection();
				return !editor.isReadOnly() && sel !== null && !SelectionManager.isCollapsed(sel);
			},
			execute: () => this.deleteSelection(editor),
		});
	}

	private insertText(editor: JPEditor, text: string): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			let currentSel = sel;

			// Delete selection if range
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			const point = currentSel.anchor;
			editor.apply({
				type: 'insert_text',
				path: point.path,
				offset: point.offset,
				text,
			});

			const newPoint = { path: point.path, offset: point.offset + text.length };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		});
	}

	private deleteBackward(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			// If range selection, just delete it
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				editor.setSelection({ anchor: collapsedPoint, focus: collapsedPoint });
				return;
			}

			const doc = editor.getDocument();
			const ctx = resolveSelectionContext(doc, sel.anchor);

			// Case 1: Offset > 0 — delete char before cursor
			if (ctx.offset > 0) {
				const charToDelete = ctx.textNode.text[ctx.offset - 1];
				editor.apply({
					type: 'delete_text',
					path: ctx.textPath,
					offset: ctx.offset - 1,
					text: charToDelete,
				});
				const newPoint = { path: ctx.textPath, offset: ctx.offset - 1 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
				return;
			}

			// Case 2: At start of text but not first run — move to previous text
			const prev = previousTextNode(doc, ctx.textPath);

			if (prev) {
				// Check if previous text is in the same paragraph
				const prevRunPath = prev.path.slice(0, -1);
				const prevParagraphPath = prevRunPath.slice(0, -1);

				if (pathEquals(prevParagraphPath, ctx.paragraphPath)) {
					// Same paragraph — delete last char of previous text or merge
					if (prev.node.text.length > 0) {
						const lastChar = prev.node.text[prev.node.text.length - 1];
						editor.apply({
							type: 'delete_text',
							path: prev.path,
							offset: prev.node.text.length - 1,
							text: lastChar,
						});
						const newPoint = { path: prev.path, offset: prev.node.text.length - 1 };
						editor.setSelection({ anchor: newPoint, focus: newPoint });
					}
					return;
				}

				// Different paragraph — merge current paragraph with previous
				// merge_node merges current into previous sibling
				if (ctx.paragraphIndex > 0) {
					const prevParaPath = [...ctx.sectionPath, ctx.paragraphIndex - 1];
					const prevPara = getNodeAtPath(doc, prevParaPath);
					const mergePosition = isElement(prevPara) ? prevPara.children.length : 0;

					// Cursor goes to end of previous paragraph's last text
					const cursorPath = prev.path;
					const cursorOffset = prev.node.text.length;

					editor.apply({
						type: 'merge_node',
						path: ctx.paragraphPath,
						position: mergePosition,
						properties: {},
					});

					const newPoint = { path: cursorPath, offset: cursorOffset };
					editor.setSelection({ anchor: newPoint, focus: newPoint });
				}
			}
		});
	}

	private deleteForward(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				editor.setSelection({ anchor: collapsedPoint, focus: collapsedPoint });
				return;
			}

			const doc = editor.getDocument();
			const ctx = resolveSelectionContext(doc, sel.anchor);

			// Case 1: Not at end of text — delete char after cursor
			if (ctx.offset < ctx.textNode.text.length) {
				const charToDelete = ctx.textNode.text[ctx.offset];
				editor.apply({
					type: 'delete_text',
					path: ctx.textPath,
					offset: ctx.offset,
					text: charToDelete,
				});
				// Cursor stays at same position
				return;
			}

			// Case 2: At end of text — try next text node
			const next = nextTextNode(doc, ctx.textPath);
			if (!next) return; // End of document

			const nextRunPath = next.path.slice(0, -1);
			const nextParagraphPath = nextRunPath.slice(0, -1);

			if (pathEquals(nextParagraphPath, ctx.paragraphPath)) {
				// Same paragraph — delete first char of next text
				if (next.node.text.length > 0) {
					editor.apply({
						type: 'delete_text',
						path: next.path,
						offset: 0,
						text: next.node.text[0],
					});
				}
				return;
			}

			// Different paragraph — merge next paragraph into current
			const nextParaIdx = ctx.paragraphIndex + 1;
			const nextParaPath: JPPath = [...ctx.sectionPath, nextParaIdx];
			const mergePosition = ctx.paragraph.children.length;

			editor.apply({
				type: 'merge_node',
				path: nextParaPath,
				position: mergePosition,
				properties: {},
			});
			// Cursor stays at same position
		});
	}

	private insertParagraph(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			let currentSel = sel;

			// Delete selection if range
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			const doc = editor.getDocument();
			const ctx = resolveSelectionContext(doc, currentSel.anchor);

			// Edge case: cursor at very start of paragraph — insert empty paragraph before
			const isAtStart = ctx.offset === 0 && ctx.runIndex === 0;
			if (isAtStart) {
				const emptyPara = createParagraph(
					generateId(),
					[createRun(generateId(), [createText(generateId(), '')])],
					ctx.paragraph.properties,
				);
				editor.apply({
					type: 'insert_node',
					path: ctx.paragraphPath,
					node: emptyPara,
				});
				// Cursor stays at start of original paragraph (now shifted +1)
				const newParaPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex + 1];
				const newTextPath: JPPath = [...newParaPath, 0, 0];
				const newPoint = { path: newTextPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
				return;
			}

			// Edge case: cursor at very end of paragraph
			const lastRunIdx = ctx.paragraph.children.length - 1;
			const lastRun = ctx.paragraph.children[lastRunIdx];
			const isAtEnd =
				ctx.runIndex === lastRunIdx &&
				lastRun.type === 'run' &&
				ctx.offset === ctx.textNode.text.length;

			if (isAtEnd) {
				const emptyPara = createParagraph(
					generateId(),
					[createRun(generateId(), [createText(generateId(), '')])],
					ctx.paragraph.properties,
				);
				const insertPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: emptyPara,
				});
				const newTextPath: JPPath = [...insertPath, 0, 0];
				const newPoint = { path: newTextPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
				return;
			}

			// General case: split text → split run → split paragraph
			// 1. Split text node
			editor.apply({
				type: 'split_node',
				path: ctx.textPath,
				position: ctx.offset,
				properties: {},
			});

			// 2. Split run (at the new text node boundary)
			// After text split, the text at ctx.textPath is now [before, after]
			// The "after" text is at textIndex + 1 in the run
			const textIdx = ctx.textPath[ctx.textPath.length - 1];
			editor.apply({
				type: 'split_node',
				path: ctx.runPath,
				position: textIdx + 1,
				properties: {},
			});

			// 3. Split paragraph (at the new run boundary)
			const runIdx = ctx.runPath[ctx.runPath.length - 1];
			editor.apply({
				type: 'split_node',
				path: ctx.paragraphPath,
				position: runIdx + 1,
				properties: {},
			});

			// Move cursor to start of new paragraph's first text
			const newParaPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex + 1];
			const newTextPath: JPPath = [...newParaPath, 0, 0];
			const newPoint = { path: newTextPath, offset: 0 };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		});
	}

	private insertLineBreak(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			let currentSel = sel;

			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			const doc = editor.getDocument();
			const ctx = resolveSelectionContext(doc, currentSel.anchor);

			// Split text
			editor.apply({
				type: 'split_node',
				path: ctx.textPath,
				position: ctx.offset,
				properties: {},
			});

			// Split run
			const textIdx = ctx.textPath[ctx.textPath.length - 1];
			editor.apply({
				type: 'split_node',
				path: ctx.runPath,
				position: textIdx + 1,
				properties: {},
			});

			// Insert line break between the two runs
			const lineBreak: JPNode = { type: 'line-break', id: generateId() } as JPNode;
			const insertPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + 1];
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: lineBreak,
			});

			// Cursor goes to start of the second run (after the line break)
			const newRunPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + 2];
			const newTextPath: JPPath = [...newRunPath, 0];
			const newPoint = { path: newTextPath, offset: 0 };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		});
	}

	private insertTab(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		// Check if in a list — delegate to list.indent
		if (editor.canExecuteCommand('list.indent')) {
			editor.executeCommand('list.indent');
			return;
		}

		// Otherwise insert a tab character
		this.insertText(editor, '\t');
	}

	private deleteSelection(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel || SelectionManager.isCollapsed(sel)) return;

		editor.batch(() => {
			const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
			for (const op of ops) editor.apply(op);
			editor.setSelection({ anchor: collapsedPoint, focus: collapsedPoint });
		});
	}
}
