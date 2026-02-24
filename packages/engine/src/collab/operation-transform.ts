import type {
	JPDeleteTextOp,
	JPInsertNodeOp,
	JPInsertTextOp,
	JPMergeNodeOp,
	JPMoveNodeOp,
	JPOperation,
	JPPath,
	JPRemoveNodeOp,
	JPSetPropertiesOp,
	JPSplitNodeOp,
} from '@jpoffice/model';

// ── Path helpers ─────────────────────────────────────────────

/**
 * Check if two paths are equal up to (but not including) the given depth.
 */
function pathsEqualUpTo(a: JPPath, b: JPPath, depth: number): boolean {
	for (let i = 0; i < depth; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Check if two paths are exactly equal.
 */
function pathsEqual(a: JPPath, b: JPPath): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Increment a path at a given depth.
 */
function incrementPathAt(path: JPPath, depth: number, delta: number): JPPath {
	const newPath = [...path];
	newPath[depth] += delta;
	return newPath;
}

// ── Path transformation against operations ───────────────────

/**
 * Transform a path given an insert_node operation that was applied before it.
 * If a node was inserted at or before the path's position at the relevant
 * depth, shift the path index up.
 */
function transformPathAgainstInsertNode(path: JPPath, insertPath: JPPath): JPPath {
	if (insertPath.length > path.length) return path;
	const depth = insertPath.length - 1;
	if (depth < 0) return path;
	if (!pathsEqualUpTo(path, insertPath, depth)) return path;
	if (path[depth] >= insertPath[depth]) {
		return incrementPathAt(path, depth, 1);
	}
	return path;
}

/**
 * Transform a path given a remove_node operation that was applied before it.
 * If the removed node is at or before the path, shift down.
 * If the removed node IS the path (or ancestor), return null (path is gone).
 */
function transformPathAgainstRemoveNode(path: JPPath, removePath: JPPath): JPPath | null {
	if (removePath.length > path.length + 1) return path;
	const depth = removePath.length - 1;
	if (depth < 0) return path;
	if (!pathsEqualUpTo(path, removePath, depth)) return path;

	if (path[depth] === removePath[depth]) {
		// Exact match or ancestor of removed node -- path is invalidated
		if (path.length >= removePath.length) return null;
		return path;
	}
	if (path[depth] > removePath[depth]) {
		return incrementPathAt(path, depth, -1);
	}
	return path;
}

/**
 * Transform a path given a split_node operation that was applied before it.
 * A split at `splitPath` with `position` splits the node into two:
 *  - The original node keeps children [0..position-1]
 *  - A new sibling at splitPath[depth]+1 gets children [position..]
 *
 * For text nodes: position is character offset.
 * For element nodes: position is child index.
 */
function transformPathAgainstSplitNode(path: JPPath, splitPath: JPPath, position: number): JPPath {
	if (splitPath.length > path.length) return path;
	const depth = splitPath.length - 1;
	if (depth < 0) return path;
	if (!pathsEqualUpTo(path, splitPath, depth)) return path;

	if (path[depth] === splitPath[depth]) {
		// We are inside the split node or are the split node itself
		if (path.length > splitPath.length) {
			// Inside the node -- check if we're in the part that moves to the new sibling
			const childIdx = path[depth + 1];
			if (childIdx !== undefined && childIdx >= position) {
				const newPath = [...path];
				newPath[depth] = splitPath[depth] + 1;
				newPath[depth + 1] = childIdx - position;
				return newPath;
			}
		}
		// At the split node itself or in the first half -- no change
		return path;
	}
	if (path[depth] > splitPath[depth]) {
		// After the split node -- shift right because a new sibling was inserted
		return incrementPathAt(path, depth, 1);
	}
	return path;
}

/**
 * Transform a path given a merge_node operation that was applied before it.
 * Merge is the inverse of split: the node at mergePath is merged into the
 * previous sibling (mergePath[depth]-1). The merge position indicates
 * where the merged content starts in the combined node.
 */
function transformPathAgainstMergeNode(path: JPPath, mergePath: JPPath, position: number): JPPath {
	if (mergePath.length > path.length) return path;
	const depth = mergePath.length - 1;
	if (depth < 0) return path;
	if (!pathsEqualUpTo(path, mergePath, depth)) return path;

	if (path[depth] === mergePath[depth]) {
		// We're inside the merged-away node -- remap into the previous sibling
		if (path.length > mergePath.length) {
			const newPath = [...path];
			newPath[depth] = mergePath[depth] - 1;
			newPath[depth + 1] = (path[depth + 1] ?? 0) + position;
			return newPath;
		}
		// The node itself is gone, remap to previous sibling
		const newPath = [...path];
		newPath[depth] = mergePath[depth] - 1;
		return newPath;
	}
	if (path[depth] > mergePath[depth]) {
		// After the merged node -- shift left
		return incrementPathAt(path, depth, -1);
	}
	return path;
}

/**
 * Transform a path given an arbitrary operation that was applied first.
 * Returns the adjusted path, or null if the path was invalidated.
 */
export function transformPath(path: JPPath, op: JPOperation): JPPath | null {
	switch (op.type) {
		case 'insert_node':
			return transformPathAgainstInsertNode(path, op.path);

		case 'remove_node':
			return transformPathAgainstRemoveNode(path, op.path);

		case 'split_node':
			return transformPathAgainstSplitNode(path, op.path, op.position);

		case 'merge_node':
			return transformPathAgainstMergeNode(path, op.path, op.position);

		case 'move_node': {
			// Move = remove from source + insert at dest.
			// First apply the remove, then the insert.
			const afterRemove = transformPathAgainstRemoveNode(path, op.path);
			if (afterRemove === null) return null;
			return transformPathAgainstInsertNode(afterRemove, op.newPath);
		}

		case 'insert_text':
		case 'delete_text':
		case 'set_properties':
		case 'set_selection':
			// These don't change the tree structure, so paths are unaffected
			return path;
	}
}

// ── Operation transformation ─────────────────────────────────

/**
 * Transform op2 against op1 that was applied first.
 * Returns the transformed op2 that can be applied after op1
 * produces the same final document state regardless of order.
 *
 * This implements the core OT invariant:
 *   apply(apply(doc, op1), transform(op2, op1)) ===
 *   apply(apply(doc, op2), transform(op1, op2))
 */
export function transformOperation(op1: JPOperation, op2: JPOperation): JPOperation {
	// set_selection ops are per-client and never conflict
	if (op2.type === 'set_selection') return op2;
	if (op1.type === 'set_selection') return op2;

	switch (op2.type) {
		case 'insert_text':
			return transformInsertText(op1, op2);
		case 'delete_text':
			return transformDeleteText(op1, op2);
		case 'insert_node':
			return transformInsertNode(op1, op2);
		case 'remove_node':
			return transformRemoveNode(op1, op2);
		case 'split_node':
			return transformSplitNode(op1, op2);
		case 'merge_node':
			return transformMergeNode(op1, op2);
		case 'move_node':
			return transformMoveNode(op1, op2);
		case 'set_properties':
			return transformSetProperties(op1, op2);
		default:
			return op2;
	}
}

// ── insert_text vs * ─────────────────────────────────────────

function transformInsertText(op1: JPOperation, op2: JPInsertTextOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		// Path was invalidated -- return a no-op (insert empty text)
		return { ...op2, text: '' };
	}

	let newOffset = op2.offset;

	if (op1.type === 'insert_text' && pathsEqual(op1.path, op2.path)) {
		// Same node: if op1 inserted at or before our offset, shift right
		if (op1.offset <= op2.offset) {
			newOffset += op1.text.length;
		}
	} else if (op1.type === 'delete_text' && pathsEqual(op1.path, op2.path)) {
		// Same node: if op1 deleted before our offset, shift left
		if (op1.offset < op2.offset) {
			newOffset -= Math.min(op1.text.length, op2.offset - op1.offset);
		}
	} else if (op1.type === 'split_node' && pathsEqual(op1.path, op2.path)) {
		// Split the text node we're inserting into
		if (op2.offset >= op1.position) {
			// Our insert is in the second half (new node after split)
			return {
				...op2,
				path: incrementPathAt(newPath, newPath.length - 1, 1),
				offset: op2.offset - op1.position,
			};
		}
	}

	return { ...op2, path: newPath, offset: newOffset };
}

// ── delete_text vs * ─────────────────────────────────────────

function transformDeleteText(op1: JPOperation, op2: JPDeleteTextOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		return { ...op2, text: '', offset: 0 };
	}

	let newOffset = op2.offset;
	let newText = op2.text;

	if (op1.type === 'insert_text' && pathsEqual(op1.path, op2.path)) {
		if (op1.offset <= op2.offset) {
			newOffset += op1.text.length;
		} else if (op1.offset < op2.offset + op2.text.length) {
			// Insert is inside the delete range -- we need to keep the inserted text
			// and delete around it. For simplicity: split into two conceptual ranges.
			// The delete still covers its original characters but offset adjusts.
			// The inserted text is new and should not be deleted.
			// Simplification: just adjust offset, the text to delete is the same chars
			// but the server-side model handles the actual text content.
			newOffset = op2.offset;
		}
	} else if (op1.type === 'delete_text' && pathsEqual(op1.path, op2.path)) {
		// Both deleting from the same node -- handle overlap
		const start1 = op1.offset;
		const end1 = op1.offset + op1.text.length;
		const start2 = op2.offset;
		const end2 = op2.offset + op2.text.length;

		if (end1 <= start2) {
			// op1 deleted entirely before op2 -- shift left
			newOffset -= op1.text.length;
		} else if (start1 >= end2) {
			// op1 deleted entirely after op2 -- no change
		} else {
			// Overlapping deletes
			const overlapStart = Math.max(start1, start2);
			const overlapEnd = Math.min(end1, end2);
			const overlapLen = overlapEnd - overlapStart;
			// Remove the overlapping portion from op2's text
			const localStart = overlapStart - start2;
			newText = op2.text.slice(0, localStart) + op2.text.slice(localStart + overlapLen);
			newOffset = Math.min(start2, start1);
			if (newText.length === 0) {
				// Entirely overlapped -- no-op
				return { ...op2, path: newPath, offset: 0, text: '' };
			}
		}
	} else if (op1.type === 'split_node' && pathsEqual(op1.path, op2.path)) {
		if (op2.offset >= op1.position) {
			return {
				...op2,
				path: incrementPathAt(newPath, newPath.length - 1, 1),
				offset: op2.offset - op1.position,
				text: newText,
			};
		}
	}

	return { ...op2, path: newPath, offset: newOffset, text: newText };
}

