import type {
	JPDocument,
	JPOperation,
	JPParagraphProperties,
	JPRunProperties,
	JPSelection,
	JPStyleRegistry,
} from '@jpoffice/model';
import { applyOperation } from '@jpoffice/model';
import type { JPCommand } from './commands/command';
import { JPCommandRegistry } from './commands/registry';
import type { JPEditorState } from './editor-state';
import { createEditorState } from './editor-state';
import { canRedo, canUndo, performRedo, performUndo, pushToHistory } from './history/history';
import type { FormattingPlugin } from './plugins/formatting/formatting-plugin';
import type { JPPlugin } from './plugins/plugin';
import { JPPluginManager } from './plugins/plugin-manager';
import { resolveSelectionContext } from './plugins/text/text-utils';
import { SelectionManager } from './selection/selection-manager';

export type JPEditorListener = (state: JPEditorState) => void;

export interface JPEditorOptions {
	document: JPDocument;
	selection?: JPSelection;
	readOnly?: boolean;
	plugins?: JPPlugin[];
}

/**
 * JPEditor is the central coordinator.
 * It owns the state, applies operations (through plugins),
 * manages history (undo/redo), and notifies subscribers.
 */
export class JPEditor {
	private state: JPEditorState;
	private listeners: Set<JPEditorListener> = new Set();
	private commandRegistry: JPCommandRegistry;
	private pluginManager: JPPluginManager;
	private batchDepth = 0;
	private batchOps: JPOperation[] = [];

	constructor(options: JPEditorOptions) {
		this.state = createEditorState(options.document, {
			selection: options.selection,
			readOnly: options.readOnly,
		});

		this.commandRegistry = new JPCommandRegistry();
		this.pluginManager = new JPPluginManager();

		// Register plugins
		if (options.plugins) {
			for (const plugin of options.plugins) {
				this.pluginManager.register(plugin, this);
			}
		}
	}

	// ── State Access ──────────────────────────────────────────

	getState(): JPEditorState {
		return this.state;
	}

	getDocument(): JPDocument {
		return this.state.document;
	}

	getSelection(): JPSelection {
		return this.state.selection;
	}

	isReadOnly(): boolean {
		return this.state.readOnly;
	}

	// ── State Subscription ────────────────────────────────────

