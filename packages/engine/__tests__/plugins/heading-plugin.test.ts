import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { HeadingPlugin } from '../../src/plugins/heading/heading-plugin';
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
import type { JPParagraph } from '@jpoffice/model';

const TEXT_PATH = [0, 0, 0, 0, 0];
const PARA_PATH = [0, 0, 0];

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

function getParaAt(editor: JPEditor, path: number[]): JPParagraph {
	return getNodeAtPath(editor.getDocument(), path) as JPParagraph;
}

describe('HeadingPlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello') {
		return new JPEditor({
			document: makeDoc(text),
			plugins: [new HeadingPlugin()],
		});
	}

	describe('heading.set', () => {
		it('sets heading level 1', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('heading.set', { level: 1 });
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.styleId).toBe('Heading1');
			expect(para.properties.outlineLevel).toBe(0);
		});

		it('sets heading level 3', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('heading.set', { level: 3 });
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.styleId).toBe('Heading3');
			expect(para.properties.outlineLevel).toBe(2);
		});
	});

	describe('heading.clear', () => {
		it('clears heading and resets to Normal', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('heading.set', { level: 1 });
			editor.executeCommand('heading.clear');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.styleId).toBe('Normal');
		});
	});

	describe('heading.toggle', () => {
		it('toggles heading on when not set', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('heading.toggle', { level: 2 });
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.styleId).toBe('Heading2');
		});

		it('toggles heading off when already set', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('heading.set', { level: 2 });
			editor.executeCommand('heading.toggle', { level: 2 });
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.styleId).toBe('Normal');
		});
	});
});
