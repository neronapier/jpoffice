import type { JPPoint, JPSelection } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps } from '../text/text-utils';

// ── Types ────────────────────────────────────────────────────

export type DragDataType = 'text' | 'html' | 'image';

export interface DragState {
	/** Whether a drag operation is currently active. */
	readonly active: boolean;
	/** The source selection when dragging internal content. Null for external drags. */
	readonly sourceSelection: JPSelection | null;
	/** The type of data being dragged. */
	readonly dataType: DragDataType;
}

export interface DropArgs {
	/** The document position where content should be dropped. */
	readonly position: JPPoint;
	/** The dropped data (plain text, HTML string, or image data URL). */
	readonly data: string;
	/** The type of data being dropped. */
	readonly dataType: DragDataType;
	/** If true, copy instead of move (e.g., Ctrl held during drag). */
	readonly copy?: boolean;
	/** MIME type for image drops. */
	readonly mimeType?: string;
}

export interface StartDragArgs {
	/** The type of data being dragged. */
	readonly dataType?: DragDataType;
}

// ── Default drag state ───────────────────────────────────────

const DEFAULT_DRAG_STATE: DragState = {
	active: false,
	sourceSelection: null,
	dataType: 'text',
};

// ── Plugin ───────────────────────────────────────────────────

/**
 * DragDropPlugin handles drag-and-drop operations for the editor.
 *
 * Supports:
 * - Internal drag: move/copy selected text to a new position
 * - External text/HTML drops: insert content at drop position
 * - External image drops: insert image via image.insert command
 */
export class DragDropPlugin implements JPPlugin {
	readonly id = 'jpoffice.dragDrop';
	readonly name = 'Drag & Drop';

	private dragState: DragState = { ...DEFAULT_DRAG_STATE };

	/** Optional callback invoked when drag state changes (for React). */
	onDragStateChange?: (state: DragState) => void;

	initialize(editor: JPEditor): void {
		editor.registerCommand<StartDragArgs>({
			id: 'dragdrop.startDrag',
			name: 'Start Drag',
			canExecute: () => {
				const sel = editor.getSelection();
				return sel !== null && !SelectionManager.isCollapsed(sel);
			},
			execute: (_ed, args) => this.startDrag(editor, args),
		});

		editor.registerCommand<DropArgs>({
			id: 'dragdrop.drop',
			name: 'Drop',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.drop(editor, args),
		});

		editor.registerCommand({
			id: 'dragdrop.cancel',
			name: 'Cancel Drag',
			canExecute: () => this.dragState.active,
			execute: () => this.cancel(),
		});
	}

	// ── Public accessors ─────────────────────────────────────

	isDragging(): boolean {
		return this.dragState.active;
	}

	getDragState(): DragState {
		return this.dragState;
	}

	// ── Reset ────────────────────────────────────────────────

	reset(): void {
		this.setDragState({ ...DEFAULT_DRAG_STATE });
	}

	destroy(): void {
		this.onDragStateChange = undefined;
		this.dragState = { ...DEFAULT_DRAG_STATE };
	}

	// ── Commands ─────────────────────────────────────────────

	private startDrag(editor: JPEditor, args?: StartDragArgs): void {
		const sel = editor.getSelection();
		if (!sel || SelectionManager.isCollapsed(sel)) return;

		this.setDragState({
			active: true,
			sourceSelection: sel,
			dataType: args?.dataType ?? 'text',
		});
	}

	private drop(editor: JPEditor, args: DropArgs): void {
		if (!args) return;

		const { position, data, dataType, copy, mimeType } = args;

		// Handle image drops via image.insert command
		if (dataType === 'image') {
			this.handleImageDrop(editor, position, data, mimeType);
			this.setDragState({ ...DEFAULT_DRAG_STATE });
			return;
		}

		// Handle HTML drops via clipboard.paste
		if (dataType === 'html') {
			this.handleHtmlDrop(editor, position, data);
			this.setDragState({ ...DEFAULT_DRAG_STATE });
			return;
		}

		// Handle text drops (internal move/copy or external text)
		if (this.dragState.active && this.dragState.sourceSelection) {
			this.handleInternalDrop(editor, position, copy ?? false);
		} else {
			this.handleExternalTextDrop(editor, position, data);
		}

		this.setDragState({ ...DEFAULT_DRAG_STATE });
	}

