import type { JPDocument } from '../document';
import type { JPNode } from '../nodes/node';
import { isElement } from '../nodes/node';
import { isText } from '../nodes/text';
import type { JPPath } from '../path';
import type { JPOperation } from './operation';

/**
 * Apply a single operation to a document, returning a new document.
 * This is the ONLY way the document tree should be mutated.
 * The original document is never modified (immutable update).
 */
export function applyOperation(doc: JPDocument, op: JPOperation): JPDocument {
	switch (op.type) {
		case 'insert_text':
			return applyInsertText(doc, op.path, op.offset, op.text);
		case 'delete_text':
			return applyDeleteText(doc, op.path, op.offset, op.text.length);
		case 'insert_node':
			return applyInsertNode(doc, op.path, op.node);
		case 'remove_node':
			return applyRemoveNode(doc, op.path);
		case 'split_node':
			return applySplitNode(doc, op.path, op.position, op.properties);
		case 'merge_node':
			return applyMergeNode(doc, op.path, op.position);
		case 'move_node':
			return applyMoveNode(doc, op.path, op.newPath);
		case 'set_properties':
			return applySetProperties(doc, op.path, op.properties);
		case 'set_selection':
			// Selection is not part of the document tree
			return doc;
	}
}

/**
 * Get a node at a specific path in the tree.
 */
export function getNodeAtPath(root: JPNode, path: JPPath): JPNode {
	let node: JPNode = root;
	for (const index of path) {
		if (!isElement(node)) {
			throw new Error(`Cannot traverse into leaf node at path index ${index}`);
		}
		const child = node.children[index];
		if (!child) {
			throw new Error(`Child index ${index} out of bounds (${node.children.length} children)`);
		}
		node = child;
	}
	return node;
}

/**
 * Update a node at a path, creating a new tree with structural sharing.
 */
function updateAtPath(
	root: JPDocument,
	path: JPPath,
	updater: (node: JPNode) => JPNode,
): JPDocument {
	if (path.length === 0) {
		return updater(root) as JPDocument;
	}

	function recurse(node: JPNode, depth: number): JPNode {
		if (depth === path.length) {
			return updater(node);
		}

		if (!isElement(node)) {
			throw new Error(`Cannot traverse into leaf node at depth ${depth}`);
		}

		const index = path[depth];
		const children = [...node.children];
		children[index] = recurse(children[index], depth + 1);
		return { ...node, children } as unknown as JPNode;
	}

	return recurse(root, 0) as unknown as JPDocument;
}

/**
 * Update children of the parent node at `path[:-1]`.
 */
function updateParentChildren(
	root: JPDocument,
	path: JPPath,
	updater: (children: readonly JPNode[], index: number) => readonly JPNode[],
): JPDocument {
	const parentPath = path.slice(0, -1);
	const childIndex = path[path.length - 1];

	return updateAtPath(root, parentPath, (parent) => {
		if (!isElement(parent)) {
			throw new Error('Parent is not an element');
		}
		const newChildren = updater(parent.children, childIndex);
		return { ...parent, children: newChildren } as unknown as JPNode;
	});
}

// -- Operation implementations --

function applyInsertText(doc: JPDocument, path: JPPath, offset: number, text: string): JPDocument {
	return updateAtPath(doc, path, (node) => {
		if (!isText(node)) {
			throw new Error('insert_text target is not a text node');
		}
		const newText = node.text.slice(0, offset) + text + node.text.slice(offset);
		return { ...node, text: newText } as unknown as JPNode;
	});
}

function applyDeleteText(
	doc: JPDocument,
	path: JPPath,
	offset: number,
	length: number,
): JPDocument {
	return updateAtPath(doc, path, (node) => {
		if (!isText(node)) {
			throw new Error('delete_text target is not a text node');
		}
		const newText = node.text.slice(0, offset) + node.text.slice(offset + length);
		return { ...node, text: newText } as unknown as JPNode;
	});
}

function applyInsertNode(doc: JPDocument, path: JPPath, node: JPNode): JPDocument {
	return updateParentChildren(doc, path, (children, index) => {
		const newChildren = [...children];
		newChildren.splice(index, 0, node);
		return newChildren;
	});
}

function applyRemoveNode(doc: JPDocument, path: JPPath): JPDocument {
	return updateParentChildren(doc, path, (children, index) => {
		const newChildren = [...children];
		newChildren.splice(index, 1);
		return newChildren;
	});
}

function applySplitNode(
	doc: JPDocument,
	path: JPPath,
	position: number,
	properties: Record<string, unknown>,
): JPDocument {
	return updateParentChildren(doc, path, (children, index) => {
		const node = children[index];

		if (isElement(node)) {
			const firstChildren = node.children.slice(0, position);
			const secondChildren = node.children.slice(position);
			const first = { ...node, children: firstChildren } as unknown as JPNode;
			const second = { ...node, ...properties, children: secondChildren } as unknown as JPNode;

			const newChildren = [...children];
			newChildren.splice(index, 1, first, second);
			return newChildren;
		}

		// Split text node
		if (isText(node)) {
			const first = { ...node, text: node.text.slice(0, position) } as unknown as JPNode;
			const second = {
				...node,
				...properties,
				text: node.text.slice(position),
			} as unknown as JPNode;

			const newChildren = [...children];
			newChildren.splice(index, 1, first, second);
			return newChildren;
		}

		throw new Error('Cannot split a non-text leaf node');
	});
}

function applyMergeNode(doc: JPDocument, path: JPPath, _position: number): JPDocument {
	return updateParentChildren(doc, path, (children, index) => {
		const prev = children[index - 1];
		const current = children[index];

		if (!prev) {
			throw new Error('Cannot merge: no previous sibling');
		}

		let merged: JPNode;

		if (isElement(prev) && isElement(current)) {
			merged = {
				...prev,
				children: [...prev.children, ...current.children],
			} as unknown as JPNode;
		} else if (isText(prev) && isText(current)) {
			merged = { ...prev, text: prev.text + current.text } as unknown as JPNode;
		} else {
			throw new Error('Cannot merge nodes of different types');
		}

		const newChildren = [...children];
		newChildren.splice(index - 1, 2, merged);
		return newChildren;
	});
}

function applyMoveNode(doc: JPDocument, from: JPPath, to: JPPath): JPDocument {
	const node = getNodeAtPath(doc, from);
	let result = applyRemoveNode(doc, from);
	const adjustedTo = adjustPathForRemove(to, from);
	result = applyInsertNode(result, adjustedTo, node);
	return result;
}

function applySetProperties(
	doc: JPDocument,
	path: JPPath,
	properties: Record<string, unknown>,
): JPDocument {
	return updateAtPath(doc, path, (node) => {
		const nodeAny = node as unknown as Record<string, unknown>;
		const current = (nodeAny.properties ?? {}) as Record<string, unknown>;
		const newProps = { ...current };
		for (const [key, value] of Object.entries(properties)) {
			if (value === null) {
				delete newProps[key];
			} else {
				newProps[key] = value;
			}
		}
		return { ...nodeAny, properties: newProps } as unknown as JPNode;
	});
}

/**
 * Adjust a path after a node removal.
 */
function adjustPathForRemove(path: JPPath, removedPath: JPPath): JPPath {
	if (removedPath.length > path.length) return path;

	const commonLen = removedPath.length - 1;
	for (let i = 0; i < commonLen; i++) {
		if (path[i] !== removedPath[i]) return path;
	}

	const level = removedPath.length - 1;
	if (path[level] >= removedPath[level]) {
		const result = [...path];
		result[level]--;
		return result;
	}

	return path;
}
