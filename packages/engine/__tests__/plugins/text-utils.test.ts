import { describe, it, expect, beforeEach } from 'vitest';
import {
	resolveSelectionContext,
	resolveRangeContext,
	previousTextNode,
	nextTextNode,
	firstTextNode,
	lastTextNode,
	findWordBoundary,
	deleteSelectionOps,
} from '../../src/plugins/text/text-utils';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	resetIdCounter,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';

const TEXT_PATH = [0, 0, 0, 0, 0];

function makeDoc(text = 'Hello World') {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(
				generateId(),
				[
					createParagraph(generateId(), [
						createRun(generateId(), [createText(generateId(), text)]),
					]),
				],
				DEFAULT_SECTION_PROPERTIES,
			),
		]),
	});
}

function makeTwoParaDoc(text1 = 'Hello', text2 = 'World') {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(
				generateId(),
				[
					createParagraph(generateId(), [
						createRun(generateId(), [createText(generateId(), text1)]),
					]),
					createParagraph(generateId(), [
						createRun(generateId(), [createText(generateId(), text2)]),
					]),
				],
				DEFAULT_SECTION_PROPERTIES,
			),
		]),
	});
}

describe('text-utils', () => {
	beforeEach(() => resetIdCounter());

	describe('resolveSelectionContext', () => {
		it('resolves a point to its context', () => {
			const doc = makeDoc('Hello');
			const ctx = resolveSelectionContext(doc, { path: TEXT_PATH, offset: 3 });

			expect(ctx.textNode.text).toBe('Hello');
			expect(ctx.offset).toBe(3);
			expect(ctx.textPath).toEqual(TEXT_PATH);
			expect(ctx.run.type).toBe('run');
			expect(ctx.paragraph.type).toBe('paragraph');
			expect(ctx.section.type).toBe('section');
		});
	});

	describe('resolveRangeContext', () => {
		it('detects collapsed selection', () => {
			const doc = makeDoc();
			const ctx = resolveRangeContext(doc, {
				anchor: { path: TEXT_PATH, offset: 3 },
				focus: { path: TEXT_PATH, offset: 3 },
			});

			expect(ctx.isCollapsed).toBe(true);
		});

		it('detects forward selection', () => {
			const doc = makeDoc();
			const ctx = resolveRangeContext(doc, {
				anchor: { path: TEXT_PATH, offset: 2 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			expect(ctx.isCollapsed).toBe(false);
			expect(ctx.isForward).toBe(true);
		});
	});

	describe('previousTextNode', () => {
		it('returns null for first text node', () => {
			const doc = makeDoc();
			expect(previousTextNode(doc, TEXT_PATH)).toBeNull();
		});

		it('finds previous text in two-paragraph doc', () => {
			const doc = makeTwoParaDoc('Hello', 'World');
			const result = previousTextNode(doc, [0, 0, 1, 0, 0]);
			expect(result).not.toBeNull();
			expect(result!.node.text).toBe('Hello');
		});
	});

	describe('nextTextNode', () => {
		it('returns null for last text node', () => {
			const doc = makeDoc();
			expect(nextTextNode(doc, TEXT_PATH)).toBeNull();
		});

		it('finds next text in two-paragraph doc', () => {
			const doc = makeTwoParaDoc('Hello', 'World');
			const result = nextTextNode(doc, TEXT_PATH);
			expect(result).not.toBeNull();
			expect(result!.node.text).toBe('World');
		});
	});

	describe('firstTextNode', () => {
		it('finds first text node', () => {
			const doc = makeTwoParaDoc('Hello', 'World');
			const result = firstTextNode(doc);
			expect(result).not.toBeNull();
			expect(result!.node.text).toBe('Hello');
		});
	});

	describe('lastTextNode', () => {
		it('finds last text node', () => {
			const doc = makeTwoParaDoc('Hello', 'World');
			const result = lastTextNode(doc);
			expect(result).not.toBeNull();
			expect(result!.node.text).toBe('World');
		});
	});

	describe('findWordBoundary', () => {
		it('finds forward word boundary', () => {
			expect(findWordBoundary('Hello World', 0, 'forward')).toBe(6);
		});

		it('finds backward word boundary', () => {
			expect(findWordBoundary('Hello World', 11, 'backward')).toBe(6);
		});

		it('handles end of text forward', () => {
			expect(findWordBoundary('Hello', 5, 'forward')).toBe(5);
		});

		it('handles start of text backward', () => {
			expect(findWordBoundary('Hello', 0, 'backward')).toBe(0);
		});
	});

	describe('deleteSelectionOps', () => {
		it('returns empty ops for collapsed selection', () => {
			const doc = makeDoc();
			const result = deleteSelectionOps(doc, {
				anchor: { path: TEXT_PATH, offset: 3 },
				focus: { path: TEXT_PATH, offset: 3 },
			});

			expect(result.ops).toHaveLength(0);
		});

		it('generates ops for same-text deletion', () => {
			const doc = makeDoc('Hello World');
			const result = deleteSelectionOps(doc, {
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			expect(result.ops.length).toBeGreaterThan(0);
			expect(result.ops[0].type).toBe('delete_text');
			expect(result.collapsedPoint.offset).toBe(5);
		});
	});
});
