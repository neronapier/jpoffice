import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { HistoryPlugin } from '../../src/plugins/history/history-plugin';
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
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';

const TEXT_PATH = [0, 0, 0, 0, 0];

function makeDoc(text = 'Hello') {
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

function getTextAt(editor: JPEditor, path: number[]): string {
	return (getNodeAtPath(editor.getDocument(), path) as any).text;
}

describe('HistoryPlugin', () => {
	beforeEach(() => resetIdCounter());

	it('registers undo and redo commands', () => {
		const editor = new JPEditor({
			document: makeDoc(),
			plugins: [new HistoryPlugin()],
		});

		expect(editor.canExecuteCommand('history.undo')).toBe(false);
		expect(editor.canExecuteCommand('history.redo')).toBe(false);
	});

	it('can undo after text insertion', () => {
		const editor = new JPEditor({
			document: makeDoc('Hello'),
			plugins: [new TextPlugin(), new HistoryPlugin()],
		});

		editor.setSelection({
			anchor: { path: TEXT_PATH, offset: 5 },
			focus: { path: TEXT_PATH, offset: 5 },
		});

		editor.executeCommand('text.insert', { text: ' World' });
		expect(getTextAt(editor, TEXT_PATH)).toBe('Hello World');
		expect(editor.canExecuteCommand('history.undo')).toBe(true);

		editor.executeCommand('history.undo');
		expect(getTextAt(editor, TEXT_PATH)).toBe('Hello');
	});

	it('can redo after undo', () => {
		const editor = new JPEditor({
			document: makeDoc('Hello'),
			plugins: [new TextPlugin(), new HistoryPlugin()],
		});

		editor.setSelection({
			anchor: { path: TEXT_PATH, offset: 5 },
			focus: { path: TEXT_PATH, offset: 5 },
		});

		editor.executeCommand('text.insert', { text: '!' });
		editor.executeCommand('history.undo');
		expect(editor.canExecuteCommand('history.redo')).toBe(true);

		editor.executeCommand('history.redo');
		expect(getTextAt(editor, TEXT_PATH)).toBe('Hello!');
	});

	it('undo is not executable with no history', () => {
		const editor = new JPEditor({
			document: makeDoc(),
			plugins: [new HistoryPlugin()],
		});

		expect(editor.canExecuteCommand('history.undo')).toBe(false);
	});
});
