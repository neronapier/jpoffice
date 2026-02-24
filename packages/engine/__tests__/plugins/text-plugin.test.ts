import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { TextPlugin } from '../../src/plugins/text/text-plugin';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	resetIdCounter,
	getNodeAtPath,
	isElement,
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

function getTextAt(editor: JPEditor, path: number[]): string {
	const node = getNodeAtPath(editor.getDocument(), path) as any;
	return node.text;
}

function paragraphCount(editor: JPEditor): number {
	const section = getNodeAtPath(editor.getDocument(), [0, 0]);
	return isElement(section) ? section.children.length : 0;
}

describe('TextPlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello World') {
		return new JPEditor({
			document: makeDoc(text),
			plugins: [new TextPlugin()],
		});
	}

	describe('text.insert', () => {
		it('inserts text at cursor position', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.insert', { text: ' World' });
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello World');
		});

		it('inserts text in the middle', () => {
			const editor = createEditor('Hllo');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 1 },
				focus: { path: TEXT_PATH, offset: 1 },
			});

			editor.executeCommand('text.insert', { text: 'e' });
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
		});

		it('replaces selected text', () => {
			const editor = createEditor('Hello World');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('text.insert', { text: '!' });
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello!');
		});

		it('moves cursor after insertion', () => {
			const editor = createEditor('AB');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 1 },
				focus: { path: TEXT_PATH, offset: 1 },
			});

			editor.executeCommand('text.insert', { text: 'XY' });
			const sel = editor.getSelection();
			expect(sel!.anchor.offset).toBe(3); // 1 + 2
		});
	});

	describe('text.deleteBackward', () => {
		it('deletes character before cursor', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.deleteBackward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hell');
		});

		it('deletes character in the middle', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 3 },
				focus: { path: TEXT_PATH, offset: 3 },
			});

			editor.executeCommand('text.deleteBackward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('Helo');
		});

		it('does nothing at start of document', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('text.deleteBackward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
		});

		it('deletes range selection', () => {
			const editor = createEditor('Hello World');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 2 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.deleteBackward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('He World');
		});

		it('merges with previous paragraph at start of paragraph', () => {
			const editor = new JPEditor({
				document: makeTwoParaDoc('Hello', 'World'),
				plugins: [new TextPlugin()],
			});
			const secondTextPath = [0, 0, 1, 0, 0];
			editor.setSelection({
				anchor: { path: secondTextPath, offset: 0 },
				focus: { path: secondTextPath, offset: 0 },
			});

			editor.executeCommand('text.deleteBackward');
			// Should merge paragraphs
			expect(paragraphCount(editor)).toBe(1);
		});
	});

	describe('text.deleteForward', () => {
		it('deletes character after cursor', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('text.deleteForward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('ello');
		});

		it('does nothing at end of document', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.deleteForward');
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
		});

		it('merges with next paragraph at end of paragraph', () => {
			const editor = new JPEditor({
				document: makeTwoParaDoc('Hello', 'World'),
				plugins: [new TextPlugin()],
			});

			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.deleteForward');
			expect(paragraphCount(editor)).toBe(1);
		});
	});

	describe('text.insertParagraph', () => {
		it('splits paragraph at cursor position', () => {
			const editor = createEditor('HelloWorld');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.insertParagraph');
			expect(paragraphCount(editor)).toBe(2);
			expect(getTextAt(editor, [0, 0, 0, 0, 0])).toBe('Hello');
			expect(getTextAt(editor, [0, 0, 1, 0, 0])).toBe('World');
		});

		it('inserts empty paragraph at start of paragraph', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('text.insertParagraph');
			expect(paragraphCount(editor)).toBe(2);
			expect(getTextAt(editor, [0, 0, 0, 0, 0])).toBe('');
			expect(getTextAt(editor, [0, 0, 1, 0, 0])).toBe('Hello');
		});

		it('inserts empty paragraph at end of paragraph', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.insertParagraph');
			expect(paragraphCount(editor)).toBe(2);
			expect(getTextAt(editor, [0, 0, 0, 0, 0])).toBe('Hello');
			expect(getTextAt(editor, [0, 0, 1, 0, 0])).toBe('');
		});

		it('moves cursor to start of new paragraph', () => {
			const editor = createEditor('HelloWorld');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.insertParagraph');
			const sel = editor.getSelection();
			expect(sel!.anchor.path).toEqual([0, 0, 1, 0, 0]);
			expect(sel!.anchor.offset).toBe(0);
		});
	});

	describe('text.deleteSelection', () => {
		it('deletes selected text', () => {
			const editor = createEditor('Hello World');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('text.deleteSelection');
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
		});

		it('is not executable with collapsed selection', () => {
			const editor = createEditor('Hello');
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 3 },
				focus: { path: TEXT_PATH, offset: 3 },
			});

			expect(editor.canExecuteCommand('text.deleteSelection')).toBe(false);
		});
	});

	describe('text.insertTab', () => {
		it('increases paragraph indent when no list or table context', () => {
			const editor = createEditor('Hello');
			// Register format.indent command so Tab can delegate to it
			editor.registerCommand<{ direction: string }>({
				id: 'format.indent',
				name: 'Indent',
				canExecute: () => true,
				execute: (_ed, args) => {
					// Apply indent to paragraph
					const sel = editor.getSelection()!;
					const paraPath = sel.anchor.path.slice(0, 3);
					const doc = editor.getDocument();
					const para = getNodeAtPath(doc, paraPath);
					const props = (para as { properties?: { indent?: { left?: number } } }).properties ?? {};
					const currentLeft = props.indent?.left ?? 0;
					const step = 720;
					const newLeft = args.direction === 'increase' ? currentLeft + step : Math.max(0, currentLeft - step);
					editor.apply({
						type: 'set_properties',
						path: paraPath,
						properties: { indent: { left: newLeft } },
						oldProperties: { indent: props.indent },
					});
				},
			});

			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 5 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('text.insertTab');
			// Text should NOT have a tab character inserted
			expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
			// Paragraph should have increased indent
			const paraPath = TEXT_PATH.slice(0, 3);
			const para = getNodeAtPath(editor.getDocument(), paraPath) as { properties: { indent?: { left?: number } } };
			expect(para.properties.indent?.left).toBe(720);
		});
	});
});
