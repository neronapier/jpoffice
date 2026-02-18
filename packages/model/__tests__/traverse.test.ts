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
	traverseNodes,
	traverseTexts,
	traverseByType,
	getAncestors,
	getParent,
	findNode,
	countText,
	getPlainText,
	DEFAULT_SECTION_PROPERTIES,
} from '../src';
import type { JPDocument, JPRun } from '../src';

function makeDoc(): JPDocument {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), [
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Hello')]),
					createRun(generateId(), [createText(generateId(), ' World')]),
				]),
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Second paragraph')]),
				]),
			], DEFAULT_SECTION_PROPERTIES),
		]),
	});
}

describe('Traverse utilities', () => {
	beforeEach(() => {
		resetIdCounter();
	});

	describe('traverseNodes', () => {
		it('visits all nodes', () => {
			const doc = makeDoc();
			const nodes = [...traverseNodes(doc)];
			// document, body, section, paragraph1, run1, text1, run2, text2,
			// paragraph2, run3, text3 = 11 nodes
			expect(nodes.length).toBe(11);
		});
	});

	describe('traverseTexts', () => {
		it('yields only text nodes', () => {
			const doc = makeDoc();
			const texts = [...traverseTexts(doc)];
			expect(texts.length).toBe(3);
			expect(texts[0][0].text).toBe('Hello');
			expect(texts[1][0].text).toBe(' World');
			expect(texts[2][0].text).toBe('Second paragraph');
		});
	});

	describe('traverseByType', () => {
		it('yields only runs', () => {
			const doc = makeDoc();
			const runs = [...traverseByType<JPRun>(doc, 'run')];
			expect(runs.length).toBe(3);
		});
	});

	describe('getAncestors', () => {
		it('returns ancestors from root to parent', () => {
			const doc = makeDoc();
			const path = [0, 0, 0, 0, 0]; // first text node
			const ancestors = getAncestors(doc, path);
			expect(ancestors.length).toBe(5); // doc, body, section, paragraph, run
			expect(ancestors[0][0].type).toBe('document');
			expect(ancestors[1][0].type).toBe('body');
			expect(ancestors[2][0].type).toBe('section');
			expect(ancestors[3][0].type).toBe('paragraph');
			expect(ancestors[4][0].type).toBe('run');
		});
	});

	describe('getParent', () => {
		it('returns parent and index', () => {
			const doc = makeDoc();
			const result = getParent(doc, [0, 0, 1]); // second paragraph
			expect(result).not.toBeNull();
			expect(result!.parent.type).toBe('section');
			expect(result!.index).toBe(1);
		});

		it('returns null for root', () => {
			const doc = makeDoc();
			expect(getParent(doc, [])).toBeNull();
		});
	});

	describe('findNode', () => {
		it('finds a node by predicate', () => {
			const doc = makeDoc();
			const result = findNode(doc, (node) => {
				return node.type === 'text' && (node as { text: string }).text === ' World';
			});
			expect(result).not.toBeNull();
			expect(result![0].type).toBe('text');
		});

		it('returns null when no match', () => {
			const doc = makeDoc();
			const result = findNode(doc, () => false);
			expect(result).toBeNull();
		});
	});

	describe('countText', () => {
		it('counts all characters', () => {
			const doc = makeDoc();
			expect(countText(doc)).toBe('Hello World'.length + 'Second paragraph'.length);
		});
	});

	describe('getPlainText', () => {
		it('returns concatenated text', () => {
			const doc = makeDoc();
			expect(getPlainText(doc)).toBe('Hello WorldSecond paragraph');
		});
	});
});
