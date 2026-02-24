import { JPEditor } from '@jpoffice/engine';
import {
	DEFAULT_SECTION_PROPERTIES,
	createBody,
	createDocument,
	createParagraph,
	createRun,
	createSection,
	createText,
	generateId,
} from '@jpoffice/model';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EditorContext } from '../src/context/editor-context';
import type { EditorContextValue } from '../src/context/editor-context';
import { useCommand } from '../src/hooks/useCommand';
import { useEditor } from '../src/hooks/useEditor';
import { useEditorState } from '../src/hooks/useEditorState';
import { useSelection } from '../src/hooks/useSelection';

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

function makeEditor(text = 'Hello World') {
	return new JPEditor({ document: makeDoc(text) });
}

function createWrapper(editor: JPEditor) {
	const value: EditorContextValue = { editor };
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
	};
}

describe('useEditor', () => {
	it('returns the editor from context', () => {
		const editor = makeEditor();
		const { result } = renderHook(() => useEditor(), {
			wrapper: createWrapper(editor),
		});
		expect(result.current).toBe(editor);
	});

	it('throws when used outside context', () => {
		expect(() => {
			renderHook(() => useEditor());
		}).toThrow('useEditor must be used within a JPOfficeEditor or EditorContext.Provider');
	});
});

describe('useEditorState', () => {
	it('returns the current editor state', () => {
		const editor = makeEditor('Test text');
		const { result } = renderHook(() => useEditorState(), {
			wrapper: createWrapper(editor),
		});
		expect(result.current.document).toBe(editor.getDocument());
	});

	it('updates when editor state changes', () => {
		const editor = makeEditor('Hello');
		const { result } = renderHook(() => useEditorState(), {
			wrapper: createWrapper(editor),
		});

		const stateBefore = result.current;

		act(() => {
			editor.apply({
				type: 'insert_text',
				path: [0, 0, 0, 0, 0],
				offset: 5,
				text: ' World',
			});
		});

		// State should have changed
		expect(result.current).not.toBe(stateBefore);
	});
});

describe('useSelection', () => {
	it('returns null when no selection is set', () => {
		const editor = makeEditor();
		const { result } = renderHook(() => useSelection(), {
			wrapper: createWrapper(editor),
		});
		// Editor starts with no selection — returns null
		expect(result.current).toBeNull();
	});

	it('returns selection after it is set', () => {
		const editor = makeEditor();
		const { result } = renderHook(() => useSelection(), {
			wrapper: createWrapper(editor),
		});

		act(() => {
			editor.apply({
				type: 'set_selection',
				oldSelection: editor.getSelection(),
				newSelection: {
					anchor: { path: [0, 0, 0, 0, 0], offset: 0 },
					focus: { path: [0, 0, 0, 0, 0], offset: 5 },
				},
			});
		});

		expect(result.current).toBeDefined();
		if (result.current) {
			expect(result.current.anchor.offset).toBe(0);
			expect(result.current.focus.offset).toBe(5);
		}
	});
});

describe('useCommand', () => {
	it('returns execute and canExecute functions', () => {
		const editor = makeEditor();
		editor.registerCommand({
			id: 'test:greet',
			name: 'Greet',
			execute: vi.fn(),
			canExecute: () => true,
		});

		const { result } = renderHook(() => useCommand('test:greet'), {
			wrapper: createWrapper(editor),
		});

		expect(typeof result.current.execute).toBe('function');
		expect(typeof result.current.canExecute).toBe('function');
	});

	it('execute calls the editor command', () => {
		const executeFn = vi.fn();
		const editor = makeEditor();
		editor.registerCommand({
			id: 'test:action',
			name: 'Action',
			execute: executeFn,
			canExecute: () => true,
		});

		const { result } = renderHook(() => useCommand('test:action'), {
			wrapper: createWrapper(editor),
		});

		act(() => {
			result.current.execute();
		});

		expect(executeFn).toHaveBeenCalled();
	});

	it('canExecute checks the command', () => {
		const editor = makeEditor();
		editor.registerCommand({
			id: 'test:check',
			name: 'Check',
			execute: vi.fn(),
			canExecute: () => false,
		});

		const { result } = renderHook(() => useCommand('test:check'), {
			wrapper: createWrapper(editor),
		});

		expect(result.current.canExecute()).toBe(false);
	});
});
