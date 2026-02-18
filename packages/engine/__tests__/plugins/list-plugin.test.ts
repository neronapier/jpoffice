import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { ListPlugin } from '../../src/plugins/list/list-plugin';
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

function getParaAt(editor: JPEditor, path: number[]): JPParagraph {
	return getNodeAtPath(editor.getDocument(), path) as JPParagraph;
}

describe('ListPlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello') {
		return new JPEditor({
			document: makeDoc(text),
			plugins: [new ListPlugin()],
		});
	}

	describe('list.toggleBullet', () => {
		it('applies bullet list to paragraph', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleBullet');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering?.numId).toBe(1);
			expect(para.properties.numbering?.level).toBe(0);
			expect(para.properties.styleId).toBe('ListParagraph');
		});

		it('removes bullet list when already applied', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleBullet');
			editor.executeCommand('list.toggleBullet');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering).toBeUndefined();
			expect(para.properties.styleId).toBe('Normal');
		});
	});

	describe('list.toggleNumbered', () => {
		it('applies numbered list to paragraph', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleNumbered');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering?.numId).toBe(2);
		});
	});

	describe('list.indent', () => {
		it('increases list level', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleBullet');
			editor.executeCommand('list.indent');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering?.level).toBe(1);
		});

		it('is not executable when not in a list', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			expect(editor.canExecuteCommand('list.indent')).toBe(false);
		});
	});

	describe('list.outdent', () => {
		it('decreases list level', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleBullet');
			editor.executeCommand('list.indent');
			editor.executeCommand('list.outdent');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering?.level).toBe(0);
		});

		it('removes list when outdenting at level 0', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('list.toggleBullet');
			editor.executeCommand('list.outdent');
			const para = getParaAt(editor, PARA_PATH);
			expect(para.properties.numbering).toBeUndefined();
		});
	});
});