// ── insert_node vs * ─────────────────────────────────────────

function transformInsertNode(op1: JPOperation, op2: JPInsertNodeOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		// Very unlikely for insert_node, but handle gracefully
		return op2;
	}
	return { ...op2, path: newPath };
}

// ── remove_node vs * ─────────────────────────────────────────

function transformRemoveNode(op1: JPOperation, op2: JPRemoveNodeOp): JPOperation {
	// If op1 already removed the same node, make op2 a no-op
	if (op1.type === 'remove_node' && pathsEqual(op1.path, op2.path)) {
		// Double remove -- return a safe no-op by keeping the op but the path
		// will point to nothing. We mark it by setting path to an impossible value.
		// In practice, the applyOperation on a missing node would be a no-op.
		// Return the op with its transformed path (which is null = gone).
		return {
			...op2,
			path: [-1],
		};
	}
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		return { ...op2, path: [-1] };
	}
	return { ...op2, path: newPath };
}

// ── split_node vs * ─────────────────────────────────────────

function transformSplitNode(op1: JPOperation, op2: JPSplitNodeOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		return op2;
	}

	let newPosition = op2.position;

	if (op1.type === 'insert_text' && pathsEqual(op1.path, op2.path)) {
		if (op1.offset <= op2.position) {
			newPosition += op1.text.length;
		}
	} else if (op1.type === 'delete_text' && pathsEqual(op1.path, op2.path)) {
		if (op1.offset < op2.position) {
			newPosition -= Math.min(op1.text.length, op2.position - op1.offset);
		}
	}

	return { ...op2, path: newPath, position: newPosition };
}

