import type { JPNumberingRef } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { getParagraphsInRange } from '../text/text-utils';

const BULLET_NUM_ID = 1;
const NUMBERED_NUM_ID = 2;
const MAX_LIST_LEVEL = 8;

/**
 * ListPlugin handles bullet/numbered list toggling and indent/outdent.
 */
export class ListPlugin implements JPPlugin {
	readonly id = 'jpoffice.list';
	readonly name = 'List';

	initialize(editor: JPEditor): void {
		editor.registerCommand({
			id: 'list.toggleBullet',
			name: 'Toggle Bullet List',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleList(editor, BULLET_NUM_ID),
		});

		editor.registerCommand({
			id: 'list.toggleNumbered',
			name: 'Toggle Numbered List',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.toggleList(editor, NUMBERED_NUM_ID),
		});

		editor.registerCommand({
			id: 'list.indent',
			name: 'Indent List',
			canExecute: () => {
				if (editor.isReadOnly() || !editor.getSelection()) return false;
				const doc = editor.getDocument();
				const sel = editor.getSelection();
				if (!sel) return false;
				const paragraphs = getParagraphsInRange(doc, sel);
				return paragraphs.some((p) => p.node.properties.numbering != null);
			},
			execute: () => this.indent(editor),
		});

		editor.registerCommand({
			id: 'list.outdent',
			name: 'Outdent List',
			canExecute: () => {
				if (editor.isReadOnly() || !editor.getSelection()) return false;
				const doc = editor.getDocument();
				const sel = editor.getSelection();
				if (!sel) return false;
				const paragraphs = getParagraphsInRange(doc, sel);
				return paragraphs.some((p) => p.node.properties.numbering != null);
			},
			execute: () => this.outdent(editor),
		});
	}

	private toggleList(editor: JPEditor, numId: number): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		const allMatch = paragraphs.every((p) => p.node.properties.numbering?.numId === numId);

		editor.batch(() => {
			for (const para of paragraphs) {
				if (allMatch) {
					// Remove list
					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: {
							numbering: null,
							styleId:
								para.node.properties.styleId === 'ListParagraph'
									? 'Normal'
									: para.node.properties.styleId,
						},
						oldProperties: {
							numbering: para.node.properties.numbering,
							styleId: para.node.properties.styleId,
						},
					});
				} else {
					// Apply list
					const newNumbering: JPNumberingRef = {
						numId,
						level: para.node.properties.numbering?.level ?? 0,
					};
					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: { numbering: newNumbering, styleId: 'ListParagraph' },
						oldProperties: {
							numbering: para.node.properties.numbering,
							styleId: para.node.properties.styleId,
						},
					});
				}
			}
		});
	}

	private indent(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				const numbering = para.node.properties.numbering;
				if (!numbering || numbering.level >= MAX_LIST_LEVEL) continue;

				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: {
						numbering: { ...numbering, level: numbering.level + 1 },
					},
					oldProperties: { numbering },
				});
			}
		});
	}

	private outdent(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				const numbering = para.node.properties.numbering;
				if (!numbering) continue;

				if (numbering.level <= 0) {
					// Remove list entirely
					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: {
							numbering: null,
							styleId:
								para.node.properties.styleId === 'ListParagraph'
									? 'Normal'
									: para.node.properties.styleId,
						},
						oldProperties: {
							numbering: para.node.properties.numbering,
							styleId: para.node.properties.styleId,
						},
					});
				} else {
					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: {
							numbering: { ...numbering, level: numbering.level - 1 },
						},
						oldProperties: { numbering },
					});
				}
			}
		});
	}
}
