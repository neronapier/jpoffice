/**
 * JPPath addresses any node in the document tree.
 * It's an array of integer indices representing the path from the root.
 *
 * Example: [0, 2, 1] means root.children[0].children[2].children[1]
 */
export type JPPath = readonly number[];

/**
 * A point is a path + offset within a node.
 * For text nodes, offset is the character index.
 * For element nodes, offset is the child index.
 */
export interface JPPoint {
	readonly path: JPPath;
	readonly offset: number;
}

/**
 * A range is defined by anchor and focus points.
 * When anchor equals focus, it represents a collapsed cursor.
 */
export interface JPRange {
	readonly anchor: JPPoint;
	readonly focus: JPPoint;
}

/**
 * Selection is either a range or null (no selection / editor blurred).
 */
export type JPSelection = JPRange | null;

// -- Path utilities --

/**
 * Compare two paths. Returns:
 *  -1 if a comes before b
 *   0 if they are equal
 *   1 if a comes after b
 */
export function comparePaths(a: JPPath, b: JPPath): -1 | 0 | 1 {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		if (a[i] < b[i]) return -1;
		if (a[i] > b[i]) return 1;
	}
	if (a.length < b.length) return -1;
	if (a.length > b.length) return 1;
	return 0;
}

/**
 * Check if two paths are equal.
 */
export function pathEquals(a: JPPath, b: JPPath): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Check if `ancestor` is an ancestor path of `descendant`.
 */
export function isAncestor(ancestor: JPPath, descendant: JPPath): boolean {
	if (ancestor.length >= descendant.length) return false;
	return ancestor.every((v, i) => v === descendant[i]);
}

/**
 * Check if path is an ancestor or equal to the other path.
 */
export function isAncestorOrEqual(a: JPPath, b: JPPath): boolean {
	return pathEquals(a, b) || isAncestor(a, b);
}

/**
 * Get the parent path (removes the last element).
 * Returns empty array for root-level paths.
 */
export function parentPath(path: JPPath): JPPath {
	return path.slice(0, -1);
}

/**
 * Get the last index in the path (the position within the parent).
 */
export function lastIndex(path: JPPath): number {
	return path[path.length - 1];
}

/**
 * Create a sibling path by changing the last index.
 */
export function siblingPath(path: JPPath, index: number): JPPath {
	return [...path.slice(0, -1), index];
}

/**
 * Create a child path by appending an index.
 */
export function childPath(path: JPPath, index: number): JPPath {
	return [...path, index];
}

/**
 * Get the common ancestor path of two paths.
 */
export function commonAncestor(a: JPPath, b: JPPath): JPPath {
	const result: number[] = [];
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) break;
		result.push(a[i]);
	}
	return result;
}

/**
 * Transform a path after an insert at another path.
 * Used for operation transformations.
 */
export function transformPathAfterInsert(path: JPPath, insertAt: JPPath): JPPath {
	if (path.length === 0 || insertAt.length === 0) return path;

	// Check if the paths share a common prefix up to the insert level
	const level = insertAt.length - 1;
	for (let i = 0; i < level; i++) {
		if (i >= path.length || path[i] !== insertAt[i]) return path;
	}

	// If path is at the same level and >= insertAt's index, shift right
	if (path.length > level && path[level] >= insertAt[level]) {
		const result = [...path];
		result[level]++;
		return result;
	}

	return path;
}

/**
 * Transform a path after a remove at another path.
 */
export function transformPathAfterRemove(path: JPPath, removeAt: JPPath): JPPath | null {
	if (path.length === 0 || removeAt.length === 0) return path;

	const level = removeAt.length - 1;
	for (let i = 0; i < level; i++) {
		if (i >= path.length || path[i] !== removeAt[i]) return path;
	}

	if (path.length > level) {
		if (path[level] === removeAt[level]) {
			// The path itself was removed
			if (path.length === removeAt.length) return null;
			// A descendant of the removed node
			if (isAncestorOrEqual(removeAt, path)) return null;
		}
		if (path[level] > removeAt[level]) {
			const result = [...path];
			result[level]--;
			return result;
		}
	}

	return path;
}