// ── merge_node vs * ─────────────────────────────────────────

function transformMergeNode(op1: JPOperation, op2: JPMergeNodeOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		return op2;
	}

	let newPosition = op2.position;

	// If op1 inserted/deleted text in the target node (the one being merged into),
	// adjust the merge position.
	const targetPath = [...op2.path];
	targetPath[targetPath.length - 1] -= 1;

	if (op1.type === 'insert_text' && pathsEqual(op1.path, targetPath)) {
		// Text was added to the merge target -- increase position
		newPosition += op1.text.length;
	} else if (op1.type === 'delete_text' && pathsEqual(op1.path, targetPath)) {
		newPosition -= Math.min(op1.text.length, newPosition);
	} else if (op1.type === 'insert_node' && pathsEqual(op1.path.slice(0, -1), targetPath)) {
		// A child was inserted in the merge target -- increase position
		const insertedAt = op1.path[op1.path.length - 1];
		if (insertedAt <= op2.position) {
			newPosition += 1;
		}
	} else if (op1.type === 'remove_node' && pathsEqual(op1.path.slice(0, -1), targetPath)) {
		const removedAt = op1.path[op1.path.length - 1];
		if (removedAt < op2.position) {
			newPosition -= 1;
		}
	}

	return { ...op2, path: newPath, position: newPosition };
}

