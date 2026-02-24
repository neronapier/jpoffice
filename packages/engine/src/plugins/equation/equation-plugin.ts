import type { JPEquation, JPNode, JPPath } from '@jpoffice/model';
import {
	createEquation,
	createParagraph,
	createRun,
	createText,
	generateId,
	getNodeAtPath,
	isEquation,
} from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

/**
 * Arguments for inserting an equation.
 */
export interface InsertEquationArgs {
	readonly latex: string;
	readonly display?: 'inline' | 'block';
}

/**
 * Arguments for editing an existing equation.
 */
export interface EditEquationArgs {
	readonly path: JPPath;
	readonly latex: string;
}

/**
 * Arguments for deleting an equation.
 */
export interface DeleteEquationArgs {
	readonly path: JPPath;
}

/**
 * Arguments for changing an equation's display mode.
 */
export interface SetEquationDisplayArgs {
	readonly path: JPPath;
	readonly display: 'inline' | 'block';
}

/**
 * EquationPlugin registers commands for inserting, editing, deleting,
 * and toggling display mode of mathematical equations (LaTeX-based).
 *
 * Equations are leaf nodes placed inline inside paragraphs alongside runs,
 * similar to fields. Block-mode equations are inserted into their own paragraph.
 */
export class EquationPlugin implements JPPlugin {
	readonly id = 'jpoffice.equation';
	readonly name = 'Equation';

	/**
	 * Callback invoked when the user double-clicks an equation or requests to edit one.
	 * The React layer should set this to show an equation editor dialog.
	 */
	onEquationEdit?: (equation: JPEquation, path: JPPath) => void;

	initialize(editor: JPEditor): void {
		// Insert equation at cursor
		editor.registerCommand<InsertEquationArgs>({
			id: 'equation.insert',
			name: 'Insert Equation',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertEquation(editor, args),
		});

		// Edit an existing equation's LaTeX
		editor.registerCommand<EditEquationArgs>({
			id: 'equation.edit',
			name: 'Edit Equation',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.editEquation(editor, args),
		});

		// Delete an equation
		editor.registerCommand<DeleteEquationArgs>({
			id: 'equation.delete',
			name: 'Delete Equation',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.deleteEquation(editor, args),
		});

		// Toggle display mode (inline/block)
		editor.registerCommand<SetEquationDisplayArgs>({
			id: 'equation.setDisplay',
			name: 'Set Equation Display',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.setDisplay(editor, args),
		});
	}

	/**
	 * Find the equation node at the current cursor position, if any.
	 * Checks the node at the cursor's run-level path (parent of text path).
	 * Returns the equation and its path, or null if cursor is not on an equation.
	 */
	getEquationAtCursor(editor: JPEditor): { equation: JPEquation; path: JPPath } | null {
		const sel = editor.getSelection();
		if (!sel) return null;

		const doc = editor.getDocument();
		const cursorPath = sel.anchor.path;

		// Try the node at the cursor path directly
		try {
			const node = getNodeAtPath(doc, cursorPath);
			if (isEquation(node)) {
				return { equation: node, path: cursorPath };
			}
		} catch {
			// path invalid
		}

		// Try one level up (in case cursor is at text level inside a run next to an equation)
		if (cursorPath.length >= 2) {
			const parentPath = cursorPath.slice(0, -1);
			try {
				const parentNode = getNodeAtPath(doc, parentPath);
				if (isEquation(parentNode)) {
					return { equation: parentNode, path: parentPath };
				}
			} catch {
				// path invalid
			}

			// Check siblings at the paragraph level for adjacent equations
			const paraPath = parentPath.slice(0, -1);
			const runIndex = parentPath[parentPath.length - 1];
			try {
				const para = getNodeAtPath(doc, paraPath);
				if ('children' in para) {
					const children = (para as { children: readonly JPNode[] }).children;
					// Check the node right before current run
					if (runIndex > 0) {
						const prev = children[runIndex - 1];
						if (isEquation(prev) && sel.anchor.offset === 0) {
							return { equation: prev, path: [...paraPath, runIndex - 1] };
						}
					}
				}
			} catch {
				// path invalid
			}
		}

		return null;
	}

	/**
	 * Insert an equation at the current cursor position.
	 * If display is 'block', creates a new paragraph containing only the equation.
	 * If display is 'inline' (default), inserts the equation inline at the cursor.
	 */
	private insertEquation(editor: JPEditor, args: InsertEquationArgs): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const display = args.display ?? 'inline';
		const equation = createEquation(args.latex, display);

