import type {
	JPAlignment,
	JPDocument,
	JPPath,
	JPRange,
	JPRun,
	JPRunProperties,
	JPText,
} from '@jpoffice/model';
import { generateId, getNodeAtPath, isElement, isText, pathEquals } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import {
	type SelectionContext,
	getParagraphsInRange,
	getRunsInRange,
	resolveRangeContext,
	resolveSelectionContext,
} from '../text/text-utils';

/**
 * FormattingPlugin handles inline text formatting:
 * bold, italic, underline, strikethrough, font, color, etc.
 */
export class FormattingPlugin implements JPPlugin {
	readonly id = 'jpoffice.formatting';
	readonly name = 'Formatting';

	/** Pending marks to apply on next text insertion (for collapsed cursor) */
	private pendingMarks: Partial<JPRunProperties> | null = null;

	/** Copied run format for paint format feature */
	private copiedFormat: Partial<JPRunProperties> | null = null;
	private paintFormatActive = false;

	/** Callback set by React layer to react to paint format state changes */
	onPaintFormatChange?: (active: boolean) => void;

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

		// Paragraph alignment commands
		editor.registerCommand<{ alignment: JPAlignment }>({
			id: 'format.align',
			name: 'Align',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setAlignment(editor, args.alignment),
		});

		// Line spacing
		editor.registerCommand<{ spacing: number }>({
			id: 'format.lineSpacing',
			name: 'Line Spacing',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) =>
				this.setParagraphProperty(editor, { spacing: { line: args.spacing, lineRule: 'auto' } }),
		});

		// Space before paragraph
		editor.registerCommand<{ space: number }>({
			id: 'format.spaceBefore',
			name: 'Space Before',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) =>
				this.setParagraphProperty(editor, { spacing: { before: args.space } }),
		});

		// Space after paragraph
		editor.registerCommand<{ space: number }>({
			id: 'format.spaceAfter',
			name: 'Space After',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setParagraphProperty(editor, { spacing: { after: args.space } }),
		});

		// Paragraph indentation
		editor.registerCommand<{ direction: 'increase' | 'decrease' }>({
			id: 'format.indent',
			name: 'Indent',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.changeIndent(editor, args.direction),
		});

		// Paint format: copy
		editor.registerCommand({
			id: 'format.copyFormat',
			name: 'Copy Format',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.copyFormat(editor),
		});

		// Paint format: paste
		editor.registerCommand({
			id: 'format.pasteFormat',
			name: 'Paste Format',
			canExecute: () =>
				!editor.isReadOnly() && this.paintFormatActive && this.copiedFormat !== null,
			execute: () => this.pasteFormat(editor),
		});
	}

	reset(_editor: JPEditor): void {
		this.pendingMarks = null;
		this.copiedFormat = null;
		this.paintFormatActive = false;
		this.onPaintFormatChange?.(false);
	}

	getPendingMarks(): Partial<JPRunProperties> | null {
		return this.pendingMarks;
	}

	clearPendingMarks(): void {
		this.pendingMarks = null;
	}

	isPaintFormatActive(): boolean {
		return this.paintFormatActive;
	}

	clearPaintFormat(): void {
		this.copiedFormat = null;
		this.paintFormatActive = false;
		this.onPaintFormatChange?.(false);
	}

	// ── Inline Formatting Methods ──────────────────────────────────

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

		// Determine toggle state from original runs (before any splitting)
		const runs = getRunsInRange(editor.getDocument(), sel);
		const allHave = runs.every((r) => r.node.properties[prop] === true);
		this.applyFormatToSelection(editor, { [prop]: !allHave });
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

		const runs = getRunsInRange(editor.getDocument(), sel);
		const allUnderlined = runs.every((r) => r.node.properties.underline === 'single');
		this.applyFormatToSelection(editor, { underline: allUnderlined ? 'none' : 'single' });
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

		const runs = getRunsInRange(editor.getDocument(), sel);
		const allHave = runs.every((r) => r.node.properties[prop] === true);
		this.applyFormatToSelection(editor, { [prop]: !allHave, [opposite]: false });
	}

	private setFormat(editor: JPEditor, props: Partial<JPRunProperties>): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			this.pendingMarks = { ...this.pendingMarks, ...props };
			return;
		}

		this.applyFormatToSelection(editor, props);
	}

	private clearFormatting(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		if (SelectionManager.isCollapsed(sel)) {
			this.pendingMarks = {};
			return;
		}

		editor.batch(() => {
			const paths = this.isolateSelectedRuns(editor);
			if (paths.length === 0) return;

			for (const path of paths) {
				const run = getNodeAtPath(editor.getDocument(), path) as JPRun;
				const nullProps: Record<string, unknown> = {};
				const oldProps: Record<string, unknown> = {};
				for (const key of Object.keys(run.properties)) {
					if (key === 'id') continue;
					nullProps[key] = null;
					oldProps[key] = (run.properties as Record<string, unknown>)[key];
				}
				editor.apply({
					type: 'set_properties',
					path,
					properties: nullProps,
					oldProperties: oldProps,
				});
			}

			this.updateSelectionToFormattedRuns(editor, paths);
		});
	}

	/**
	 * Apply run properties to the selected text range.
	 * Splits runs at selection boundaries so only selected text is affected,
	 * then updates the selection to cover the newly formatted runs.
	 */
	private applyFormatToSelection(editor: JPEditor, props: Partial<JPRunProperties>): void {
		editor.batch(() => {
			const paths = this.isolateSelectedRuns(editor);
			if (paths.length === 0) return;

			for (const path of paths) {
				this.applyPropsToRun(editor, path, props);
			}

			// Update selection to cover the formatted runs in the new document tree
			this.updateSelectionToFormattedRuns(editor, paths);
		});
	}

	/**
	 * After splitting and formatting runs, update the editor selection
	 * so it covers exactly the formatted runs (anchor at start of first
	 * formatted run, focus at end of last formatted run).
	 */
	private updateSelectionToFormattedRuns(editor: JPEditor, runPaths: JPPath[]): void {
		const doc = editor.getDocument();

		// Find anchor: first text node of first formatted run, offset 0
		const firstRunPath = runPaths[0];
		const firstAnchor = this.findFirstTextInRun(doc, firstRunPath);
		if (!firstAnchor) return;

		// Find focus: last text node of last formatted run, offset = text.length
		const lastRunPath = runPaths[runPaths.length - 1];
		const lastFocus = this.findLastTextInRun(doc, lastRunPath);
		if (!lastFocus) return;

		editor.apply({
			type: 'set_selection',
			newSelection: {
				anchor: { path: firstAnchor.path, offset: 0 },
				focus: { path: lastFocus.path, offset: lastFocus.node.text.length },
			},
			oldSelection: editor.getSelection(),
		});
	}

	private findFirstTextInRun(
		doc: JPDocument,
		runPath: JPPath,
	): { path: JPPath; node: JPText } | null {
		const run = getNodeAtPath(doc as any, runPath);
		if (!isElement(run)) return null;
		for (let i = 0; i < run.children.length; i++) {
			const child = run.children[i];
			if (isText(child)) {
				return { path: [...runPath, i], node: child };
			}
		}
		return null;
	}

	private findLastTextInRun(
		doc: JPDocument,
		runPath: JPPath,
	): { path: JPPath; node: JPText } | null {
		const run = getNodeAtPath(doc as any, runPath);
		if (!isElement(run)) return null;
		for (let i = run.children.length - 1; i >= 0; i--) {
			const child = run.children[i];
			if (isText(child)) {
				return { path: [...runPath, i], node: child };
			}
		}
		return null;
	}

	// ── Run Isolation (Split at selection boundaries) ──────────────

	/**
	 * Split runs at selection boundaries and return paths of runs
	 * that contain the selected text. Must be called within a batch.
	 */
	private isolateSelectedRuns(editor: JPEditor): JPPath[] {
		const sel = editor.getSelection();
		if (!sel) return [];

		const doc = editor.getDocument();
		const ctx = resolveRangeContext(doc, sel);
		if (ctx.isCollapsed) return [];

		const start = ctx.isForward ? ctx.anchor : ctx.focus;
		const end = ctx.isForward ? ctx.focus : ctx.anchor;

		if (pathEquals(start.runPath, end.runPath)) {
			return this.isolateSameRun(editor, start, end);
		}

		return this.isolateMultiRun(editor, start, end, sel);
	}

	/**
	 * Handle selection within a single run.
	 * Splits the run to isolate the selected text, returns path of the selected run.
	 */
	private isolateSameRun(
		editor: JPEditor,
		start: SelectionContext,
		end: SelectionContext,
	): JPPath[] {
		const runPath = start.runPath;
		const startTextIdx = start.textPath[start.textPath.length - 1];
		const startOff = start.offset;
		const endOff = end.offset;
		const sameText = pathEquals(start.textPath, end.textPath);

		// Full text selected → no splits needed
		if (sameText && startOff === 0 && endOff >= start.textNode.text.length) {
			return [runPath];
		}

		// Different text children in the same run (rare case)
		if (!sameText) {
			return this.isolateSameRunMultiText(editor, start, end);
		}

		// Same text node — split text at end then start
		if (endOff < start.textNode.text.length) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, startTextIdx],
				position: endOff,
				properties: { id: generateId() },
			});
		}

		let selectedChildIdx = startTextIdx;
		if (startOff > 0) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, startTextIdx],
				position: startOff,
				properties: { id: generateId() },
			});
			selectedChildIdx = startTextIdx + 1;
		}

		// Split the run to isolate the selected text child
		const updatedRun = getNodeAtPath(editor.getDocument(), runPath);
		const numChildren = isElement(updatedRun) ? updatedRun.children.length : 1;

		if (selectedChildIdx + 1 < numChildren) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: selectedChildIdx + 1,
				properties: { id: generateId() },
			});
		}

		if (selectedChildIdx > 0) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: selectedChildIdx,
				properties: { id: generateId() },
			});
			return [[...runPath.slice(0, -1), runPath[runPath.length - 1] + 1]];
		}

		return [runPath];
	}

	/**
	 * Handle same run but different text children (rare).
	 */
	private isolateSameRunMultiText(
		editor: JPEditor,
		start: SelectionContext,
		end: SelectionContext,
	): JPPath[] {
		const runPath = start.runPath;
		const startTextIdx = start.textPath[start.textPath.length - 1];
		const endTextIdx = end.textPath[end.textPath.length - 1];

		const splitEnd = end.offset < end.textNode.text.length;
		if (splitEnd) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, endTextIdx],
				position: end.offset,
				properties: { id: generateId() },
			});
		}

		const splitStart = start.offset > 0;
		if (splitStart) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, startTextIdx],
				position: start.offset,
				properties: { id: generateId() },
			});
		}

		const firstSelected = startTextIdx + (splitStart ? 1 : 0);
		const lastSelected = endTextIdx + (splitStart ? 1 : 0);

		const updatedRun = getNodeAtPath(editor.getDocument(), runPath);
		const numChildren = isElement(updatedRun) ? updatedRun.children.length : 1;

		if (lastSelected + 1 < numChildren) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: lastSelected + 1,
				properties: { id: generateId() },
			});
		}

		if (firstSelected > 0) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: firstSelected,
				properties: { id: generateId() },
			});
			return [[...runPath.slice(0, -1), runPath[runPath.length - 1] + 1]];
		}

		return [runPath];
	}

	/**
	 * Handle multi-run selection. Process from end to start to avoid path shifts.
	 */
	private isolateMultiRun(
		editor: JPEditor,
		start: SelectionContext,
		end: SelectionContext,
		sel: JPRange,
	): JPPath[] {
		const runs = getRunsInRange(editor.getDocument(), sel);
		const result: JPPath[] = [];

		for (let i = runs.length - 1; i >= 0; i--) {
			const run = runs[i];

			if (!run.isPartial) {
				result.push(run.path);
				continue;
			}

			if (i === runs.length - 1) {
				// End partial run
				result.push(...this.isolateEndRun(editor, end, run.path));
			} else if (i === 0) {
				// Start partial run
				result.push(...this.isolateStartRun(editor, start, run.path));
			}
		}

		return result;
	}

	/**
	 * Split the end partial run to isolate the selected portion (start of run to endOffset).
	 */
	private isolateEndRun(editor: JPEditor, end: SelectionContext, runPath: JPPath): JPPath[] {
		const textIdx = end.textPath[end.textPath.length - 1];
		const endOff = end.offset;

		if (endOff === 0 && textIdx === 0) return [];

		const run = getNodeAtPath(editor.getDocument(), runPath);
		const numChildren = isElement(run) ? run.children.length : 1;
		if (endOff >= end.textNode.text.length && textIdx >= numChildren - 1) {
			return [runPath];
		}

		if (endOff < end.textNode.text.length) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, textIdx],
				position: endOff,
				properties: { id: generateId() },
			});
		}

		const splitAt = textIdx + 1;
		const updatedRun = getNodeAtPath(editor.getDocument(), runPath);
		const updatedNumChildren = isElement(updatedRun) ? updatedRun.children.length : 1;

		if (splitAt < updatedNumChildren) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: splitAt,
				properties: { id: generateId() },
			});
		}

		return [runPath];
	}

	/**
	 * Split the start partial run to isolate the selected portion (startOffset to end of run).
	 */
	private isolateStartRun(editor: JPEditor, start: SelectionContext, runPath: JPPath): JPPath[] {
		const textIdx = start.textPath[start.textPath.length - 1];
		const startOff = start.offset;

		if (startOff === 0 && textIdx === 0) {
			return [runPath];
		}

		if (startOff > 0) {
			editor.apply({
				type: 'split_node',
				path: [...runPath, textIdx],
				position: startOff,
				properties: { id: generateId() },
			});
		}

		const selectedStart = textIdx + (startOff > 0 ? 1 : 0);

		if (selectedStart > 0) {
			editor.apply({
				type: 'split_node',
				path: runPath,
				position: selectedStart,
				properties: { id: generateId() },
			});
			return [[...runPath.slice(0, -1), runPath[runPath.length - 1] + 1]];
		}

		return [runPath];
	}

	/**
	 * Apply properties to a single run at the given path.
	 */
	private applyPropsToRun(
		editor: JPEditor,
		runPath: JPPath,
		props: Partial<JPRunProperties>,
	): void {
		const run = getNodeAtPath(editor.getDocument(), runPath) as JPRun;
		const oldProps: Record<string, unknown> = {};
		for (const key of Object.keys(props)) {
			oldProps[key] = (run.properties as Record<string, unknown>)[key];
		}
		editor.apply({
			type: 'set_properties',
			path: runPath,
			properties: props as Record<string, unknown>,
			oldProperties: oldProps,
		});
	}

	// ── Other helpers ──────────────────────────────────────────────

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

	private setAlignment(editor: JPEditor, alignment: JPAlignment): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: { alignment },
					oldProperties: { alignment: para.node.properties.alignment ?? 'left' },
				});
			}
		});
	}

	private setParagraphProperty(editor: JPEditor, props: Record<string, unknown>): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				// Deep merge for nested objects like spacing and indent
				let mergedProps = props;
				if (props.spacing && typeof props.spacing === 'object') {
					const existingSpacing = (para.node.properties.spacing as Record<string, unknown>) ?? {};
					mergedProps = { ...props, spacing: { ...existingSpacing, ...props.spacing } };
				}
				if (props.indent && typeof props.indent === 'object') {
					const existingIndent = (para.node.properties.indent as Record<string, unknown>) ?? {};
					mergedProps = { ...mergedProps, indent: { ...existingIndent, ...props.indent } };
				}

				const oldProps: Record<string, unknown> = {};
				for (const key of Object.keys(mergedProps)) {
					oldProps[key] = (para.node.properties as Record<string, unknown>)[key];
				}
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: mergedProps,
					oldProperties: oldProps,
				});
			}
		});
	}

	private changeIndent(editor: JPEditor, direction: 'increase' | 'decrease'): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);
		const step = 720; // 0.5 inch in twips

		editor.batch(() => {
			for (const para of paragraphs) {
				const currentLeft = para.node.properties.indent?.left ?? 0;
				const newLeft =
					direction === 'increase' ? currentLeft + step : Math.max(0, currentLeft - step);
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: { indent: { ...para.node.properties.indent, left: newLeft } },
					oldProperties: { indent: para.node.properties.indent },
				});
			}
		});
	}

	private copyFormat(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);
		const { id: _id, ...formatProps } = ctx.run.properties as Record<string, unknown> & {
			id?: string;
		};
		this.copiedFormat = formatProps as Partial<JPRunProperties>;
		this.paintFormatActive = true;
		this.onPaintFormatChange?.(true);
	}

	private pasteFormat(editor: JPEditor): void {
		if (!this.copiedFormat) return;

		const sel = editor.getSelection();
		if (!sel) return;

		const format = this.copiedFormat;

		if (SelectionManager.isCollapsed(sel)) {
			this.pendingMarks = { ...format };
		} else {
			editor.batch(() => {
				const paths = this.isolateSelectedRuns(editor);
				if (paths.length === 0) return;

				for (const path of paths) {
					const run = getNodeAtPath(editor.getDocument(), path) as JPRun;
					const oldProps: Record<string, unknown> = {};
					for (const key of Object.keys(format)) {
						oldProps[key] = (run.properties as Record<string, unknown>)[key];
					}
					const nullProps: Record<string, unknown> = {};
					for (const key of Object.keys(run.properties)) {
						if (key === 'id') continue;
						if (!(key in format)) {
							nullProps[key] = null;
							oldProps[key] = (run.properties as Record<string, unknown>)[key];
						}
					}
					editor.apply({
						type: 'set_properties',
						path,
						properties: { ...format, ...nullProps } as Record<string, unknown>,
						oldProperties: oldProps,
					});
				}

				this.updateSelectionToFormattedRuns(editor, paths);
			});
		}

		this.copiedFormat = null;
		this.paintFormatActive = false;
		this.onPaintFormatChange?.(false);
	}
}
