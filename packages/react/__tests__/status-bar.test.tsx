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
import { renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { EditorContext } from '../src/context/editor-context';
import type { EditorContextValue } from '../src/context/editor-context';
import { useCurrentPage } from '../src/hooks/useCurrentPage';
import { useDocumentStats } from '../src/hooks/useDocumentStats';

function makeDoc(texts: string[] = ['Hello World']) {
	const paragraphs = texts.map((text) =>
		createParagraph(generateId(), [createRun(generateId(), [createText(generateId(), text)])]),
	);
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(generateId(), paragraphs, DEFAULT_SECTION_PROPERTIES),
		]),
	});
}

function makeEditor(texts: string[] = ['Hello World']) {
	return new JPEditor({ document: makeDoc(texts) });
}

function makeWrapper(editor: JPEditor) {
	const value: EditorContextValue = { editor };
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
	};
}

describe('useDocumentStats', () => {
	it('returns page count, word count, and char count', () => {
		const editor = makeEditor(['Hello World']);
		const { result } = renderHook(() => useDocumentStats(), {
			wrapper: makeWrapper(editor),
		});

		expect(result.current.pageCount).toBeGreaterThanOrEqual(1);
		expect(result.current.wordCount).toBe(2); // "Hello" + "World"
		expect(result.current.charCount).toBe(11); // "Hello World"
	});

	it('returns 0 words for empty document', () => {
		const doc = createDocument({
			id: generateId(),
			body: createBody(generateId(), [
				createSection(
					generateId(),
					[createParagraph(generateId(), [])],
					DEFAULT_SECTION_PROPERTIES,
				),
			]),
		});
		const editor = new JPEditor({ document: doc });
		const { result } = renderHook(() => useDocumentStats(), {
			wrapper: makeWrapper(editor),
		});

		expect(result.current.wordCount).toBe(0);
		expect(result.current.charCount).toBe(0);
	});

	it('counts words across multiple paragraphs', () => {
		const editor = makeEditor(['First paragraph', 'Second paragraph', 'Third']);
		const { result } = renderHook(() => useDocumentStats(), {
			wrapper: makeWrapper(editor),
		});

		// getPlainText concatenates without separators between paragraphs:
		// "First paragraphSecond paragraphThird" → 3 words
		expect(result.current.wordCount).toBe(3);
	});
});

describe('useCurrentPage', () => {
	it('returns 1 for a simple document', () => {
		const editor = makeEditor(['Hello']);
		const { result } = renderHook(() => useCurrentPage(), {
			wrapper: makeWrapper(editor),
		});

		expect(result.current).toBe(1);
	});

	it('returns 1 when no selection', () => {
		const editor = makeEditor(['Content']);
		const { result } = renderHook(() => useCurrentPage(), {
			wrapper: makeWrapper(editor),
		});

		expect(result.current).toBe(1);
	});
});