		if (display === 'block') {
			this.insertBlockEquation(editor, equation);
		} else {
			this.insertInlineEquation(editor, equation);
		}
	}

	/**
	 * Insert a block equation as a new paragraph after the current one.
	 */
	private insertBlockEquation(editor: JPEditor, equation: JPEquation): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		editor.batch(() => {
			// Create a new paragraph containing only the equation
			const equationPara = createParagraph(generateId(), [equation as unknown as JPEquation], {
				alignment: 'center',
			});

			// Insert the paragraph after the current one
			const paraPath = ctx.paragraphPath;
			const paraIndex = paraPath[paraPath.length - 1];
			const parentPath = paraPath.slice(0, -1);
			const insertPath: JPPath = [...parentPath, paraIndex + 1];

			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: equationPara,
			});

			// Add empty paragraph after for cursor placement
			const emptyPara = createParagraph(generateId(), [
				createRun(generateId(), [createText(generateId(), '')]),
			]);
			const afterPath: JPPath = [...parentPath, paraIndex + 2];
			editor.apply({
				type: 'insert_node',
				path: afterPath,
				node: emptyPara,
			});

			// Move cursor to the empty paragraph after the equation
			const cursorPath: JPPath = [...afterPath, 0, 0];
			editor.setSelection({
				anchor: { path: cursorPath, offset: 0 },
				focus: { path: cursorPath, offset: 0 },
			});
		});
	}

	/**
	 * Insert an inline equation at the cursor position, splitting text/run as needed.
	 * Follows the same pattern as FieldPlugin.insertField.
	 */
	private insertInlineEquation(editor: JPEditor, equation: JPEquation): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		editor.batch(() => {
			const textPath = ctx.textPath;
			const offset = ctx.offset;
			const textNode = ctx.textNode;

			if (offset > 0 && offset < textNode.text.length) {
				// Mid-text: split text node, then split run, then insert equation between the two runs
				editor.apply({
					type: 'split_node',
					path: textPath,
					position: offset,
					properties: {},
				});
				// Split run at the new text boundary
				const runPath = textPath.slice(0, -1);
				const textIdx = textPath[textPath.length - 1];
				editor.apply({
					type: 'split_node',
					path: runPath,
					position: textIdx + 1,
					properties: {},
				});
				// Insert equation between the two runs
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: equation,
				});
				// Move cursor to start of the second (shifted) run's text
				const afterEquationPath: JPPath = [...paraPath, runIdx + 2, 0];
				editor.setSelection({
					anchor: { path: afterEquationPath, offset: 0 },
					focus: { path: afterEquationPath, offset: 0 },
				});
			} else if (offset === 0) {
				// At start of text: insert equation before current run
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: equation,
				});
				// Cursor stays at same logical position but path shifts
				const newTextPath: JPPath = [...paraPath, runIdx + 1, 0];
				editor.setSelection({
					anchor: { path: newTextPath, offset: 0 },
					focus: { path: newTextPath, offset: 0 },
				});
			} else {
				// At end of text: insert equation after current run
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: equation,
				});
				// Add empty run after equation for cursor placement
				const emptyRun = createRun(generateId(), [createText(generateId(), '')]);
				const afterEquationPath: JPPath = [...paraPath, runIdx + 2];
				editor.apply({
					type: 'insert_node',
					path: afterEquationPath,
					node: emptyRun,
				});
				editor.setSelection({
					anchor: { path: [...afterEquationPath, 0], offset: 0 },
					focus: { path: [...afterEquationPath, 0], offset: 0 },
				});
			}
		});
	}

	/**
	 * Update the LaTeX source of an existing equation.
	 */
	private editEquation(editor: JPEditor, args: EditEquationArgs): void {
		const doc = editor.getDocument();
		const node = getNodeAtPath(doc, args.path);
		if (!isEquation(node)) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { latex: args.latex, cachedSvg: undefined },
			oldProperties: { latex: node.latex, cachedSvg: node.cachedSvg },
		});
	}

	/**
	 * Remove an equation node from the document.
	 */
	private deleteEquation(editor: JPEditor, args: DeleteEquationArgs): void {
		const doc = editor.getDocument();
		const node = getNodeAtPath(doc, args.path);
		if (!isEquation(node)) return;

		editor.apply({
			type: 'remove_node',
			path: args.path,
			node,
		});
	}

	/**
	 * Change the display mode of an equation (inline vs block).
	 */
	private setDisplay(editor: JPEditor, args: SetEquationDisplayArgs): void {
		const doc = editor.getDocument();
		const node = getNodeAtPath(doc, args.path);
		if (!isEquation(node)) return;

		if (node.display === args.display) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { display: args.display },
			oldProperties: { display: node.display },
		});
	}
}
