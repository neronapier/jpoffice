import { describe, it, expect, beforeEach } from 'vitest';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	resetIdCounter,
	applyOperation,
	getNodeAtPath,
	invertOperation,
	DEFAULT_SECTION_PROPERTIES,
} from '../src';
import type { JPDocument, JPOperation } from '../src';

function makeSimpleDoc(): JPDocument {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), [
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Hello World')]),
				]),
			], DEFAULT_SECTION_PROPERTIES),
		]),
	});
}

describe('Operations', () => {
	beforeEach(() => {
		resetIdCounter();
	});

	describe('insert_text', () => {
		it('inserts text at offset', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'insert_text',
				path: [0, 0, 0, 0, 0], // body -> section -> paragraph -> run -> text
				offset: 5,
				text: ',',
			};
			const result = applyOperation(doc, op);
			const textNode = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Hello, World');
		});

		it('inserts text at start', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'insert_text',
				path: [0, 0, 0, 0, 0],
				offset: 0,
				text: '¡',
			};
			const result = applyOperation(doc, op);
			const textNode = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('¡Hello World');
		});

		it('inserts text at end', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'insert_text',
				path: [0, 0, 0, 0, 0],
				offset: 11,
				text: '!',
			};
			const result = applyOperation(doc, op);
			const textNode = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Hello World!');
		});
	});

	describe('delete_text', () => {
		it('deletes text at offset', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'delete_text',
				path: [0, 0, 0, 0, 0],
				offset: 5,
				text: ' World',
			};
			const result = applyOperation(doc, op);
			const textNode = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Hello');
		});
	});

	describe('insert_node', () => {
		it('inserts a new paragraph', () => {
			const doc = makeSimpleDoc();
			const newParagraph = createParagraph(generateId(), [
				createRun(generateId(), [createText(generateId(), 'New paragraph')]),
			]);
			const op: JPOperation = {
				type: 'insert_node',
				path: [0, 0, 1], // body -> section -> second child
				node: newParagraph,
			};
			const result = applyOperation(doc, op);
			const section = getNodeAtPath(result, [0, 0]);
			expect((section as { children: unknown[] }).children.length).toBe(2);
		});
	});

	describe('remove_node', () => {
		it('removes a paragraph', () => {
			const doc = makeSimpleDoc();
			// First add a second paragraph
			const newParagraph = createParagraph(generateId(), [
				createRun(generateId(), [createText(generateId(), 'Second')]),
			]);
			const insertOp: JPOperation = {
				type: 'insert_node',
				path: [0, 0, 1],
				node: newParagraph,
			};
			let result = applyOperation(doc, insertOp);

			// Then remove the first paragraph
			const removeOp: JPOperation = {
				type: 'remove_node',
				path: [0, 0, 0],
				node: getNodeAtPath(result, [0, 0, 0]),
			};
			result = applyOperation(result, removeOp);

			const section = getNodeAtPath(result, [0, 0]);
			expect((section as { children: unknown[] }).children.length).toBe(1);
			const textNode = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Second');
		});
	});

	describe('set_properties', () => {
		it('updates run properties', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'set_properties',
				path: [0, 0, 0, 0], // body -> section -> paragraph -> run
				properties: { bold: true, fontSize: 28 },
				oldProperties: {},
			};
			const result = applyOperation(doc, op);
			const run = getNodeAtPath(result, [0, 0, 0, 0]);
			const props = (run as { properties: Record<string, unknown> }).properties;
			expect(props.bold).toBe(true);
			expect(props.fontSize).toBe(28);
		});
	});

	describe('split_node', () => {
		it('splits a text node', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'split_node',
				path: [0, 0, 0, 0, 0], // text node
				position: 5,
				properties: {},
			};
			const result = applyOperation(doc, op);
			const run = getNodeAtPath(result, [0, 0, 0, 0]);
			expect((run as { children: unknown[] }).children.length).toBe(2);
			const text1 = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			const text2 = getNodeAtPath(result, [0, 0, 0, 0, 1]);
			expect((text1 as { text: string }).text).toBe('Hello');
			expect((text2 as { text: string }).text).toBe(' World');
		});
	});

	describe('merge_node', () => {
		it('merges text nodes', () => {
			const doc = makeSimpleDoc();
			// First split, then merge back
			const splitOp: JPOperation = {
				type: 'split_node',
				path: [0, 0, 0, 0, 0],
				position: 5,
				properties: {},
			};
			let result = applyOperation(doc, splitOp);

			const mergeOp: JPOperation = {
				type: 'merge_node',
				path: [0, 0, 0, 0, 1], // second text node merges into first
				position: 5,
				properties: {},
			};
			result = applyOperation(result, mergeOp);

			const run = getNodeAtPath(result, [0, 0, 0, 0]);
			expect((run as { children: unknown[] }).children.length).toBe(1);
			const text = getNodeAtPath(result, [0, 0, 0, 0, 0]);
			expect((text as { text: string }).text).toBe('Hello World');
		});
	});

	describe('invertOperation roundtrip', () => {
		it('undo insert_text restores original', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'insert_text',
				path: [0, 0, 0, 0, 0],
				offset: 5,
				text: ',',
			};
			const modified = applyOperation(doc, op);
			const inverse = invertOperation(op);
			const restored = applyOperation(modified, inverse);
			const textNode = getNodeAtPath(restored, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Hello World');
		});

		it('undo delete_text restores original', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'delete_text',
				path: [0, 0, 0, 0, 0],
				offset: 5,
				text: ' World',
			};
			const modified = applyOperation(doc, op);
			const inverse = invertOperation(op);
			const restored = applyOperation(modified, inverse);
			const textNode = getNodeAtPath(restored, [0, 0, 0, 0, 0]);
			expect((textNode as { text: string }).text).toBe('Hello World');
		});

		it('undo set_properties restores original', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'set_properties',
				path: [0, 0, 0, 0],
				properties: { bold: true },
				oldProperties: { bold: null }, // null means "was not set"
			};
			const modified = applyOperation(doc, op);
			const inverse = invertOperation(op);
			const restored = applyOperation(modified, inverse);
			const run = getNodeAtPath(restored, [0, 0, 0, 0]);
			const props = (run as { properties: Record<string, unknown> }).properties;
			expect(props.bold).toBeUndefined();
		});
	});

	describe('structural sharing', () => {
		it('preserves unchanged subtrees by reference', () => {
			const doc = makeSimpleDoc();
			const op: JPOperation = {
				type: 'insert_text',
				path: [0, 0, 0, 0, 0],
				offset: 0,
				text: 'X',
			};
			const result = applyOperation(doc, op);

			// The document is different
			expect(result).not.toBe(doc);
			// But the styles, numbering, etc. are the same object
			expect(result.styles).toBe(doc.styles);
			expect(result.numbering).toBe(doc.numbering);
			expect(result.metadata).toBe(doc.metadata);
		});
	});
});
