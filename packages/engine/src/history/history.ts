import type { JPDocument, JPOperation, JPOperationBatch } from '@jpoffice/model';
import { applyOperation, invertOperation } from '@jpoffice/model';
import type { JPHistory } from '../editor-state';

const MAX_HISTORY = 100;

/**
 * Push a batch of operations onto the undo stack.
 * Clears the redo stack (any new edit invalidates redos).
 */
export function pushToHistory(
	history: JPHistory,
	operations: readonly JPOperation[],
	description?: string,
): JPHistory {
	if (operations.length === 0) return history;

	const batch: JPOperationBatch = {
		operations,
		timestamp: Date.now(),
		description,
	};

	const undos = [...history.undos, batch];
	// Limit history size
	if (undos.length > MAX_HISTORY) {
		undos.shift();
	}

	return {
		undos,
		redos: [], // clear redo stack
	};
}

/**
 * Perform an undo. Returns the new document, selection ops, and updated history.
 * Returns null if there's nothing to undo.
 */
export function performUndo(
	doc: JPDocument,
	history: JPHistory,
): { document: JPDocument; history: JPHistory; invertedOps: readonly JPOperation[] } | null {
	if (history.undos.length === 0) return null;

	const batch = history.undos[history.undos.length - 1];
	const invertedOps: JPOperation[] = [];

	let currentDoc = doc;

	// Apply inverse operations in reverse order
	for (let i = batch.operations.length - 1; i >= 0; i--) {
		const inverse = invertOperation(batch.operations[i]);
		invertedOps.push(inverse);
		currentDoc = applyOperation(currentDoc, inverse);
	}

	// Move the batch from undos to redos
	const redoBatch: JPOperationBatch = {
		operations: invertedOps,
		timestamp: Date.now(),
		description: batch.description,
	};

	return {
		document: currentDoc,
		history: {
			undos: history.undos.slice(0, -1),
			redos: [...history.redos, redoBatch],
		},
		invertedOps,
	};
}

/**
 * Perform a redo. Returns the new document and updated history.
 * Returns null if there's nothing to redo.
 */
export function performRedo(
	doc: JPDocument,
	history: JPHistory,
): { document: JPDocument; history: JPHistory; invertedOps: readonly JPOperation[] } | null {
	if (history.redos.length === 0) return null;

	const batch = history.redos[history.redos.length - 1];
	const invertedOps: JPOperation[] = [];

	let currentDoc = doc;

	// Apply the redo operations in reverse order (they're already inverted)
	for (let i = batch.operations.length - 1; i >= 0; i--) {
		const inverse = invertOperation(batch.operations[i]);
		invertedOps.push(inverse);
		currentDoc = applyOperation(currentDoc, inverse);
	}

	// Move from redo to undo
	const undoBatch: JPOperationBatch = {
		operations: invertedOps,
		timestamp: Date.now(),
		description: batch.description,
	};

	return {
		document: currentDoc,
		history: {
			undos: [...history.undos, undoBatch],
			redos: history.redos.slice(0, -1),
		},
		invertedOps,
	};
}

/**
 * Check if undo is available.
 */
export function canUndo(history: JPHistory): boolean {
	return history.undos.length > 0;
}

/**
 * Check if redo is available.
 */
export function canRedo(history: JPHistory): boolean {
	return history.redos.length > 0;
}
