import { describe, it, expect } from 'vitest';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	createTable,
	createTableRow,
	createTableCell,
	generateId,
	DEFAULT_SECTION_PROPERTIES,
	getNormalizationOps,
	needsNormalization,
} from '../src/index';

function makeDoc(sections: ReturnType<typeof createSection>[]) {
	const body = createBody(generateId(), sections);
	return createDocument({ id: generateId(), body });
}

function makeSection(blocks: Parameters<typeof createSection>[1]) {
	return createSection(generateId(), blocks, DEFAULT_SECTION_PROPERTIES);
}

describe('getNormalizationOps', () => {
	it('returns empty for a valid document', () => {
		const doc = makeDoc([
			makeSection([
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Hello')]),
				]),
			]),
		]);
		const ops = getNormalizationOps(doc);
		expect(ops).toEqual([]);
	});

	describe('Rule 1: Table cells must have at least one paragraph', () => {
		it('inserts paragraph into empty table cell', () => {
			const cell = createTableCell(generateId(), []);
			const row = createTableRow(generateId(), [cell]);
			const table = createTable(generateId(), [row]);
			const doc = makeDoc([makeSection([table])]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'insert_node')).toBe(true);
		});

		it('does not touch non-empty table cell', () => {
			const para = createParagraph(generateId(), [
				createRun(generateId(), [createText(generateId(), 'x')]),
			]);
			const cell = createTableCell(generateId(), [para]);
			const row = createTableRow(generateId(), [cell]);
			const table = createTable(generateId(), [row]);
			const doc = makeDoc([makeSection([table])]);
			const ops = getNormalizationOps(doc);
			// Should not have insert for cell
			const cellOps = ops.filter((op) => op.type === 'insert_node');
			expect(cellOps.length).toBe(0);
		});
	});

	describe('Rule 2: Paragraphs must have at least one run', () => {
		it('inserts run into empty paragraph', () => {
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [])]),
			]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'insert_node')).toBe(true);
		});
	});

	describe('Rule 3: Adjacent text nodes should be merged', () => {
		it('merges adjacent text nodes in a run', () => {
			const run = createRun(generateId(), [
				createText(generateId(), 'Hello'),
				createText(generateId(), ' World'),
			]);
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [run])]),
			]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'set_properties')).toBe(true);
			expect(ops.some((op) => op.type === 'remove_node')).toBe(true);
		});

		it('does not merge single text node', () => {
			const run = createRun(generateId(), [
				createText(generateId(), 'Hello'),
			]);
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [run])]),
			]);
			const ops = getNormalizationOps(doc);
			const setPropsOps = ops.filter((op) => op.type === 'set_properties');
			expect(setPropsOps.length).toBe(0);
		});
	});

	describe('Rule 4: Empty runs should be removed', () => {
		it('removes empty run when paragraph has other runs', () => {
			const emptyRun = createRun(generateId(), []);
			const goodRun = createRun(generateId(), [createText(generateId(), 'Hi')]);
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [emptyRun, goodRun])]),
			]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'remove_node')).toBe(true);
		});

		it('does not remove the only run in a paragraph', () => {
			const emptyRun = createRun(generateId(), []);
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [emptyRun])]),
			]);
			const ops = getNormalizationOps(doc);
			// Should not remove the only run (rule 4 exception)
			const removeOps = ops.filter((op) => op.type === 'remove_node');
			expect(removeOps.length).toBe(0);
		});
	});

	describe('Rule 5: Merge adjacent runs with identical properties', () => {
		it('merges adjacent runs with same properties', () => {
			const run1 = createRun(generateId(), [createText(generateId(), 'Hello')], { bold: true });
			const run2 = createRun(generateId(), [createText(generateId(), ' World')], { bold: true });
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [run1, run2])]),
			]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'merge_node')).toBe(true);
		});

		it('does not merge runs with different properties', () => {
			const run1 = createRun(generateId(), [createText(generateId(), 'Hello')], { bold: true });
			const run2 = createRun(generateId(), [createText(generateId(), ' World')], { italic: true });
			const doc = makeDoc([
				makeSection([createParagraph(generateId(), [run1, run2])]),
			]);
			const ops = getNormalizationOps(doc);
			expect(ops.some((op) => op.type === 'merge_node')).toBe(false);
		});
	});
});

describe('needsNormalization', () => {
	it('returns false for valid document', () => {
		const doc = makeDoc([
			makeSection([
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'OK')]),
				]),
			]),
		]);
		expect(needsNormalization(doc)).toBe(false);
	});

	it('returns true for document with empty paragraph', () => {
		const doc = makeDoc([
			makeSection([createParagraph(generateId(), [])]),
		]);
		expect(needsNormalization(doc)).toBe(true);
	});
});
