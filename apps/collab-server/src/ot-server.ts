import type { JPOperation } from '@jpoffice/model';

/**
 * Extract the path from an operation, if it has one.
 * JPSetSelectionOp does not carry a path field.
 */
function getOpPath(op: JPOperation): readonly number[] | null {
	if (op.type === 'set_selection') return null;
	return op.path;
}

/**
 * Transform operation A against operation B.
 * Returns a new operation A' that achieves the same intent
 * when applied after B has been applied.
 *
 * This is a simplified OT transform. Full OT would handle
 * all operation type combinations.
 */
export function transformOperation(opA: JPOperation, opB: JPOperation): JPOperation {
	const pathA = getOpPath(opA);
	const pathB = getOpPath(opB);

	// Selection ops or ops without paths don't need path-based transform
	if (!pathA || !pathB) return opA;

	// If operations target different paths, no transform needed
	if (!pathsOverlap(pathA, pathB)) return opA;

	// For now, return opA unchanged (last-writer-wins)
	// A full implementation would adjust paths and offsets
	return opA;
}

/**
 * Transform a list of operations against another list.
 */
export function transformOperationAgainstMany(
	op: JPOperation,
	against: readonly JPOperation[],
): JPOperation {
	let transformed = op;
	for (const other of against) {
		transformed = transformOperation(transformed, other);
	}
	return transformed;
}

/**
 * Check if two paths overlap (one is ancestor of the other or they're equal).
 */
function pathsOverlap(pathA: readonly number[], pathB: readonly number[]): boolean {
	const minLen = Math.min(pathA.length, pathB.length);
	for (let i = 0; i < minLen; i++) {
		if (pathA[i] !== pathB[i]) return false;
	}
	return true;
}
