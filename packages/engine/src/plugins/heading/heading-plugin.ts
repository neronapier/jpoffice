import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { getParagraphsInRange } from '../text/text-utils';

/**
 * HeadingPlugin handles heading level assignment on paragraphs.
 */
export class HeadingPlugin implements JPPlugin {
	readonly id = 'jpoffice.heading';
	readonly name = 'Heading';

	initialize(editor: JPEditor): void {
		editor.registerCommand<{ level: number }>({
			id: 'heading.set',
			name: 'Set Heading',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.setHeading(editor, args.level),
		});

		editor.registerCommand({
			id: 'heading.clear',
			name: 'Clear Heading',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.clearHeading(editor),
		});

		editor.registerCommand<{ level: number }>({
			id: 'heading.toggle',
			name: 'Toggle Heading',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.toggleHeading(editor, args.level),
		});
	}

	private setHeading(editor: JPEditor, level: number): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);
		const styleId = `Heading${level}`;

		editor.batch(() => {
			for (const para of paragraphs) {
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: { styleId, outlineLevel: level - 1 },
					oldProperties: {
						styleId: para.node.properties.styleId,
						outlineLevel: para.node.properties.outlineLevel,
					},
				});
			}
		});
	}

	private clearHeading(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: { styleId: 'Normal', outlineLevel: null },
					oldProperties: {
						styleId: para.node.properties.styleId,
						outlineLevel: para.node.properties.outlineLevel,
					},
				});
			}
		});
	}

	private toggleHeading(editor: JPEditor, level: number): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);
		const targetStyleId = `Heading${level}`;
		const allMatch = paragraphs.every((p) => p.node.properties.styleId === targetStyleId);

		if (allMatch) {
			this.clearHeading(editor);
		} else {
			this.setHeading(editor, level);
		}
	}
}
