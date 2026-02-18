import type {
	JPDocument,
	JPNode,
	JPOperation,
	JPParagraph,
	JPPath,
	JPPoint,
	JPRange,
	JPRun,
	JPSection,
	JPText,
} from '@jpoffice/model';
import {
	comparePaths,
	getNodeAtPath,
	isElement,
	parentPath,
	pathEquals,
	traverseTexts,
} from '@jpoffice/model';

// ── Selection Context ──────────────────────────────────────────────

export interface SelectionContext {
	readonly textNode: JPText;
	readonly textPath: JPPath;
	readonly offset: number;
	readonly run: JPRun;
	readonly runPath: JPPath;
	readonly runIndex: number;
	readonly paragraph: JPParagraph;
	readonly paragraphPath: JPPath;
	readonly paragraphIndex: number;
	readonly section: JPSection;
	readonly sectionPath: JPPath;
}

export interface RangeContext {
	readonly anchor: SelectionContext;
	readonly focus: SelectionContext;
	readonly isCollapsed: boolean;
	readonly isForward: boolean;
}

/**
 * Resolve a selection point to its full context (text, run, paragraph, section).
 * The point.path must point to a JPText node.
 */
export function resolveSelectionContext(doc: JPDocument, point: JPPoint): SelectionContext {
	const textPath = point.path;
	const textNode = getNodeAtPath(doc, textPath) as JPText;

	// Path: [bodyIdx, sectionIdx, paragraphIdx, runIdx, textIdx]
	// Or deeper in tables: [..., cellIdx, paragraphIdx, runIdx, textIdx]
	// We walk up to find run, paragraph, section
	const runPath = parentPath(textPath);
	const run = getNodeAtPath(doc, runPath) as JPRun;

	const paragraphPath = parentPath(runPath);
	const paragraph = getNodeAtPath(doc, paragraphPath) as JPParagraph;

	// Walk up to find section — it's the first 'section' ancestor
	let sectionPath: JPPath = [];
	let section: JPSection | null = null;
	let paragraphIndex = 0;

	// The paragraph's parent could be a section or a table-cell
	const paraParentPath = parentPath(paragraphPath);
	const paraParent = getNodeAtPath(doc, paraParentPath);
	if (paraParent.type === 'section') {
		section = paraParent as JPSection;
		sectionPath = paraParentPath;
		paragraphIndex = paragraphPath[paragraphPath.length - 1];
	} else {
		// Inside a table cell — walk further up to find section
		let current: JPNode = doc;
		for (let i = 0; i < paragraphPath.length; i++) {
			if (current.type === 'section') {
				section = current as JPSection;
				sectionPath = paragraphPath.slice(0, i);
				break;
			}
			if (isElement(current)) {
				current = current.children[paragraphPath[i]];
			}
		}
		paragraphIndex = paragraphPath[paragraphPath.length - 1];
	}

	if (!section) {
		// Fallback: use body's first section
		const body = doc.children[0];
		section = (isElement(body) ? body.children[0] : body) as JPSection;
		sectionPath = [0, 0];
	}

	return {
		textNode,
		textPath,
		offset: point.offset,
		run,
		runPath,
		runIndex: runPath[runPath.length - 1],
		paragraph,
		paragraphPath,
		paragraphIndex,
		section,
		sectionPath,
	};
}

/**
 * Resolve both endpoints of a range selection.
 */
export function resolveRangeContext(doc: JPDocument, selection: JPRange): RangeContext {
	const anchor = resolveSelectionContext(doc, selection.anchor);
	const focus = resolveSelectionContext(doc, selection.focus);

	const cmp = comparePaths(selection.anchor.path, selection.focus.path);
	const isForward = cmp < 0 || (cmp === 0 && selection.anchor.offset <= selection.focus.offset);
	const isCollapsed =
		pathEquals(selection.anchor.path, selection.focus.path) &&
		selection.anchor.offset === selection.focus.offset;

	return { anchor, focus, isCollapsed, isForward };
}

// ── Text Node Navigation ───────────────────────────────────────────

/**
 * Find the previous text node in document order.
 */
export function previousTextNode(
	doc: JPDocument,
	currentPath: JPPath,
): { path: JPPath; node: JPText } | null {
	let found: { path: JPPath; node: JPText } | null = null;
	for (const [node, path] of traverseTexts(doc)) {
		if (pathEquals(path, currentPath)) {
			return found;
		}
		found = { path, node };
	}
	return null;
}

/**
 * Find the next text node in document order.
 */
export function nextTextNode(
	doc: JPDocument,
	currentPath: JPPath,
): { path: JPPath; node: JPText } | null {
	let returnNext = false;
	for (const [node, path] of traverseTexts(doc)) {
		if (returnNext) {
			return { path, node };
		}
		if (pathEquals(path, currentPath)) {
			returnNext = true;
		}
	}
	return null;
}

/**
 * Find the first text node in the document.
 */
