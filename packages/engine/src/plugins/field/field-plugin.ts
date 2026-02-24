import type { JPFieldType, JPNode, JPPath } from '@jpoffice/model';
import { createField, createRun, createText, generateId } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

/**
 * FieldPlugin registers commands for inserting and updating dynamic fields
 * (PAGE, NUMPAGES, DATE, TIME, AUTHOR, TITLE, FILENAME).
 *
 * Fields are leaf nodes placed inline inside paragraphs alongside runs.
 * Their cachedResult is resolved at insert time and can be refreshed via
 * the field.updateAll command.
 */
export class FieldPlugin implements JPPlugin {
	readonly id = 'jpoffice.field';
	readonly name = 'Field';

	initialize(editor: JPEditor): void {
		// Insert page number field
		editor.registerCommand({
			id: 'field.insertPageNumber',
			name: 'Insert Page Number',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'PAGE'),
		});

		// Insert total pages field
		editor.registerCommand({
			id: 'field.insertPageCount',
			name: 'Insert Page Count',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'NUMPAGES'),
		});

		// Insert date field
		editor.registerCommand({
			id: 'field.insertDate',
			name: 'Insert Date',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'DATE'),
		});

		// Insert time field
		editor.registerCommand({
			id: 'field.insertTime',
			name: 'Insert Time',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'TIME'),
		});

		// Insert author field
		editor.registerCommand({
			id: 'field.insertAuthor',
			name: 'Insert Author',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'AUTHOR'),
		});

		// Insert title field
		editor.registerCommand({
			id: 'field.insertTitle',
			name: 'Insert Title',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.insertField(editor, 'TITLE'),
		});

		// Generic insert field
		editor.registerCommand<{ fieldType: JPFieldType }>({
			id: 'field.insert',
			name: 'Insert Field',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertField(editor, args.fieldType),
		});

		// Update all fields
		editor.registerCommand({
			id: 'field.updateAll',
			name: 'Update All Fields',
			canExecute: () => true,
			execute: () => this.updateAllFields(editor),
		});
	}

	private insertField(editor: JPEditor, fieldType: JPFieldType): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		// Resolve initial cached value
		const cachedResult = this.resolveFieldValue(fieldType, editor);

		const field = createField(generateId(), fieldType, { cachedResult });

		editor.batch(() => {
			// Fields are inline leaf nodes that go as siblings of runs inside paragraphs.
			// We split the current text/run as needed, then insert the field node.
			const textPath = ctx.textPath;
			const offset = ctx.offset;
			const textNode = ctx.textNode;

			if (offset > 0 && offset < textNode.text.length) {
				// Mid-text: split text node, then split run, then insert field between the two runs
				editor.apply({
					type: 'split_node',
					path: textPath,
					position: offset,
					properties: {},
				});
				// Split run at the new text boundary
				const runPath = textPath.slice(0, -1);
				const textIdx = textPath[textPath.length - 1];
				editor.apply({
					type: 'split_node',
					path: runPath,
					position: textIdx + 1,
					properties: {},
				});
				// Insert field between the two runs
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
				// Move cursor to start of the second (shifted) run's text
				const afterFieldPath: JPPath = [...paraPath, runIdx + 2, 0];
				editor.setSelection({
					anchor: { path: afterFieldPath, offset: 0 },
					focus: { path: afterFieldPath, offset: 0 },
				});
			} else if (offset === 0) {
				// At start of text: insert field before current run
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
				// Cursor stays at same logical position but path shifts
				const newTextPath: JPPath = [...paraPath, runIdx + 1, 0];
				editor.setSelection({
					anchor: { path: newTextPath, offset: 0 },
					focus: { path: newTextPath, offset: 0 },
				});
			} else {
				// At end of text: insert field after current run
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
				// Add empty run after field for cursor placement
				const emptyRun = createRun(generateId(), [createText(generateId(), '')]);
				const afterFieldPath: JPPath = [...paraPath, runIdx + 2];
				editor.apply({
					type: 'insert_node',
					path: afterFieldPath,
					node: emptyRun,
				});
				editor.setSelection({
					anchor: { path: [...afterFieldPath, 0], offset: 0 },
					focus: { path: [...afterFieldPath, 0], offset: 0 },
				});
			}
		});
	}

	private resolveFieldValue(fieldType: JPFieldType, editor: JPEditor): string {
		const doc = editor.getDocument();
		const now = new Date();

		switch (fieldType) {
			case 'PAGE':
				return '1'; // Actual value resolved post-layout
			case 'NUMPAGES':
				return '1'; // Actual value resolved post-layout
			case 'DATE':
				return now.toLocaleDateString();
			case 'TIME':
				return now.toLocaleTimeString();
			case 'AUTHOR':
				return doc.metadata.author ?? '';
			case 'TITLE':
				return doc.metadata.title ?? '';
			case 'FILENAME':
				return 'Untitled';
			default:
				return '';
		}
	}

	private updateAllFields(editor: JPEditor): void {
		// Walk the document tree looking for field nodes and update their cachedResult
		const doc = editor.getDocument();
		this.walkAndUpdateFields(editor, doc, []);
	}

	private walkAndUpdateFields(editor: JPEditor, node: JPNode, path: number[]): void {
		if (node.type === 'field') {
			const field = node as JPNode & {
				fieldType: JPFieldType;
				cachedResult: string;
			};
			const newValue = this.resolveFieldValue(field.fieldType, editor);
			if (newValue !== field.cachedResult) {
				editor.apply({
					type: 'set_properties',
					path,
					properties: { cachedResult: newValue },
					oldProperties: { cachedResult: field.cachedResult },
				});
			}
			return;
		}
		if ('children' in node && Array.isArray(node.children)) {
			for (let i = 0; i < node.children.length; i++) {
				this.walkAndUpdateFields(editor, node.children[i], [...path, i]);
			}
		}
	}
}
