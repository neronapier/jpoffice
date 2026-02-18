import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JPEditor } from '../src/editor';
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
import type { JPCommand } from '../src/commands/command';

function makeDoc(text = 'Hello') {
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

// Path to the text node: doc -> body -> section -> paragraph -> run -> text
const TEXT_PATH = [0, 0, 0, 0, 0];

describe('JPEditor', () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it('creates with initial state', () => {
		const doc = makeDoc();
		const editor = new JPEditor({ document: doc });

		expect(editor.getDocument()).toBe(doc);
		expect(editor.getSelection()).toBeNull();
		expect(editor.isReadOnly()).toBe(false);
	});

	it('creates with readOnly option', () => {
		const editor = new JPEditor({ document: makeDoc(), readOnly: true });
		expect(editor.isReadOnly()).toBe(true);
	});

	it('notifies subscribers on state change', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const listener = vi.fn();

		editor.subscribe(listener);
		editor.apply({
			type: 'insert_text',
			path: TEXT_PATH,
			offset: 5,
			text: ' World',
		});

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('unsubscribe works', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const listener = vi.fn();

		const unsubscribe = editor.subscribe(listener);
		unsubscribe();

		editor.apply({
			type: 'insert_text',
			path: TEXT_PATH,
			offset: 5,
			text: ' World',
		});

		expect(listener).not.toHaveBeenCalled();
	});

	it('applies insert_text operation', () => {
		const editor = new JPEditor({ document: makeDoc('Hello') });

		editor.apply({
			type: 'insert_text',
			path: TEXT_PATH,
			offset: 5,
			text: ' World',
		});

		const doc = editor.getDocument();
		const section = doc.children[0].children[0]; // body -> section
		const para = section.children[0];
		if (para.type === 'paragraph') {
			const run = para.children[0];
			if (run.type === 'run') {
				const text = run.children[0];
				if (text.type === 'text') {
					expect(text.text).toBe('Hello World');
				}
			}
		}
	});

	it('blocks operations in readOnly mode (except set_selection)', () => {
		const editor = new JPEditor({ document: makeDoc(), readOnly: true });
		const listener = vi.fn();
		editor.subscribe(listener);

		// Text insert should be blocked
		editor.apply({
			type: 'insert_text',
			path: TEXT_PATH,
			offset: 0,
			text: 'X',
		});
		expect(listener).not.toHaveBeenCalled();

		// Selection change should be allowed
		editor.setSelection({
			anchor: { path: TEXT_PATH, offset: 0 },
			focus: { path: TEXT_PATH, offset: 0 },
		});
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('undo/redo works', () => {
		const editor = new JPEditor({ document: makeDoc('Hello') });

		expect(editor.canUndo()).toBe(false);
		expect(editor.canRedo()).toBe(false);

		editor.apply({
			type: 'insert_text',
			path: TEXT_PATH,
			offset: 5,
			text: ' World',
		});

		expect(editor.canUndo()).toBe(true);
		expect(editor.canRedo()).toBe(false);

		editor.undo();

		expect(editor.canUndo()).toBe(false);
		expect(editor.canRedo()).toBe(true);

		// Verify text reverted
		const doc = editor.getDocument();
		const section = doc.children[0].children[0];
		const para = section.children[0];
		if (para.type === 'paragraph') {
			const run = para.children[0];
			if (run.type === 'run') {
				const text = run.children[0];
				if (text.type === 'text') {
					expect(text.text).toBe('Hello');
				}
			}
		}

		editor.redo();
		expect(editor.canUndo()).toBe(true);
		expect(editor.canRedo()).toBe(false);
	});

	it('batch groups operations into single undo step', () => {
		const editor = new JPEditor({ document: makeDoc('AB') });

		editor.batch(() => {
			editor.apply({
				type: 'insert_text',
				path: TEXT_PATH,
				offset: 2,
				text: 'C',
			});
			editor.apply({
				type: 'insert_text',
				path: TEXT_PATH,
				offset: 3,
				text: 'D',
			});
		});

		expect(editor.canUndo()).toBe(true);

		// Single undo should revert both
		editor.undo();

		const doc = editor.getDocument();
		const section = doc.children[0].children[0];
		const para = section.children[0];
		if (para.type === 'paragraph') {
			const run = para.children[0];
			if (run.type === 'run') {
				const text = run.children[0];
				if (text.type === 'text') {
					expect(text.text).toBe('AB');
				}
			}
		}
	});

	it('setReadOnly toggles and notifies', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const listener = vi.fn();
		editor.subscribe(listener);

		editor.setReadOnly(true);
		expect(editor.isReadOnly()).toBe(true);
		expect(listener).toHaveBeenCalledTimes(1);

		// No-op if already same value
		editor.setReadOnly(true);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('registerCommand and executeCommand work', () => {
		const editor = new JPEditor({ document: makeDoc('Test') });
		const executeFn = vi.fn();

		const command: JPCommand<void> = {
			id: 'test.command',
			name: 'Test Command',
			canExecute: () => true,
			execute: executeFn,
		};

		editor.registerCommand(command);
		editor.executeCommand('test.command');

		expect(executeFn).toHaveBeenCalledTimes(1);
		expect(executeFn).toHaveBeenCalledWith(editor, undefined);
	});

	it('canExecuteCommand returns false for unregistered', () => {
		const editor = new JPEditor({ document: makeDoc() });
		expect(editor.canExecuteCommand('nonexistent')).toBe(false);
	});

	it('destroy cleans up listeners', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const listener = vi.fn();
		editor.subscribe(listener);

		editor.destroy();

		// After destroy, selection changes shouldn't notify
		editor.setSelection({
			anchor: { path: TEXT_PATH, offset: 0 },
			focus: { path: TEXT_PATH, offset: 0 },
		});

		expect(listener).not.toHaveBeenCalled();
	});
});
