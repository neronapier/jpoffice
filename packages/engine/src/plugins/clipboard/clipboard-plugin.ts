import type { JPNode, JPParagraph, JPPath, JPRun, JPSelection } from '@jpoffice/model';
import { generateId, getNodeAtPath, isElement } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps, resolveSelectionContext } from '../text/text-utils';
import type { DocumentFragment } from './html-to-document';
import { parseHtmlToFragment } from './html-to-document';

export interface PasteArgs {
	text?: string;
	html?: string;
}

/**
 * ClipboardPlugin handles copy, cut, and paste operations.
 * Supports rich paste from HTML, image paste (via InputManager),
 * and plain text fallback.
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

		editor.registerCommand<PasteArgs>({
			id: 'clipboard.pasteUnformatted',
			name: 'Paste without formatting',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.paste(editor, { text: args.text }),
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

		editor.batch(() => {
			let currentSel = sel;

			// Delete selection if range
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			// Try HTML paste first
			if (args.html) {
				try {
					const fragment = parseHtmlToFragment(args.html);
					if (fragment.paragraphs.length > 0) {
						this.insertFragment(editor, currentSel, fragment);
						return;
					}
				} catch {
					// Fall through to plain text
				}
			}

			// Plain text paste
			const text = args.text ?? '';
			if (!text) return;
			this.pastePlainText(editor, currentSel, text);
		});
	}

	// ── Fragment insertion (HTML paste) ──────────────────────────────

	private insertFragment(editor: JPEditor, sel: JPSelection, fragment: DocumentFragment): void {
		if (!sel) return;
		const point = sel.anchor;
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);
		const blocks = fragment.paragraphs;

		if (blocks.length === 0) return;

		// Special case: single paragraph with only runs (no tables)
		// -> inline paste into current paragraph
		if (blocks.length === 1 && blocks[0].type === 'paragraph') {
			this.insertInlineParagraph(editor, sel, blocks[0] as JPParagraph);
			return;
		}

		// Multi-block paste: split current paragraph, then insert blocks between

		// 1. Split the current paragraph at cursor
		this.splitAtCursor(editor, ctx);

		// 2. Insert blocks between the two halves
		// After splitting, we have:
		//   - original paragraph at ctx.paragraphPath (content before cursor)
		//   - new paragraph at ctx.paragraphPath[:-1] ++ [paraIdx + 1] (content after cursor)
		const sectionPath = ctx.paragraphPath.slice(0, -1);
		const paraIdx = ctx.paragraphPath[ctx.paragraphPath.length - 1];

		// The first block's runs merge into the end of the "before" paragraph
		const firstBlock = blocks[0];
		let lastInsertedParaIdx = paraIdx;

		if (firstBlock.type === 'paragraph') {
			const firstPara = firstBlock as JPParagraph;
			// Append first block's runs to the before-paragraph
			for (let r = 0; r < firstPara.children.length; r++) {
				const child = firstPara.children[r];
				const updatedDoc = editor.getDocument();
				const beforePara = getNodeAtPath(updatedDoc, ctx.paragraphPath);
				const insertIdx = isElement(beforePara) ? beforePara.children.length : 0;
				const insertPath: JPPath = [...ctx.paragraphPath, insertIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: cloneWithNewIds(child as unknown as JPNode),
				});
			}
		} else {
			// First block is a table -- insert it after the before-paragraph
			lastInsertedParaIdx++;
			const insertPath: JPPath = [...sectionPath, lastInsertedParaIdx];
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: cloneWithNewIds(firstBlock as unknown as JPNode),
			});
		}

		// Insert middle blocks
		for (let b = 1; b < blocks.length - 1; b++) {
			lastInsertedParaIdx++;
			const insertPath: JPPath = [...sectionPath, lastInsertedParaIdx];
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: cloneWithNewIds(blocks[b] as unknown as JPNode),
			});
		}

		// Handle last block
		if (blocks.length > 1) {
			const lastBlock = blocks[blocks.length - 1];

			if (lastBlock.type === 'paragraph') {
				const lastPara = lastBlock as JPParagraph;
				// The "after" paragraph is now at lastInsertedParaIdx + 1
				const afterParaIdx = lastInsertedParaIdx + 1;
				const afterParaPath: JPPath = [...sectionPath, afterParaIdx];

				// Prepend last block's runs into the after-paragraph
				for (let r = lastPara.children.length - 1; r >= 0; r--) {
					const child = lastPara.children[r];
					const insertPath: JPPath = [...afterParaPath, 0];
					editor.apply({
						type: 'insert_node',
						path: insertPath,
						node: cloneWithNewIds(child as unknown as JPNode),
					});
				}

				// Place cursor after the last inserted run's text
				const cursorRunIdx = lastPara.children.length - 1;
				const lastRun = lastPara.children[cursorRunIdx];
				const lastRunTextLen =
					lastRun.type === 'run'
						? (lastRun as JPRun).children.reduce((acc, t) => acc + t.text.length, 0)
						: 0;

				// Cursor at the end of the last inserted run's text node
				const cursorTextPath: JPPath = [...afterParaPath, cursorRunIdx, 0];
				const newPoint = { path: cursorTextPath, offset: lastRunTextLen };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			} else {
				// Last block is a table -- insert before the after-paragraph
				lastInsertedParaIdx++;
				const insertPath: JPPath = [...sectionPath, lastInsertedParaIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: cloneWithNewIds(lastBlock as unknown as JPNode),
				});

				// Cursor at start of after-paragraph
				const afterParaIdx = lastInsertedParaIdx + 1;
				const cursorTextPath: JPPath = [...sectionPath, afterParaIdx, 0, 0];
				const newPoint = { path: cursorTextPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			}
		} else {
			// Single block already merged -- put cursor at end of inserted content
			const updatedDoc = editor.getDocument();
			const beforePara = getNodeAtPath(updatedDoc, ctx.paragraphPath);
			if (isElement(beforePara)) {
				const lastChildIdx = beforePara.children.length - 1;
				const lastChild = beforePara.children[lastChildIdx];
				if (lastChild.type === 'run') {
					const run = lastChild as JPRun;
					const textLen = run.children.reduce((acc, t) => acc + t.text.length, 0);
					const cursorPath: JPPath = [...ctx.paragraphPath, lastChildIdx, 0];
					const newPoint = { path: cursorPath, offset: textLen };
					editor.setSelection({ anchor: newPoint, focus: newPoint });
				}
			}
		}
	}

	/**
	 * Insert a single paragraph's runs inline at the cursor position.
	 * This avoids splitting and keeps it in the current paragraph.
	 */
	private insertInlineParagraph(editor: JPEditor, sel: JPSelection, para: JPParagraph): void {
		if (!sel) return;
		const point = sel.anchor;
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		// If cursor is mid-text, split first
		if (ctx.offset > 0 && ctx.offset < ctx.textNode.text.length) {
			// Split text node
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

			// Insert the fragment runs between the two halves
			const insertIdx = ctx.runIndex + 1;
			let totalInserted = 0;
			for (let r = 0; r < para.children.length; r++) {
				const child = para.children[r];
				const insertPath: JPPath = [...ctx.paragraphPath, insertIdx + r];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: cloneWithNewIds(child as unknown as JPNode),
				});
				totalInserted++;
			}

			// Cursor at end of last inserted run
			if (totalInserted > 0) {
				const lastInsertedRunIdx = insertIdx + totalInserted - 1;
				const lastRun = para.children[para.children.length - 1];
				const textLen =
					lastRun.type === 'run'
						? (lastRun as JPRun).children.reduce((acc, t) => acc + t.text.length, 0)
						: 0;
				const cursorPath: JPPath = [...ctx.paragraphPath, lastInsertedRunIdx, 0];
				const newPoint = { path: cursorPath, offset: textLen };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			}
		} else if (ctx.offset === 0) {
			// At start of text -- insert runs before current run
			for (let r = 0; r < para.children.length; r++) {
				const child = para.children[r];
				const insertPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + r];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: cloneWithNewIds(child as unknown as JPNode),
				});
			}

			const lastRunIdx = ctx.runIndex + para.children.length - 1;
			const lastRun = para.children[para.children.length - 1];
			const textLen =
				lastRun.type === 'run'
					? (lastRun as JPRun).children.reduce((acc, t) => acc + t.text.length, 0)
					: 0;
			const cursorPath: JPPath = [...ctx.paragraphPath, lastRunIdx, 0];
			const newPoint = { path: cursorPath, offset: textLen };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		} else {
			// At end of text -- insert runs after current run
			const insertIdx = ctx.runIndex + 1;
			for (let r = 0; r < para.children.length; r++) {
				const child = para.children[r];
				const insertPath: JPPath = [...ctx.paragraphPath, insertIdx + r];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: cloneWithNewIds(child as unknown as JPNode),
				});
			}

			const lastRunIdx = insertIdx + para.children.length - 1;
			const lastRun = para.children[para.children.length - 1];
			const textLen =
				lastRun.type === 'run'
					? (lastRun as JPRun).children.reduce((acc, t) => acc + t.text.length, 0)
					: 0;
			const cursorPath: JPPath = [...ctx.paragraphPath, lastRunIdx, 0];
			const newPoint = { path: cursorPath, offset: textLen };
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		}
	}

	/**
	 * Split the current paragraph at the cursor position.
	 */
	private splitAtCursor(editor: JPEditor, ctx: ReturnType<typeof resolveSelectionContext>): void {
		// Split text node at offset
		editor.apply({
			type: 'split_node',
			path: ctx.textPath,
			position: ctx.offset,
			properties: {},
		});

		// Split run at the new text boundary
		const textIdx = ctx.textPath[ctx.textPath.length - 1];
		editor.apply({
			type: 'split_node',
			path: ctx.runPath,
			position: textIdx + 1,
			properties: {},
		});

		// Split paragraph at the new run boundary
		const runIdx = ctx.runPath[ctx.runPath.length - 1];
		editor.apply({
			type: 'split_node',
			path: ctx.paragraphPath,
			position: runIdx + 1,
			properties: {},
		});
	}

	// ── Plain text paste (existing logic) ───────────────────────────

	private pastePlainText(editor: JPEditor, sel: JPSelection, text: string): void {
		if (!sel) return;
		const lines = text.split('\n');

		if (lines.length === 1) {
			// Single line -- simple text insert
			const point = sel.anchor;
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
		const point = sel.anchor;

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
	}
}

// ── Utility: deep-clone a node tree with fresh IDs ──────────────────

function cloneWithNewIds(node: JPNode): JPNode {
	if (isElement(node)) {
		const newChildren = node.children.map((child) => cloneWithNewIds(child));
		return { ...node, id: generateId(), children: newChildren } as unknown as JPNode;
	}
	// Leaf node (e.g. JPText)
	return { ...node, id: generateId() } as unknown as JPNode;
}
