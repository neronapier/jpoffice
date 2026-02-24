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
import { cleanup, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
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
