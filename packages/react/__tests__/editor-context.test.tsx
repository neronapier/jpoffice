import { describe, it, expect, afterEach } from 'vitest';
import React, { useContext } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';
import { JPEditor } from '@jpoffice/engine';
import { EditorContext } from '../src/context/editor-context';
import type { EditorContextValue } from '../src/context/editor-context';

function makeDoc() {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(
				generateId(),
				[
					createParagraph(generateId(), [
						createRun(generateId(), [createText(generateId(), 'test')]),
					]),
				],
				DEFAULT_SECTION_PROPERTIES,
			),
		]),
	});
}

afterEach(cleanup);

describe('EditorContext', () => {
	it('provides editor to children', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const value: EditorContextValue = { editor };

		function Child() {
			const ctx = useContext(EditorContext);
			return <div data-testid="result">{ctx ? 'has-editor' : 'no-editor'}</div>;
		}

		render(
			<EditorContext.Provider value={value}>
				<Child />
			</EditorContext.Provider>,
		);

		expect(screen.getByTestId('result').textContent).toBe('has-editor');
	});

	it('defaults to null when no provider', () => {
		function Child() {
			const ctx = useContext(EditorContext);
			return <div data-testid="result">{ctx === null ? 'null' : 'not-null'}</div>;
		}

		render(<Child />);
		expect(screen.getByTestId('result').textContent).toBe('null');
	});

	it('provides access to editor methods', () => {
		const editor = new JPEditor({ document: makeDoc() });
		const value: EditorContextValue = { editor };

		function Child() {
			const ctx = useContext(EditorContext);
			const readOnly = ctx?.editor.isReadOnly() ? 'true' : 'false';
			return <div data-testid="readonly">{readOnly}</div>;
		}

		render(
			<EditorContext.Provider value={value}>
				<Child />
			</EditorContext.Provider>,
		);

		expect(screen.getByTestId('readonly').textContent).toBe('false');
	});
});
