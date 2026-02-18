import type { JPRunProperties } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { getRunsInRange, resolveSelectionContext } from '../text/text-utils';

/**
 * FormattingPlugin handles inline text formatting:
 * bold, italic, underline, strikethrough, font, color, etc.
 */
export class FormattingPlugin implements JPPlugin {
	readonly id = 'jpoffice.formatting';
	readonly name = 'Formatting';

	/** Pending marks to apply on next text insertion (for collapsed cursor) */
	private pendingMarks: Partial<JPRunProperties> | null = null;

	initialize(editor: JPEditor): void {
		editor.registerCommand({
			id: 'format.bold',
			name: 'Bold',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleFormat(editor, 'bold'),
		});

		editor.registerCommand({
			id: 'format.italic',
			name: 'Italic',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleFormat(editor, 'italic'),
		});

		editor.registerCommand({
			id: 'format.underline',
			name: 'Underline',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleUnderline(editor),
		});

		editor.registerCommand({
			id: 'format.strikethrough',
			name: 'Strikethrough',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleFormat(editor, 'strikethrough'),
		});

		editor.registerCommand({
			id: 'format.superscript',
			name: 'Superscript',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleSuperSub(editor, 'superscript'),
		});

		editor.registerCommand({
			id: 'format.subscript',
			name: 'Subscript',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleSuperSub(editor, 'subscript'),
		});

		editor.registerCommand<{ size: number }>({
			id: 'format.fontSize',
			name: 'Font Size',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setFormat(editor, { fontSize: args.size }),
		});

		editor.registerCommand<{ family: string }>({
			id: 'format.fontFamily',
			name: 'Font Family',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setFormat(editor, { fontFamily: args.family }),
		});

		editor.registerCommand<{ color: string }>({
			id: 'format.color',
			name: 'Font Color',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setFormat(editor, { color: args.color }),
		});

		editor.registerCommand<{ color: string }>({
			id: 'format.highlight',
			name: 'Highlight',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setFormat(editor, { highlight: args.color }),
		});

		editor.registerCommand({
			id: 'format.clearFormatting',
			name: 'Clear Formatting',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.clearFormatting(editor),
		});
	}

	getPendingMarks(): Partial<JPRunProperties> | null {
		return this.pendingMarks;
	}

	clearPendingMarks(): void {
		this.pendingMarks = null;
	}

	private toggleFormat(editor: JPEditor, prop: 'bold' | 'italic' | 'strikethrough'): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			const current = this.getCurrentFormat(editor, prop);
			this.pendingMarks = {
				...this.pendingMarks,
				[prop]: !current,
			};
			return;
		}

		const doc = editor.getDocument();
		const runs = getRunsInRange(doc, sel);
		const allHave = runs.every((r) => r.node.properties[prop] === true);

		editor.batch(() => {
			for (const run of runs) {
				editor.apply({
					type: 'set_properties',
					path: run.path,
					properties: { [prop]: !allHave },
					oldProperties: { [prop]: run.node.properties[prop] },
				});
			}
		});
	}

	private toggleUnderline(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			const ctx = resolveSelectionContext(editor.getDocument(), sel.anchor);
			const current = ctx.run.properties.underline;
			this.pendingMarks = {
				...this.pendingMarks,
				underline: current === 'single' ? 'none' : 'single',
			};
			return;
		}

		const doc = editor.getDocument();
		const runs = getRunsInRange(doc, sel);
		const allUnderlined = runs.every((r) => r.node.properties.underline === 'single');
		const newValue = allUnderlined ? 'none' : 'single';

		editor.batch(() => {
			for (const run of runs) {
				editor.apply({
					type: 'set_properties',
					path: run.path,
					properties: { underline: newValue },
					oldProperties: { underline: run.node.properties.underline },
				});
			}
		});
	}

	private toggleSuperSub(editor: JPEditor, prop: 'superscript' | 'subscript'): void {
		const opposite = prop === 'superscript' ? 'subscript' : 'superscript';
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			const current = this.getCurrentFormat(editor, prop);
			this.pendingMarks = {
				...this.pendingMarks,
				[prop]: !current,
				[opposite]: false,
			};
			return;
		}

		const doc = editor.getDocument();
		const runs = getRunsInRange(doc, sel);
		const allHave = runs.every((r) => r.node.properties[prop] === true);

		editor.batch(() => {
			for (const run of runs) {
				editor.apply({
					type: 'set_properties',
					path: run.path,
					properties: { [prop]: !allHave, [opposite]: false },
					oldProperties: {
						[prop]: run.node.properties[prop],
						[opposite]: run.node.properties[opposite],
					},
				});
			}
		});
	}

	private setFormat(editor: JPEditor, props: Partial<JPRunProperties>): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			this.pendingMarks = { ...this.pendingMarks, ...props };
			return;
		}

		const doc = editor.getDocument();
		const runs = getRunsInRange(doc, sel);

		editor.batch(() => {
			for (const run of runs) {
				const oldProps: Record<string, unknown> = {};
				for (const key of Object.keys(props)) {
					oldProps[key] = (run.node.properties as Record<string, unknown>)[key];
				}
				editor.apply({
					type: 'set_properties',
					path: run.path,
					properties: props as Record<string, unknown>,
					oldProperties: oldProps,
				});
			}
		});
	}

	private clearFormatting(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			this.pendingMarks = {};
			return;
		}

		const doc = editor.getDocument();
		const runs = getRunsInRange(doc, sel);

		editor.batch(() => {
			for (const run of runs) {
				// Set all existing properties to null to remove them
				const nullProps: Record<string, unknown> = {};
				for (const key of Object.keys(run.node.properties)) {
					nullProps[key] = null;
				}
				editor.apply({
					type: 'set_properties',
					path: run.path,
					properties: nullProps,
					oldProperties: run.node.properties as Record<string, unknown>,
				});
			}
		});
	}

	private getCurrentFormat(editor: JPEditor, prop: keyof JPRunProperties): unknown {
		const sel = editor.getSelection();
		if (!sel) return false;

		if (this.pendingMarks && prop in this.pendingMarks) {
			return this.pendingMarks[prop];
		}

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);
		return ctx.run.properties[prop];
	}
}