// ── move_node vs * ───────────────────────────────────────────

function transformMoveNode(op1: JPOperation, op2: JPMoveNodeOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	const newNewPath = transformPath(op2.newPath, op1);
	if (newPath === null || newNewPath === null) {
		return op2;
	}
	return { ...op2, path: newPath, newPath: newNewPath };
}

// ── set_properties vs * ─────────────────────────────────────

function transformSetProperties(op1: JPOperation, op2: JPSetPropertiesOp): JPOperation {
	const newPath = transformPath(op2.path, op1);
	if (newPath === null) {
		return op2;
	}

	// If both set_properties on the same path, last-writer-wins (op2 wins)
	// but we need to update oldProperties to reflect what op1 already set.
	if (op1.type === 'set_properties' && pathsEqual(op1.path, op2.path)) {
		const newOldProperties = { ...op2.oldProperties };
		for (const key of Object.keys(op2.properties)) {
			if (key in op1.properties) {
				// op1 already changed this property -- the "old" value for op2
				// is now whatever op1 set it to
				newOldProperties[key] = op1.properties[key];
			}
		}
		return { ...op2, path: newPath, oldProperties: newOldProperties };
	}

	return { ...op2, path: newPath };
}

// ── Batch transformation ─────────────────────────────────────

/**
 * Transform a single operation against a list of operations.
 * Applies each transform sequentially: op against ops[0], then result against ops[1], etc.
 */
export function transformOperationAgainstMany(
	op: JPOperation,
	ops: readonly JPOperation[],
): JPOperation {
	let result = op;
	for (const against of ops) {
		result = transformOperation(against, result);
	}
	return result;
}

/**
 * Transform a list of operations against a single operation.
 */
export function transformManyAgainstOperation(
	ops: readonly JPOperation[],
	against: JPOperation,
): JPOperation[] {
	return ops.map((op) => transformOperation(against, op));
}