export function firstTextNode(doc: JPDocument): { path: JPPath; node: JPText } | null {
	for (const [node, path] of traverseTexts(doc)) {
		return { path, node };
	}
	return null;
}

/**
 * Find the last text node in the document.
 */
export function lastTextNode(doc: JPDocument): { path: JPPath; node: JPText } | null {
	let last: { path: JPPath; node: JPText } | null = null;
	for (const [node, path] of traverseTexts(doc)) {
		last = { path, node };
	}
	return last;
}

// ── Word Boundary ──────────────────────────────────────────────────

const WORD_SEPARATORS = /[\s,.;:!?'"()[\]{}<>\/\\|@#$%^&*~`+=\-_]/;

/**
 * Find the next word boundary in the given direction.
 */
export function findWordBoundary(
	text: string,
	offset: number,
	direction: 'forward' | 'backward',
): number {
	if (direction === 'forward') {
		let i = offset;
		// Skip current word characters
		while (i < text.length && !WORD_SEPARATORS.test(text[i])) i++;
		// Skip separators
		while (i < text.length && WORD_SEPARATORS.test(text[i])) i++;
		return i;
	}
	// backward
	let i = offset;
	// Skip separators behind cursor
	while (i > 0 && WORD_SEPARATORS.test(text[i - 1])) i--;
	// Skip word characters
	while (i > 0 && !WORD_SEPARATORS.test(text[i - 1])) i--;
	return i;
}

// ── Range Queries ──────────────────────────────────────────────────

export interface RunInRange {
	readonly node: JPRun;
	readonly path: JPPath;
	readonly isPartial: boolean;
	readonly startOffset?: number;
	readonly endOffset?: number;
}

/**
 * Get all paragraphs that overlap with a selection range.
 */
export function getParagraphsInRange(
	doc: JPDocument,
	selection: JPRange,
): Array<{ node: JPParagraph; path: JPPath }> {
	const ctx = resolveRangeContext(doc, selection);
	const start = ctx.isForward ? ctx.anchor : ctx.focus;
	const end = ctx.isForward ? ctx.focus : ctx.anchor;

	const startParaPath = start.paragraphPath;
	const endParaPath = end.paragraphPath;

	if (pathEquals(startParaPath, endParaPath)) {
		return [{ node: start.paragraph, path: startParaPath }];
	}

	const result: Array<{ node: JPParagraph; path: JPPath }> = [];
	for (const [node, path] of traverseByTypeSafe(doc, 'paragraph')) {
		const cmpStart = comparePaths(path, startParaPath);
		const cmpEnd = comparePaths(path, endParaPath);
		if (cmpStart >= 0 && cmpEnd <= 0) {
			result.push({ node: node as JPParagraph, path });
		}
	}
	return result;
}

/**
 * Get all runs that overlap with a selection range.
 */
export function getRunsInRange(doc: JPDocument, selection: JPRange): RunInRange[] {
	const ctx = resolveRangeContext(doc, selection);
	const start = ctx.isForward ? ctx.anchor : ctx.focus;
	const end = ctx.isForward ? ctx.focus : ctx.anchor;

	// Same run
	if (pathEquals(start.runPath, end.runPath)) {
		return [
			{
				node: start.run,
				path: start.runPath,
				isPartial: true,
				startOffset: start.offset,
				endOffset: end.offset,
			},
		];
	}

	const result: RunInRange[] = [];
	for (const [node, path] of traverseByTypeSafe(doc, 'run')) {
		const cmpStart = comparePaths(path, start.runPath);
		const cmpEnd = comparePaths(path, end.runPath);
		if (cmpStart < 0 || cmpEnd > 0) continue;

		if (pathEquals(path, start.runPath)) {
			result.push({
				node: node as JPRun,
				path,
				isPartial: true,
				startOffset: start.offset,
				endOffset: undefined,
			});
		} else if (pathEquals(path, end.runPath)) {
			result.push({
				node: node as JPRun,
				path,
				isPartial: true,
				startOffset: 0,
				endOffset: end.offset,
			});
		} else {
			result.push({ node: node as JPRun, path, isPartial: false });
		}
	}
	return result;
}

// ── Delete Selection ───────────────────────────────────────────────

/**
 * Produce operations to delete the content within a range selection.
 * Returns the ops and the collapsed cursor point after deletion.
 */
export function deleteSelectionOps(
	doc: JPDocument,
	selection: JPRange,
): { ops: JPOperation[]; collapsedPoint: JPPoint } {
	const ctx = resolveRangeContext(doc, selection);
	if (ctx.isCollapsed) {
		return {
			ops: [],
			collapsedPoint: selection.anchor,
		};
	}

	const start = ctx.isForward ? ctx.anchor : ctx.focus;
	const end = ctx.isForward ? ctx.focus : ctx.anchor;
	const ops: JPOperation[] = [];

	// Case 1: Same text node
	if (pathEquals(start.textPath, end.textPath)) {
		const from = Math.min(start.offset, end.offset);
		const to = Math.max(start.offset, end.offset);
		const deletedText = start.textNode.text.slice(from, to);
		ops.push({
			type: 'delete_text',
			path: start.textPath,
			offset: from,
			text: deletedText,
		});
		return {
			ops,
			collapsedPoint: { path: start.textPath, offset: from },
		};
	}

	// Case 2: Same paragraph — delete text at edges, remove intermediate runs
	if (pathEquals(start.paragraphPath, end.paragraphPath)) {
		return deleteSameParagraph(start, end);
	}

	// Case 3: Cross-paragraph deletion
	return deleteCrossParagraph(doc, start, end);
}

function deleteSameParagraph(
	start: SelectionContext,
	end: SelectionContext,
): { ops: JPOperation[]; collapsedPoint: JPPoint } {
	const ops: JPOperation[] = [];

	// Delete from start offset to end of start text
	if (start.offset < start.textNode.text.length) {
		ops.push({
			type: 'delete_text',
			path: start.textPath,
			offset: start.offset,
			text: start.textNode.text.slice(start.offset),
		});
	}

	// Remove intermediate runs (between start run and end run, in reverse order)
	const startRunIdx = start.runIndex;
	const endRunIdx = end.runIndex;
	for (let i = endRunIdx - 1; i > startRunIdx; i--) {
		const runPath = [...start.paragraphPath, i];
		const run = start.paragraph.children[i];
		ops.push({ type: 'remove_node', path: runPath, node: run });
	}

	// Delete from start of end text to end offset
	if (end.offset > 0 && !pathEquals(start.runPath, end.runPath)) {
		// After removing intermediates, the end run shifts
		const adjustedEndRunIdx = startRunIdx + 1;
		const adjustedEndTextPath = [
			...start.paragraphPath,
			adjustedEndRunIdx,
			end.textPath[end.textPath.length - 1],
		];
		ops.push({
			type: 'delete_text',
			path: adjustedEndTextPath,
			offset: 0,
			text: end.textNode.text.slice(0, end.offset),
		});
	}

	return {
		ops,
		collapsedPoint: { path: start.textPath, offset: start.offset },
	};
}

function deleteCrossParagraph(
	_doc: JPDocument,
	start: SelectionContext,
	end: SelectionContext,
): { ops: JPOperation[]; collapsedPoint: JPPoint } {
	const ops: JPOperation[] = [];

	// 1. Delete from start offset to end of start text
	if (start.offset < start.textNode.text.length) {
		ops.push({
			type: 'delete_text',
			path: start.textPath,
			offset: start.offset,
			text: start.textNode.text.slice(start.offset),
		});
	}

	// 2. Remove runs after the start run in start paragraph (reverse order)
	for (let i = start.paragraph.children.length - 1; i > start.runIndex; i--) {
		const runPath = [...start.paragraphPath, i];
		ops.push({ type: 'remove_node', path: runPath, node: start.paragraph.children[i] });
	}

	// 3. Remove intermediate paragraphs (between start and end paragraph, reverse)
	// They must be siblings in the same section
	if (pathEquals(start.sectionPath, end.sectionPath)) {
		for (let i = end.paragraphIndex - 1; i > start.paragraphIndex; i--) {
			const paraPath = [...start.sectionPath, i];
			ops.push({ type: 'remove_node', path: paraPath, node: start.section.children[i] });
		}
	}

	// 4. Delete from start of end text to end offset
	if (end.offset > 0) {
		ops.push({
			type: 'delete_text',
			path: end.textPath,
			offset: 0,
			text: end.textNode.text.slice(0, end.offset),
		});
	}

	// 5. Remove runs before the end run in end paragraph
	// After intermediate para removal, end paragraph shifted
	const adjustedEndParaIdx = start.paragraphIndex + 1;
	const adjustedEndParaPath = [...start.sectionPath, adjustedEndParaIdx];

	for (let i = end.runIndex - 1; i >= 0; i--) {
		const runPath = [...adjustedEndParaPath, i];
		ops.push({ type: 'remove_node', path: runPath, node: end.paragraph.children[i] });
	}

	// 6. Merge end paragraph into start paragraph
	// After removing runs, the merge position = number of children left in start paragraph
	const mergePosition = start.runIndex + 1; // start run is still there
	ops.push({
		type: 'merge_node',
		path: adjustedEndParaPath,
		position: mergePosition,
		properties: {},
	});

	return {
		ops,
		collapsedPoint: { path: start.textPath, offset: start.offset },
	};
}

// ── Helper ─────────────────────────────────────────────────────────

function* traverseByTypeSafe(
	root: JPNode,
	nodeType: string,
	path: JPPath = [],
): Generator<[JPNode, JPPath]> {
	if (root.type === nodeType) {
		yield [root, path];
	}
	if (isElement(root)) {
		for (let i = 0; i < root.children.length; i++) {
			yield* traverseByTypeSafe(root.children[i], nodeType, [...path, i]);
		}
	}
}
