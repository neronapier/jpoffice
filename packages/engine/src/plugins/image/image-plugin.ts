import type { JPPath } from '@jpoffice/model';
import { createDrawing, createImage, createRun, createText, generateId } from '@jpoffice/model';
import type { JPDrawingProperties } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps, resolveSelectionContext } from '../text/text-utils';

export interface InsertImageArgs {
	src: string;
	mimeType: string;
	width: number; // EMU
	height: number; // EMU
	altText?: string;
	positioning?: 'inline' | 'floating';
}

/**
 * ImagePlugin handles image insertion.
 */
export class ImagePlugin implements JPPlugin {
	readonly id = 'jpoffice.image';
	readonly name = 'Image';

	initialize(editor: JPEditor): void {
		editor.registerCommand<InsertImageArgs>({
			id: 'image.insert',
			name: 'Insert Image',
			canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
			execute: (_ed, args) => this.insertImage(editor, args),
		});
	}

	private insertImage(editor: JPEditor, args: InsertImageArgs): void {
		const sel = editor.getSelection();
		if (!sel) return;

		editor.batch(() => {
			let currentSel = sel;

			// Delete selection if range
			if (!SelectionManager.isCollapsed(sel)) {
				const { ops, collapsedPoint } = deleteSelectionOps(editor.getDocument(), sel);
				for (const op of ops) editor.apply(op);
				currentSel = { anchor: collapsedPoint, focus: collapsedPoint };
			}

			const doc = editor.getDocument();
			const ctx = resolveSelectionContext(doc, currentSel.anchor);

			const image = createImage(generateId(), {
				src: args.src,
				mimeType: args.mimeType,
				width: args.width,
				height: args.height,
				altText: args.altText,
			});

			const drawingProps: JPDrawingProperties = {
				positioning: args.positioning ?? 'inline',
				inline:
					(args.positioning ?? 'inline') === 'inline'
						? { distTop: 0, distBottom: 0, distLeft: 0, distRight: 0 }
						: undefined,
			};

			const drawing = createDrawing(generateId(), image, drawingProps);

			// Split the current run at the cursor, insert drawing between
			if (ctx.offset > 0 && ctx.offset < ctx.textNode.text.length) {
				// Mid-text: split text then split run
				editor.apply({
					type: 'split_node',
					path: ctx.textPath,
					position: ctx.offset,
					properties: {},
				});
				const textIdx = ctx.textPath[ctx.textPath.length - 1];
				editor.apply({
					type: 'split_node',
					path: ctx.runPath,
					position: textIdx + 1,
					properties: {},
				});
				// Insert drawing between the two runs
				const insertPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: drawing,
				});
				// Cursor to start of next run
				const nextRunPath: JPPath = [...ctx.paragraphPath, ctx.runIndex + 2];
				const nextTextPath: JPPath = [...nextRunPath, 0];
				const newPoint = { path: nextTextPath, offset: 0 };
				editor.setSelection({ anchor: newPoint, focus: newPoint });
			} else {
				// At start or end of text — insert drawing adjacent to current run
				const insertIdx = ctx.offset === 0 ? ctx.runIndex : ctx.runIndex + 1;
				const insertPath: JPPath = [...ctx.paragraphPath, insertIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: drawing,
				});
				// Create a new empty run after the drawing if at end
				if (ctx.offset > 0) {
					const emptyRun = createRun(generateId(), [createText(generateId(), '')]);
					const emptyRunPath: JPPath = [...ctx.paragraphPath, insertIdx + 1];
					editor.apply({
						type: 'insert_node',
						path: emptyRunPath,
						node: emptyRun,
					});
					const newTextPath: JPPath = [...emptyRunPath, 0];
					const newPoint = { path: newTextPath, offset: 0 };
					editor.setSelection({ anchor: newPoint, focus: newPoint });
				}
			}
		});
	}
}
