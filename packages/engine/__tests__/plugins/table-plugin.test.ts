import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { TablePlugin } from '../../src/plugins/table/table-plugin';
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

describe('TablePlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello') {
		return new JPEditor({
			document: makeDoc(text),
			plugins: [new TablePlugin()],
		});
	}

	describe('table.insert', () => {
		it('inserts a 2x3 table after current paragraph', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('table.insert', { rows: 2, cols: 3 });

			// Section should now have 2 children: paragraph + table
			const section = getNodeAtPath(editor.getDocument(), [0, 0]);
			expect(isElement(section)).toBe(true);
			if (isElement(section)) {
				expect(section.children.length).toBe(2);
				expect(section.children[1].type).toBe('table');

				const table = section.children[1];
				if (isElement(table)) {
					expect(table.children.length).toBe(2); // 2 rows
					if (isElement(table.children[0])) {
						expect(table.children[0].children.length).toBe(3); // 3 cells
					}
				}
			}
		});

		it('moves cursor to first cell after insert', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});

			editor.executeCommand('table.insert', { rows: 2, cols: 2 });
			const sel = editor.getSelection();
			// First cell's text: [section=0, 0, table=1, row=0, cell=0, para=0, run=0, text=0]
			expect(sel!.anchor.path).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);
			expect(sel!.anchor.offset).toBe(0);
		});
	});

	describe('table operations when in table', () => {
		function createEditorWithTable() {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});
			editor.executeCommand('table.insert', { rows: 2, cols: 2 });
			return editor;
		}

		it('inserts a row below', () => {
			const editor = createEditorWithTable();
			// Cursor is at [0,0,1,0,0,0,0,0] — first cell

			editor.executeCommand('table.insertRow', { position: 'below' });
			const table = getNodeAtPath(editor.getDocument(), [0, 0, 1]);
			expect(isElement(table) && table.children.length).toBe(3);
		});

		it('inserts a column to the right', () => {
			const editor = createEditorWithTable();

			editor.executeCommand('table.insertColumn', { position: 'right' });
			const table = getNodeAtPath(editor.getDocument(), [0, 0, 1]);
			if (isElement(table) && isElement(table.children[0])) {
				expect(table.children[0].children.length).toBe(3);
			}
		});

		it('deletes a row', () => {
			const editor = createEditorWithTable();

			editor.executeCommand('table.deleteRow');
			const table = getNodeAtPath(editor.getDocument(), [0, 0, 1]);
			expect(isElement(table) && table.children.length).toBe(1);
		});

		it('deletes entire table when last row is removed', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 0 },
			});
			editor.executeCommand('table.insert', { rows: 1, cols: 2 });

			editor.executeCommand('table.deleteRow');
			// Table should be gone, section has only the paragraph
			const section = getNodeAtPath(editor.getDocument(), [0, 0]);
			expect(isElement(section) && section.children.length).toBe(1);
		});
	});
});
