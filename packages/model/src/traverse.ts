import type { JPElement, JPNode } from './nodes/node';
import { isElement } from './nodes/node';
import type { JPText } from './nodes/text';
import type { JPPath } from './path';

/**
 * Generator that yields all nodes in the tree with their paths.
 * Depth-first traversal.
 */
export function* traverseNodes(root: JPNode, path: JPPath = []): Generator<[JPNode, JPPath]> {
	yield [root, path];
	if (isElement(root)) {
		for (let i = 0; i < root.children.length; i++) {
			yield* traverseNodes(root.children[i], [...path, i]);
		}
	}
}

/**
 * Generator that yields only element nodes.
 */
export function* traverseElements(root: JPNode, path: JPPath = []): Generator<[JPElement, JPPath]> {
	if (isElement(root)) {
		yield [root, path];
		for (let i = 0; i < root.children.length; i++) {
			yield* traverseElements(root.children[i], [...path, i]);
		}
	}
}

/**
 * Generator that yields only text (leaf) nodes.
 */
export function* traverseTexts(root: JPNode, path: JPPath = []): Generator<[JPText, JPPath]> {
	if (isElement(root)) {
		for (let i = 0; i < root.children.length; i++) {
			yield* traverseTexts(root.children[i], [...path, i]);
		}
	} else if (root.type === 'text') {
		yield [root as JPText, path];
	}
}

/**
 * Generator that yields nodes matching a type filter.
 */
export function* traverseByType<T extends JPNode>(
	root: JPNode,
	nodeType: string,
	path: JPPath = [],
): Generator<[T, JPPath]> {
	if (root.type === nodeType) {
		yield [root as T, path];
	}
	if (isElement(root)) {
		for (let i = 0; i < root.children.length; i++) {
			yield* traverseByType<T>(root.children[i], nodeType, [...path, i]);
		}
	}
}

/**
 * Get ancestors of a node at a given path (from root to parent).
 */
export function getAncestors(root: JPNode, path: JPPath): [JPNode, JPPath][] {
	const ancestors: [JPNode, JPPath][] = [];
	let node = root;
	for (let i = 0; i < path.length; i++) {
		ancestors.push([node, path.slice(0, i)]);
		if (!isElement(node)) break;
		node = node.children[path[i]];
	}
	return ancestors;
}

/**
 * Get the parent element and index of a node at a given path.
 */
export function getParent(root: JPNode, path: JPPath): { parent: JPElement; index: number } | null {
	if (path.length === 0) return null;
	const parentPath = path.slice(0, -1);
	let node = root;
	for (const index of parentPath) {
		if (!isElement(node)) return null;
		node = node.children[index];
	}
	if (!isElement(node)) return null;
	return { parent: node, index: path[path.length - 1] };
}

/**
 * Find the first node matching a predicate.
 */
export function findNode(
	root: JPNode,
	predicate: (node: JPNode, path: JPPath) => boolean,
): [JPNode, JPPath] | null {
	for (const [node, path] of traverseNodes(root)) {
		if (predicate(node, path)) return [node, path];
	}
	return null;
}

/**
 * Count all text characters in the document.
 */
export function countText(root: JPNode): number {
	let count = 0;
	for (const [text] of traverseTexts(root)) {
		count += text.text.length;
	}
	return count;
}

/**
 * Get the plain text content of a node.
 */
export function getPlainText(root: JPNode): string {
	const parts: string[] = [];
	for (const [text] of traverseTexts(root)) {
		parts.push(text.text);
	}
	return parts.join('');
}
