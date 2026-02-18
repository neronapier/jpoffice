import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { getParagraphsInRange, getRunsInRange } from '../text/text-utils';

/**
 * StylesPlugin handles applying and clearing named styles on paragraphs and runs.
 */
export class StylesPlugin implements JPPlugin {
	readonly id = 'jpoffice.styles';
	readonly name = 'Styles';

	initialize(editor: JPEditor): void {
		editor.registerCommand<{ styleId: string; type?: 'paragraph' | 'character' }>({
			id: 'styles.apply',
			name: 'Apply Style',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.applyStyle(editor, args.styleId, args.type ?? 'paragraph'),
		});

		editor.registerCommand({
			id: 'styles.clear',
			name: 'Clear Style',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: () => this.clearStyle(editor),
		});
	}

	private applyStyle(editor: JPEditor, styleId: string, type: 'paragraph' | 'character'): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();

		if (type === 'paragraph') {
			const paragraphs = getParagraphsInRange(doc, sel);
			editor.batch(() => {
				for (const para of paragraphs) {
					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: { styleId },
						oldProperties: { styleId: para.node.properties.styleId },
					});
				}
			});
		} else {
			const runs = getRunsInRange(doc, sel);
			editor.batch(() => {
				for (const run of runs) {
					editor.apply({
						type: 'set_properties',
						path: run.path,
						properties: { styleId },
						oldProperties: { styleId: run.node.properties.styleId },
					});
				}
			});
		}
	}

	private clearStyle(editor: JPEditor): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: { styleId: 'Normal' },
					oldProperties: { styleId: para.node.properties.styleId },
				});
			}

			if (!SelectionManager.isCollapsed(sel)) {
				const runs = getRunsInRange(doc, sel);
				for (const run of runs) {
					if (run.node.properties.styleId) {
						editor.apply({
							type: 'set_properties',
							path: run.path,
							properties: { styleId: null },
							oldProperties: { styleId: run.node.properties.styleId },
						});
					}
				}
			}
		});
	}
}