	subscribe(listener: JPEditorListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	// ── Operations ────────────────────────────────────────────

	/**
	 * Apply a single operation to the document.
	 * Runs through plugin beforeApply/afterApply hooks.
	 * Pushes to history unless inside a batch or it's a selection-only op.
	 */
	apply(op: JPOperation): void {
		if (this.state.readOnly && op.type !== 'set_selection') return;

		// Plugin beforeApply may transform or cancel
		const ops = this.pluginManager.beforeApply(this, op);
		if (ops.length === 0) return;

		let doc = this.state.document;
		let selection = this.state.selection;
		const appliedOps: JPOperation[] = [];

		for (const o of ops) {
			if (o.type === 'set_selection') {
				selection = o.newSelection;
			} else {
				doc = applyOperation(doc, o);
			}
			appliedOps.push(o);
		}

		// Update state
		const nonSelectionOps = appliedOps.filter((o) => o.type !== 'set_selection');

		if (this.batchDepth > 0) {
			// Accumulate for batch commit
			this.batchOps.push(...nonSelectionOps);
			this.state = {
				...this.state,
				document: doc,
				selection,
			};
		} else {
			// Push to history immediately
			const history =
				nonSelectionOps.length > 0
					? pushToHistory(this.state.history, nonSelectionOps)
					: this.state.history;

			this.state = {
				...this.state,
				document: doc,
				selection,
				history,
			};
		}

		// Plugin afterApply
		this.pluginManager.afterApply(this, appliedOps);

		this.notify();
	}

	/**
	 * Apply multiple operations atomically as a single undo step.
	 */
	applyBatch(ops: JPOperation[]): void {
		this.batch(() => {
			for (const op of ops) {
				this.apply(op);
			}
		});
	}

	/**
	 * Group multiple apply() calls into a single undo step.
	 * Batches can be nested.
	 */
	batch(fn: () => void): void {
		this.batchDepth++;
		try {
			fn();
		} finally {
			this.batchDepth--;
			if (this.batchDepth === 0 && this.batchOps.length > 0) {
				const history = pushToHistory(this.state.history, this.batchOps);
				this.state = { ...this.state, history };
				this.batchOps = [];
				this.notify();
			}
		}
	}

	// ── History ───────────────────────────────────────────────

	undo(): void {
		const result = performUndo(this.state.document, this.state.history);
		if (!result) return;

		this.state = {
			...this.state,
			document: result.document,
			history: result.history,
		};
		this.notify();
	}

	redo(): void {
		const result = performRedo(this.state.document, this.state.history);
		if (!result) return;

		this.state = {
			...this.state,
			document: result.document,
			history: result.history,
		};
		this.notify();
	}

	canUndo(): boolean {
		return canUndo(this.state.history);
	}

	canRedo(): boolean {
		return canRedo(this.state.history);
	}

	// ── Selection ─────────────────────────────────────────────

	setSelection(selection: JPSelection): void {
		this.apply({
			type: 'set_selection',
			oldSelection: this.state.selection,
			newSelection: selection,
		});
	}

	getSelectedText(): string {
		if (!this.state.selection) return '';
		return SelectionManager.getSelectedText(this.state.document, this.state.selection);
	}

	/**
	 * Return the effective run + paragraph formatting at the current cursor position.
	 * Merges pending marks (from collapsed cursor formatting toggles) on top of the
	 * run properties so the toolbar can reflect the "next character" style.
	 */
	getFormatAtCursor(): {
		run: Partial<JPRunProperties>;
		paragraph: Partial<JPParagraphProperties>;
	} | null {
		const sel = this.state.selection;
		if (!sel) return null;
		const doc = this.state.document;
		try {
			const ctx = resolveSelectionContext(doc, sel.anchor);
			const formattingPlugin = this.getPlugin('jpoffice.formatting') as
				| FormattingPlugin
				| undefined;
			const pendingMarks = formattingPlugin?.getPendingMarks();
			return {
				run: { ...ctx.run.properties, ...(pendingMarks ?? {}) },
				paragraph: ctx.paragraph.properties,
			};
		} catch {
			return null;
		}
	}

	// ── Commands ──────────────────────────────────────────────

	registerCommand<TArgs>(command: JPCommand<TArgs>): void {
		this.commandRegistry.register(command);
	}

	executeCommand(commandId: string, args?: unknown): void {
		this.commandRegistry.execute(commandId, this, args);
	}

	canExecuteCommand(commandId: string, args?: unknown): boolean {
		return this.commandRegistry.canExecute(commandId, this, args);
	}

	getCommandRegistry(): JPCommandRegistry {
		return this.commandRegistry;
	}

	// ── Plugins ───────────────────────────────────────────────

	registerPlugin(plugin: JPPlugin): void {
		this.pluginManager.register(plugin, this);
	}

	unregisterPlugin(pluginId: string): void {
		this.pluginManager.unregister(pluginId);
	}

	getPlugin(pluginId: string): JPPlugin | undefined {
		return this.pluginManager.getPlugin(pluginId);
	}

	// ── Read-Only Toggle ──────────────────────────────────────

	setReadOnly(readOnly: boolean): void {
		if (this.state.readOnly === readOnly) return;
		this.state = { ...this.state, readOnly };
		this.notify();
	}

	// ── Document Metadata Updates ────────────────────────────

	/**
	 * Update the document's style registry without resetting history or selection.
	 * Used by the StylesPlugin for creating, modifying, renaming, and deleting styles.
	 */
	updateDocumentStyles(styles: JPStyleRegistry): void {
		if (this.state.readOnly) return;
		const newDoc: JPDocument = { ...this.state.document, styles };
		this.state = { ...this.state, document: newDoc };
		this.notify();
	}

	// ── Document Replacement ─────────────────────────────────

	/**
	 * Replace the entire document, resetting history, selection, and plugin state.
	 * Used when loading a new file or creating a new document.
	 */
	setDocument(document: JPDocument, options?: { selection?: JPSelection }): void {
		const cursorPath = this.findFirstTextPath(document);
		const defaultPoint = cursorPath ? { path: cursorPath, offset: 0 } : null;
		const selection =
			options?.selection ?? (defaultPoint ? { anchor: defaultPoint, focus: defaultPoint } : null);

		this.pluginManager.resetAll(this);

		this.state = createEditorState(document, {
			selection,
			readOnly: this.state.readOnly,
		});

		this.notify();
	}

	private findFirstTextPath(doc: JPDocument): readonly number[] | null {
		let node: { children?: readonly unknown[] } = doc;
		const path: number[] = [];
		while (node.children && (node.children as readonly unknown[]).length > 0) {
			path.push(0);
			node = (node.children as readonly { children?: readonly unknown[] }[])[0];
		}
		return path.length > 0 ? path : null;
	}

	// ── Cleanup ───────────────────────────────────────────────

	destroy(): void {
		this.pluginManager.destroyAll();
		this.listeners.clear();
	}
}
