import type { JPPath } from '@jpoffice/model';
import { createHyperlink, createRun, createText, generateId } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps, resolveSelectionContext } from '../text/text-utils';

export interface InsertLinkArgs {
	href: string;
	text?: string;
}

/**
 * LinkPlugin handles hyperlink insertion and removal.
 */
export class LinkPlugin implements JPPlugin {
	readonly id = 'jpoffice.link';
	readonly name = 'Link';

	/** Callback set by React layer to open the link dialog */
	onShowDialog?: () => void;

	initialize(editor: JPEditor): void {
		editor.registerCommand<InsertLinkArgs>({
			id: 'link.insert',
			name: 'Insert Link',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertLink(editor, args),
		});

		editor.registerCommand({
			id: 'link.remove',
			name: 'Remove Link',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.removeLink(editor),
		});

		editor.registerCommand({
			id: 'link.showDialog',
			name: 'Show Link Dialog',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => {
				this.onShowDialog?.();
			},
		});
	}

	private insertLink(editor: JPEditor, args: InsertLinkArgs): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			if (SelectionManager.isCollapsed(sel)) {
				// Collapsed cursor: insert new hyperlink with provided or default text
				const linkText = args.text || args.href;
				const doc = editor.getDocument();
				const ctx = resolveSelectionContext(doc, sel.anchor);

				const textNode = createText(generateId(), linkText);
				const run = createRun(generateId(), [textNode]);
				const hyperlink = createHyperlink(generateId(), [run], args.href);

				if (ctx.offset > 0 && ctx.offset < ctx.textNode.text.length) {
					// Mid-text: split text, then split run, insert hyperlink between
					editor.apply({
						type: 'split_node',
						path: ctx.textPath,
						position: ctx.offset,
						properties: { id: generateId() },
					});
					editor.apply({
						type: 'split_node',
						path: ctx.runPath,
						position: ctx.textPath[ctx.textPath.length - 1] + 1,
						properties: { id: generateId() },
					});
					const insertPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + 1];
					editor.apply({
						type: 'insert_node',
						path: insertPath,
						node: hyperlink,
					});
				} else {
					// At start or end of text
					const insertIdx = ctx.offset === 0 ? ctx.runIndex : ctx.runIndex + 1;
					const insertPath: JPPath = [...ctx.paragraphPath, insertIdx];
					editor.apply({
						type: 'insert_node',
						path: insertPath,
						node: hyperlink,
					});
				}

				// Place cursor after the hyperlink
				const emptyRun = createRun(generateId(), [createText(generateId(), '')]);
				const hyperlinkInsertIdx = ctx.offset === 0 ? ctx.runIndex + 1 : ctx.runIndex + 2;
				const emptyRunPath: JPPath = [...ctx.paragraphPath, hyperlinkInsertIdx];
				editor.apply({
					type: 'insert_node',
					path: emptyRunPath,
					node: emptyRun,
				});
				const cursorPath: JPPath = [...emptyRunPath, 0];
				const newPoint = { path: cursorPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			} else {
				// Range selection: delete selected text, insert hyperlink with that text
				const doc = editor.getDocument();
				const anchorCtx = resolveSelectionContext(doc, sel.anchor);

				const selectedText = editor.getSelectedText();
				const linkText = args.text || selectedText || args.href;

				// Delete the selection
				const { ops, collapsedPoint } = deleteSelectionOps(doc, sel);
				for (const op of ops) editor.apply(op);

				// Now insert the hyperlink at the collapsed point
				const insertCtx = resolveSelectionContext(editor.getDocument(), collapsedPoint);

				const textNode = createText(generateId(), linkText);
				const run = createRun(generateId(), [textNode], anchorCtx.run.properties);
				const hyperlink = createHyperlink(generateId(), [run], args.href);

				if (insertCtx.offset > 0 && insertCtx.offset < insertCtx.textNode.text.length) {
					editor.apply({
						type: 'split_node',
						path: insertCtx.textPath,
						position: insertCtx.offset,
						properties: { id: generateId() },
					});
					editor.apply({
						type: 'split_node',
						path: insertCtx.runPath,
						position: insertCtx.textPath[insertCtx.textPath.length - 1] + 1,
						properties: { id: generateId() },
					});
					const insertPath: JPPath = [...insertCtx.paragraphPath, insertCtx.runIndex + 1];
					editor.apply({
						type: 'insert_node',
						path: insertPath,
						node: hyperlink,
					});
				} else {
					const insertIdx = insertCtx.offset === 0 ? insertCtx.runIndex : insertCtx.runIndex + 1;
					const insertPath: JPPath = [...insertCtx.paragraphPath, insertIdx];
					editor.apply({
						type: 'insert_node',
						path: insertPath,
						node: hyperlink,
					});
				}

				// Insert empty run after for cursor
				const emptyRun = createRun(generateId(), [createText(generateId(), '')]);
				const afterIdx = insertCtx.offset === 0 ? insertCtx.runIndex + 1 : insertCtx.runIndex + 2;
				const emptyRunPath: JPPath = [...insertCtx.paragraphPath, afterIdx];
				editor.apply({
					type: 'insert_node',
					path: emptyRunPath,
					node: emptyRun,
				});
				const cursorPath: JPPath = [...emptyRunPath, 0];
				const newPoint = { path: cursorPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			}
		});
	}

	private removeLink(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		// Walk up from the run to find a hyperlink ancestor
		// In the paragraph's children, find if the current run is inside a hyperlink
		const paragraph = ctx.paragraph;
		let hyperlinkIndex = -1;

		for (let i = 0; i < paragraph.children.length; i++) {
			const child = paragraph.children[i];
			if (child.type === 'hyperlink') {
				// Check if any child run of this hyperlink matches our run path
				for (let j = 0; j < child.children.length; j++) {
					if (child.children[j].id === ctx.run.id) {
						hyperlinkIndex = i;
						break;
					}
				}
				if (hyperlinkIndex >= 0) break;
			}
		}

		if (hyperlinkIndex < 0) return; // Not inside a hyperlink

		const hyperlinkNode = paragraph.children[hyperlinkIndex];
		if (hyperlinkNode.type !== 'hyperlink') return;

		editor.batch(() => {
			// Remove the hyperlink node
			const hyperlinkPath: JPPath = [...ctx.paragraphPath, hyperlinkIndex];
			editor.apply({
				type: 'remove_node',
				path: hyperlinkPath,
				node: hyperlinkNode,
			});

			// Re-insert the hyperlink's child runs at the same position
			for (let i = 0; i < hyperlinkNode.children.length; i++) {
				const childRun = hyperlinkNode.children[i];
				const insertPath: JPPath = [...ctx.paragraphPath, hyperlinkIndex + i];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: childRun,
				});
			}
		});
	}
}
