import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { SelectionPlugin } from '../../src/plugins/selection/selection-plugin';
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

describe('SelectionPlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello World') {
		return new JPEditor({
			document: makeDoc(text),
			plugins: [new SelectionPlugin()],
		});
	}

	describe('selection.move ArrowLeft', () => {
		it('moves cursor left by one character', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowLeft',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(4);
		});

		it('does not move past start of document', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowLeft',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(0);
		});

		it('extends selection left', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowLeft',
				extend: true,
				word: false,
			});
			const sel = editor.getSelection()!;
			expect(sel.anchor.offset).toBe(5);
			expect(sel.focus.offset).toBe(4);
		});

		it('moves left by word', () => {
			const editor = createEditor('Hello World');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 11 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowLeft',
				extend: false,
				word: true,
			});
			// Should jump to start of "World" → offset 6
			expect(editor.getSelection()!.focus.offset).toBe(6);
		});
	});

	describe('selection.move ArrowRight', () => {
		it('moves cursor right by one character', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowRight',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(1);
		});

		it('does not move past end of document', () => {
			const editor = createEditor('Hi');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 2 },
				focus: { path: TEXT_PATH, offset: 2 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowRight',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(2);
		});
	});

	describe('selection.move Home', () => {
		it('moves cursor to start of paragraph', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('selection.move', {
				direction: 'Home',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(0);
		});
	});

	describe('selection.move End', () => {
		it('moves cursor to end of paragraph', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('selection.move', {
				direction: 'End',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.offset).toBe(5);
		});
	});

	describe('selection.move ArrowUp', () => {
		it('moves to previous paragraph', () => {
			const editor = new JPEditor({
				document: makeTwoParaDoc('Hello', 'World'),
				plugins: [new SelectionPlugin()],
			});
			editor.setSelection({
				anchor: { path: [0, 0, 1, 0, 0], offset: 3 },
				focus: { path: [0, 0, 1, 0, 0], offset: 3 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowUp',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.path).toEqual([0, 0, 0, 0, 0]);
		});
	});

	describe('selection.move ArrowDown', () => {
		it('moves to next paragraph', () => {
			const editor = new JPEditor({
				document: makeTwoParaDoc('Hello', 'World'),
				plugins: [new SelectionPlugin()],
			});
			editor.setSelection({
				anchor: { path: [0, 0, 0, 0, 0], offset: 3 },
				focus: { path: [0, 0, 0, 0, 0], offset: 3 },
			});

			editor.executeCommand('selection.move', {
				direction: 'ArrowDown',
				extend: false,
				word: false,
			});
			expect(editor.getSelection()!.focus.path).toEqual([0, 0, 1, 0, 0]);
		});
	});

	describe('selection.selectAll', () => {
		it('selects all text in document', () => {
			const editor = new JPEditor({
				document: makeTwoParaDoc('Hello', 'World'),
				plugins: [new SelectionPlugin()],
			});

			editor.executeCommand('selection.selectAll');
			const sel = editor.getSelection()!;
			expect(sel.anchor.path).toEqual([0, 0, 0, 0, 0]);
			expect(sel.anchor.offset).toBe(0);
			expect(sel.focus.path).toEqual([0, 0, 1, 0, 0]);
			expect(sel.focus.offset).toBe(5);
		});
	});
});