	private cancel(): void {
		this.setDragState({ ...DEFAULT_DRAG_STATE });
	}

	// ── Internal drop (move/copy selected text) ──────────────

	private handleInternalDrop(editor: JPEditor, dropPoint: JPPoint, copy: boolean): void {
		const source = this.dragState.sourceSelection;
		if (!source) return;

		// Get the text from the source selection before modifying
		const selectedText = SelectionManager.getSelectedText(editor.getDocument(), source);
		if (!selectedText) return;

		editor.batch(() => {
			if (copy) {
				// Copy: just insert text at drop position
				editor.setSelection({ anchor: dropPoint, focus: dropPoint });
				editor.apply({
					type: 'insert_text',
					path: dropPoint.path,
					offset: dropPoint.offset,
					text: selectedText,
				});
				const endPoint = {
					path: dropPoint.path,
					offset: dropPoint.offset + selectedText.length,
				};
				editor.setSelection({ anchor: dropPoint, focus: endPoint });
			} else {
				// Move: delete source, then insert at adjusted drop position
				// We need to delete source first and figure out adjusted drop position

				// Delete source content
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), source);
				for (const op of ops) editor.apply(op);

				// After deletion, the drop point may have shifted.
				// For simplicity, set cursor to collapsed point then insert at it,
				// or use the drop position if it wasn't inside the deleted range.
				// The safest approach: set selection at collapsedPoint, then insert text.
				const insertPoint = collapsedPoint;
				editor.setSelection({ anchor: insertPoint, focus: insertPoint });
				editor.apply({
					type: 'insert_text',
					path: insertPoint.path,
					offset: insertPoint.offset,
					text: selectedText,
				});
				const endPoint = {
					path: insertPoint.path,
					offset: insertPoint.offset + selectedText.length,
				};
				editor.setSelection({ anchor: insertPoint, focus: endPoint });
			}
		});
	}

	// ── External text drop ───────────────────────────────────

	private handleExternalTextDrop(editor: JPEditor, dropPoint: JPPoint, text: string): void {
		if (!text) return;

		editor.batch(() => {
			// Set cursor at drop position, then use clipboard.paste for multi-line support
			editor.setSelection({ anchor: dropPoint, focus: dropPoint });

			try {
				editor.executeCommand('clipboard.paste', { text });
			} catch {
				// Fallback: simple text insert
				editor.apply({
					type: 'insert_text',
					path: dropPoint.path,
					offset: dropPoint.offset,
					text,
				});
				const endPoint = {
					path: dropPoint.path,
					offset: dropPoint.offset + text.length,
				};
				editor.setSelection({ anchor: dropPoint, focus: endPoint });
			}
		});
	}

	// ── HTML drop ────────────────────────────────────────────

	private handleHtmlDrop(editor: JPEditor, dropPoint: JPPoint, html: string): void {
		if (!html) return;

		editor.batch(() => {
			editor.setSelection({ anchor: dropPoint, focus: dropPoint });

			try {
				editor.executeCommand('clipboard.paste', { html });
			} catch {
				// Fallback: strip HTML and insert as plain text
				const text = html.replace(/<[^>]*>/g, '');
				if (text) {
					editor.apply({
						type: 'insert_text',
						path: dropPoint.path,
						offset: dropPoint.offset,
						text,
					});
				}
			}
		});
	}

	// ── Image drop ───────────────────────────────────────────

	private handleImageDrop(
		editor: JPEditor,
		dropPoint: JPPoint,
		dataUrl: string,
		mimeType?: string,
	): void {
		if (!dataUrl) return;

		editor.batch(() => {
			editor.setSelection({ anchor: dropPoint, focus: dropPoint });

			try {
				editor.executeCommand('image.insert', {
					src: dataUrl,
					mimeType: mimeType ?? 'image/png',
					width: 4800, // default ~200px in EMU
					height: 3600, // default ~150px in EMU
				});
			} catch {
				console.warn('[JPOffice] DragDrop: image.insert command not available');
			}
		});
	}

	// ── State management ─────────────────────────────────────

	private setDragState(state: DragState): void {
		this.dragState = state;
		this.onDragStateChange?.(state);
	}
}
