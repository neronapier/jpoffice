import type { JPDocument, JPOperationBatch, JPSelection } from '@jpoffice/model';

/**
 * History state for undo/redo.
 */
export interface JPHistory {
	readonly undos: readonly JPOperationBatch[];
	readonly redos: readonly JPOperationBatch[];
}

/**
 * The immutable editor state snapshot.
 * This is what React components subscribe to.
 */
export interface JPEditorState {
	readonly document: JPDocument;
	readonly selection: JPSelection;
	readonly history: JPHistory;
	readonly readOnly: boolean;
}

export function createEditorState(
	document: JPDocument,
	options?: { selection?: JPSelection; readOnly?: boolean },
): JPEditorState {
	return {
		document,
		selection: options?.selection ?? null,
		history: { undos: [], redos: [] },
		readOnly: options?.readOnly ?? false,
	};
}
