import type { JPNode } from '../nodes/node';
import type { JPPath, JPSelection } from '../path';

/**
 * Operations are the atomic mutations of the document model.
 * Every edit is expressed as one or more operations.
 * Operations are invertible (for undo) and can be composed (for batching).
 */

export interface JPInsertTextOp {
	readonly type: 'insert_text';
	readonly path: JPPath;
	readonly offset: number;
	readonly text: string;
}

export interface JPDeleteTextOp {
	readonly type: 'delete_text';
	readonly path: JPPath;
	readonly offset: number;
	readonly text: string; // deleted text (for inversion)
}

export interface JPInsertNodeOp {
	readonly type: 'insert_node';
	readonly path: JPPath;
	readonly node: JPNode;
}

export interface JPRemoveNodeOp {
	readonly type: 'remove_node';
	readonly path: JPPath;
	readonly node: JPNode; // removed node (for inversion)
}

export interface JPSplitNodeOp {
	readonly type: 'split_node';
	readonly path: JPPath;
	readonly position: number; // child index or text offset
	readonly properties: Record<string, unknown>; // properties for the new node
}

export interface JPMergeNodeOp {
	readonly type: 'merge_node';
	readonly path: JPPath;
	readonly position: number;
	readonly properties: Record<string, unknown>;
}

export interface JPMoveNodeOp {
	readonly type: 'move_node';
	readonly path: JPPath; // source
	readonly newPath: JPPath; // destination
}

export interface JPSetPropertiesOp {
	readonly type: 'set_properties';
	readonly path: JPPath;
	readonly properties: Record<string, unknown>; // new values
	readonly oldProperties: Record<string, unknown>; // old values (for inversion)
}

export interface JPSetSelectionOp {
	readonly type: 'set_selection';
	readonly oldSelection: JPSelection;
	readonly newSelection: JPSelection;
}

/**
 * Union of all operation types.
 */
export type JPOperation =
	| JPInsertTextOp
	| JPDeleteTextOp
	| JPInsertNodeOp
	| JPRemoveNodeOp
	| JPSplitNodeOp
	| JPMergeNodeOp
	| JPMoveNodeOp
	| JPSetPropertiesOp
	| JPSetSelectionOp;

/**
 * A batch of operations that form a single undo step.
 */
export interface JPOperationBatch {
	readonly operations: readonly JPOperation[];
	readonly timestamp: number;
	readonly description?: string;
}
