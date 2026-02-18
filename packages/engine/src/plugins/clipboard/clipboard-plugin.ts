import type { JPPath } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps } from '../text/text-utils';

export interface PasteArgs {
	text?: string;
	html?: string;
}

/**
 * ClipboardPlugin handles copy, cut, and paste operations.
 * For now, it works with plain text. HTML/rich paste can be extended later.
 */
export class ClipboardPlugin implements JPPlugin {
	readonly id = 'jpoffice.clipboard';
	readonly name = 'Clipboard';

	initialize(editor: JPEditor): void {
		editor.registerCommand({
			id: 'clipboard.copy',
			name: 'Copy',
			canExecute: () => {
				const sel = editor.getSelection();
				return sel !== null && !SelectionManager.isCollapsed(sel);
			},
			execute: () => this.copy(editor),
		});

		editor.registerCommand({
			id: 'clipboard.cut',
			name: 'Cut',
			canExecute: () => {
				const sel = editor.getSelection();
				return !editor.isReadOnly() && sel !== null && !SelectionManager.isCollapsed(sel);
			},
			execute: () => this.cut(editor),
		});

		editor.registerCommand<PasteArgs>({
			id: 'clipboard.paste',
			name: 'Paste',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.paste(editor, args),
		});
	}

	private copy(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel || SelectionManager.isCollapsed(sel)) return;

		const text = editor.getSelectedText();
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(text).catch(() => {});
		}
	}

	private cut(editor: JPEditor): void {
		this.copy(editor);

		const sel = editor.getSelection();
		if (!sel || SelectionManager.isCollapsed(sel)) return;

		editor.batch(() => {
			const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
			for (const op of ops) editor.apply(op);
			editor.setSelection({ anchor: collapsedPoint, focus: collapsedPoint });
		});
	}

	private paste(editor: JPEditor, args: PasteArgs): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const text = args.text ?? '';
		if (!text) return;

		editor.batch(() => {
			let currentSel = sel;

			// Delete selection if range
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			const lines = text.split('\n');

			if (lines.length === 1) {
				// Single line — simple text insert
				const point = currentSel.anchor;
				editor.apply({
					type: 'insert_text',
					path: point.path,
					offset: point.offset,
					text: lines[0],
				});
				const newPoint = {
					path: point.path,
					offset: point.offset + lines[0].length,
				};
				editor.setSelection({ anchor: newPoint, focus: newPoint });
				return;
			}

			// Multi-line paste: insert first line as text, then split paragraph for each subsequent line
			const point = currentSel.anchor;

			// Insert first line text
			if (lines[0].length > 0) {
				editor.apply({
					type: 'insert_text',
					path: point.path,
					offset: point.offset,
					text: lines[0],
				});
			}

			// For each subsequent line, we split and insert
			let currentOffset = point.offset + lines[0].length;
			let currentTextPath = point.path;

			for (let i = 1; i < lines.length; i++) {
				// Split at current position to create a new paragraph
				editor.apply({
					type: 'split_node',
					path: currentTextPath,
					position: currentOffset,
					properties: {},
				});

				const textIdx = currentTextPath[currentTextPath.length - 1];
				const runPath = currentTextPath.slice(0, -1);
				editor.apply({
					type: 'split_node',
					path: runPath,
					position: textIdx + 1,
					properties: {},
				});

				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				editor.apply({
					type: 'split_node',
					path: paraPath,
					position: runIdx + 1,
					properties: {},
				});

				// New paragraph's first text is at [paraPath[:-1], paraIdx+1, 0, 0]
				const paraIdx = paraPath[paraPath.length - 1];
				const sectionPath = paraPath.slice(0, -1);
				const newParaPath: JPPath = [...sectionPath, paraIdx + 1];
				const newTextPath: JPPath = [...newParaPath, 0, 0];

				// Insert text for this line
				if (lines[i].length > 0) {
					editor.apply({
						type: 'insert_text',
						path: newTextPath,
						offset: 0,
						text: lines[i],
					});
				}

				currentTextPath = newTextPath;
				currentOffset = lines[i].length;
			}

			const newPoint = { path: currentTextPath, offset: currentOffset };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		});
	}
}
