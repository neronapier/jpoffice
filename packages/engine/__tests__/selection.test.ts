import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../src/selection/selection-manager';
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

// Path: doc -> body -> section -> paragraph -> run -> text
const TEXT_PATH = [0, 0, 0, 0, 0];

function makeDoc(text = 'Hello World') {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), [
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), text)]),
				]),
			], DEFAULT_SECTION_PROPERTIES),
		]),
	});
}

function makeMultiParagraphDoc() {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), [
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'First paragraph')]),
				]),
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Second paragraph')]),
				]),
				createParagraph(generateId(), [
					createRun(generateId(), [createText(generateId(), 'Third paragraph')]),
				]),
			], DEFAULT_SECTION_PROPERTIES),
		]),
	});
}

describe('SelectionManager', () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it('collapse creates a collapsed selection', () => {
		const sel = SelectionManager.collapse(TEXT_PATH, 3);
		expect(sel.anchor).toEqual({ path: TEXT_PATH, offset: 3 });
		expect(sel.focus).toEqual({ path: TEXT_PATH, offset: 3 });
	});

	it('createRange creates a range selection', () => {
		const sel = SelectionManager.createRange(TEXT_PATH, 0, TEXT_PATH, 5);
		expect(sel.anchor.offset).toBe(0);
		expect(sel.focus.offset).toBe(5);
	});

	it('isCollapsed returns true for collapsed selection', () => {
		const sel = SelectionManager.collapse(TEXT_PATH, 3);
		expect(SelectionManager.isCollapsed(sel)).toBe(true);
	});

	it('isCollapsed returns false for range selection', () => {
		const sel = SelectionManager.createRange(TEXT_PATH, 0, TEXT_PATH, 5);
		expect(SelectionManager.isCollapsed(sel)).toBe(false);
	});

	it('isCollapsed returns false for cross-path range', () => {
		const sel = SelectionManager.createRange([0, 0], 0, [0, 1], 0);
		expect(SelectionManager.isCollapsed(sel)).toBe(false);
	});

	it('getSelectedText returns empty for collapsed', () => {
		const doc = makeDoc();
		const sel = SelectionManager.collapse(TEXT_PATH, 3);
		expect(SelectionManager.getSelectedText(doc, sel)).toBe('');
	});

	it('getSelectedText returns text for same-node selection', () => {
		const doc = makeDoc('Hello World');
		const sel = SelectionManager.createRange(TEXT_PATH, 0, TEXT_PATH, 5);
		expect(SelectionManager.getSelectedText(doc, sel)).toBe('Hello');
	});

	it('getSelectedText returns text for range within same node', () => {
		const doc = makeDoc('Hello World');
		const sel = SelectionManager.createRange(TEXT_PATH, 6, TEXT_PATH, 11);
		expect(SelectionManager.getSelectedText(doc, sel)).toBe('World');
	});

	it('normalize keeps forward selection unchanged', () => {
		const sel = SelectionManager.createRange([0, 0], 0, [0, 1], 3);
		const normalized = SelectionManager.normalize(sel);
		expect(normalized.anchor.path).toEqual([0, 0]);
		expect(normalized.focus.path).toEqual([0, 1]);
	});

	it('normalize reverses backward selection', () => {
		const sel = SelectionManager.createRange([0, 1], 3, [0, 0], 0);
		const normalized = SelectionManager.normalize(sel);
		expect(normalized.anchor.path).toEqual([0, 0]);
		expect(normalized.focus.path).toEqual([0, 1]);
	});

	it('normalize handles same-path by offset', () => {
		const sel = SelectionManager.createRange([0, 0], 5, [0, 0], 2);
		const normalized = SelectionManager.normalize(sel);
		expect(normalized.anchor.offset).toBe(2);
		expect(normalized.focus.offset).toBe(5);
	});

	it('getSelectedText returns text across paragraphs', () => {
		const doc = makeMultiParagraphDoc();
		// First paragraph text: [0, 0, 0, 0, 0] = "First paragraph"
		// Second paragraph text: [0, 0, 1, 0, 0] = "Second paragraph"
		const sel = SelectionManager.createRange(
			[0, 0, 0, 0, 0], 6, // "paragraph" in first
			[0, 0, 1, 0, 0], 6, // "paragraph" in second
		);
		const text = SelectionManager.getSelectedText(doc, sel);
		expect(text).toContain('paragraph');
		expect(text).toContain('\n');
		expect(text).toContain('Second');
	});

	it('getSelectedText returns text across three paragraphs', () => {
		const doc = makeMultiParagraphDoc();
		const sel = SelectionManager.createRange(
			[0, 0, 0, 0, 0], 0, // Start of first paragraph
			[0, 0, 2, 0, 0], 5, // "Third" in third paragraph
		);
		const text = SelectionManager.getSelectedText(doc, sel);
		expect(text).toContain('First paragraph');
		expect(text).toContain('Second paragraph');
		expect(text).toContain('Third');
	});

	it('getSelectedText handles backward cross-paragraph selection', () => {
		const doc = makeMultiParagraphDoc();
		// Backward: focus is before anchor
		const sel = SelectionManager.createRange(
			[0, 0, 1, 0, 0], 6, // focus in second
			[0, 0, 0, 0, 0], 6, // anchor in first
		);
		const text = SelectionManager.getSelectedText(doc, sel);
		expect(text).toContain('paragraph');
		expect(text).toContain('\n');
	});
});
