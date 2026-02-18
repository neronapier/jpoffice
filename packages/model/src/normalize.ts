import type { JPDocument } from './document';
import type { JPElement } from './nodes/node';
import { isElement } from './nodes/node';
import { generateId } from './nodes/node';
import type { JPParagraph } from './nodes/paragraph';
import type { JPRun } from './nodes/run';
import type { JPTableCell } from './nodes/table';
import type { JPText } from './nodes/text';
import type { JPOperation } from './operations/operation';

/**
 * Normalize a document to ensure structural validity.
 * Returns a list of operations needed to fix issues.
 *
 * Rules:
 * 1. Table cells must contain at least one paragraph.
 * 2. Paragraphs must contain at least one run with one text node.
 * 3. Adjacent text nodes within a run should be merged.
 * 4. Empty runs should be removed (unless they're the only run in a paragraph).
 */
export function getNormalizationOps(doc: JPDocument): JPOperation[] {
	const ops: JPOperation[] = [];
	normalizeNode(doc, [], ops);
	return ops;
}

/**
 * Compare two run properties for deep equality (used for Rule 3 merging).
 */
function runPropsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	return keysA.every((k) => a[k] === b[k]);
}

function normalizeNode(node: JPElement | JPDocument, path: number[], ops: JPOperation[]): void {
	if (!isElement(node)) return;

	// Rule 1: Table cells must have at least one paragraph
	if (node.type === 'table-cell') {
		const cell = node as JPTableCell;
		if (cell.children.length === 0) {
			const emptyParagraph: JPParagraph = {
				type: 'paragraph',
				id: generateId(),
				children: [],
				properties: {},
			};
			ops.push({
				type: 'insert_node',
				path: [...path, 0],
				node: emptyParagraph,
			});
		}
	}

	// Rule 2: Paragraphs must contain at least one run with one text node
	if (node.type === 'paragraph') {
		const para = node as JPParagraph;
		if (para.children.length === 0) {
			const emptyText: JPText = { type: 'text' as JPText['type'], id: generateId(), text: '' };
			const emptyRun: JPRun = {
				type: 'run',
				id: generateId(),
				children: [emptyText],
				properties: {},
			};
			ops.push({
				type: 'insert_node',
				path: [...path, 0],
				node: emptyRun,
			});
		}
	}

	// Rule 3: Adjacent text nodes within a run should be merged
	if (node.type === 'run') {
		const run = node as JPRun;
		for (let i = run.children.length - 1; i >= 1; i--) {
			const prev = run.children[i - 1];
			const curr = run.children[i];
			if (prev.type === 'text' && curr.type === 'text') {
				// Merge curr into prev by setting text property, then remove curr
				ops.push({
					type: 'set_properties',
					path: [...path, i - 1],
					properties: { text: prev.text + curr.text },
					oldProperties: { text: prev.text },
				});
				ops.push({
					type: 'remove_node',
					path: [...path, i],
					node: curr,
				});
			}
		}
	}

	// Rule 4: Empty runs should be removed (unless only run in paragraph)
	if (node.type === 'paragraph') {
		const para = node as JPParagraph;
		if (para.children.length > 1) {
			for (let i = para.children.length - 1; i >= 0; i--) {
				const child = para.children[i];
				if (child.type === 'run') {
					const run = child as JPRun;
					const isEmpty =
						run.children.length === 0 ||
						run.children.every((t) => t.type === 'text' && t.text === '');
					if (isEmpty) {
						ops.push({
							type: 'remove_node',
							path: [...path, i],
							node: child,
						});
					}
				}
			}
		}
	}

	// Rule 5: Merge adjacent runs with identical properties
	if (node.type === 'paragraph') {
		const para = node as JPParagraph;
		for (let i = para.children.length - 1; i >= 1; i--) {
			const prev = para.children[i - 1];
			const curr = para.children[i];
			if (prev.type === 'run' && curr.type === 'run') {
				const prevRun = prev as JPRun;
				const currRun = curr as JPRun;
				if (
					runPropsEqual(
						prevRun.properties as unknown as Record<string, unknown>,
						currRun.properties as unknown as Record<string, unknown>,
					)
				) {
					ops.push({
						type: 'merge_node',
						path: [...path, i],
						position: prevRun.children.length,
						properties: {},
					});
				}
			}
		}
	}

	// Recurse into children
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (isElement(child)) {
			normalizeNode(child, [...path, i], ops);
		}
	}
}

/**
 * Quick check if a document needs normalization.
 */
export function needsNormalization(doc: JPDocument): boolean {
	return getNormalizationOps(doc).length > 0;
}
