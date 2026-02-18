import { describe, it, expect, beforeEach } from 'vitest';
import {
	pushToHistory,
	performUndo,
	performRedo,
	canUndo,
	canRedo,
} from '../src/history/history';
import type { JPHistory } from '../src/editor-state';
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
import type { JPOperation } from '@jpoffice/model';

// Path: doc -> body -> section -> paragraph -> run -> text
const TEXT_PATH = [0, 0, 0, 0, 0];

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

function emptyHistory(): JPHistory {
	return { undos: [], redos: [] };
}

describe('History', () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it('pushToHistory adds a batch to undos', () => {
		const ops: JPOperation[] = [
			{ type: 'insert_text', path: TEXT_PATH, offset: 5, text: ' World' },
		];

		const history = pushToHistory(emptyHistory(), ops);

		expect(history.undos).toHaveLength(1);
		expect(history.undos[0].operations).toEqual(ops);
		expect(history.redos).toHaveLength(0);
	});

	it('pushToHistory clears redo stack', () => {
		const initialHistory: JPHistory = {
			undos: [],
			redos: [
				{
					operations: [
						{ type: 'insert_text', path: [0], offset: 0, text: 'X' },
					],
					timestamp: Date.now(),
				},
			],
		};

		const history = pushToHistory(initialHistory, [
			{ type: 'insert_text', path: [0], offset: 0, text: 'Y' },
		]);

		expect(history.redos).toHaveLength(0);
	});

	it('pushToHistory does nothing for empty ops', () => {
		const history = emptyHistory();
		const result = pushToHistory(history, []);
		expect(result).toBe(history);
	});

	it('canUndo/canRedo reflect state', () => {
		expect(canUndo(emptyHistory())).toBe(false);
		expect(canRedo(emptyHistory())).toBe(false);

		const withUndo = pushToHistory(emptyHistory(), [
			{ type: 'insert_text', path: [0], offset: 0, text: 'X' },
		]);
		expect(canUndo(withUndo)).toBe(true);
		expect(canRedo(withUndo)).toBe(false);
	});

	it('performUndo returns null when nothing to undo', () => {
		const doc = makeDoc();
		const result = performUndo(doc, emptyHistory());
		expect(result).toBeNull();
	});

	it('performUndo reverts insert_text', () => {
		const doc = makeDoc('Hello World');
		const ops: JPOperation[] = [
			{ type: 'insert_text', path: TEXT_PATH, offset: 5, text: ' World' },
		];
		const history = pushToHistory(emptyHistory(), ops);

		const result = performUndo(doc, history);
		expect(result).not.toBeNull();

		expect(result!.history.undos).toHaveLength(0);
		expect(result!.history.redos).toHaveLength(1);

		// The inverse of insert_text is delete_text
		const section = result!.document.children[0].children[0];
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
	});

	it('performRedo returns null when nothing to redo', () => {
		const doc = makeDoc();
		const result = performRedo(doc, emptyHistory());
		expect(result).toBeNull();
	});

	it('undo then redo round-trips', () => {
		const originalDoc = makeDoc('Hello World');
		const ops: JPOperation[] = [
			{ type: 'insert_text', path: TEXT_PATH, offset: 5, text: ' World' },
		];
		const history = pushToHistory(emptyHistory(), ops);

		const afterUndo = performUndo(originalDoc, history)!;
		expect(afterUndo).not.toBeNull();

		const afterRedo = performRedo(afterUndo.document, afterUndo.history)!;
		expect(afterRedo).not.toBeNull();

		expect(afterRedo.history.undos).toHaveLength(1);
		expect(afterRedo.history.redos).toHaveLength(0);
	});
});
