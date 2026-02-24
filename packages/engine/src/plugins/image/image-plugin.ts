import type { JPImageCrop, JPImageWrapType, JPPath } from '@jpoffice/model';
import {
	createDrawing,
	createImage,
	createRun,
	createText,
	generateId,
	getNodeAtPath,
	isImage,
} from '@jpoffice/model';
import type { JPDrawingProperties } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { deleteSelectionOps, resolveSelectionContext } from '../text/text-utils';
import {
	clampCrop,
	constrainToAspectRatio,
	isValidCrop,
	normalizeRotation,
} from './image-transform';

export interface InsertImageArgs {
	src: string;
	mimeType: string;
	width: number; // EMU
	height: number; // EMU
	altText?: string;
	positioning?: 'inline' | 'floating';
}

export interface ResizeImageArgs {
	path: JPPath; // path to the JPImage node
	width: number; // EMU
	height: number; // EMU
	preserveAspectRatio?: boolean;
}

export interface CropImageArgs {
	path: JPPath; // path to the JPImage node
	top: number; // percentage 0-1
	right: number; // percentage 0-1
	bottom: number; // percentage 0-1
	left: number; // percentage 0-1
}

export interface RotateImageArgs {
	path: JPPath; // path to the JPImage node
	degrees: number;
}

export interface FlipImageArgs {
	path: JPPath; // path to the JPImage node
	horizontal?: boolean;
	vertical?: boolean;
}

export interface SetWrapArgs {
	path: JPPath; // path to the JPImage node
	wrapType: JPImageWrapType;
}

export interface SetAltTextArgs {
	path: JPPath; // path to the JPImage node
	altText: string;
}

export interface ReplaceImageArgs {
	path: JPPath; // path to the JPImage node
	newSrc: string;
	newMimeType: string;
}

export interface ResetImageSizeArgs {
	path: JPPath; // path to the JPImage node
}

/**
 * ImagePlugin handles image insertion and editing:
 * insert, resize, crop, rotate, flip, wrap, alt text, replace, resetSize.
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

		editor.registerCommand<ResizeImageArgs>({
			id: 'image.resize',
			name: 'Resize Image',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.resizeImage(editor, args),
		});

		editor.registerCommand<CropImageArgs>({
			id: 'image.crop',
			name: 'Crop Image',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.cropImage(editor, args),
		});

		editor.registerCommand<RotateImageArgs>({
			id: 'image.rotate',
			name: 'Rotate Image',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.rotateImage(editor, args),
		});

		editor.registerCommand<FlipImageArgs>({
			id: 'image.flip',
			name: 'Flip Image',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.flipImage(editor, args),
		});

		editor.registerCommand<SetWrapArgs>({
			id: 'image.setWrap',
			name: 'Set Image Wrap',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.setWrap(editor, args),
		});

		editor.registerCommand<SetAltTextArgs>({
			id: 'image.setAltText',
			name: 'Set Image Alt Text',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.setAltText(editor, args),
		});

		editor.registerCommand<ReplaceImageArgs>({
			id: 'image.replace',
			name: 'Replace Image',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.replaceImage(editor, args),
		});

		editor.registerCommand<ResetImageSizeArgs>({
			id: 'image.resetSize',
			name: 'Reset Image Size',
			canExecute: (_ed, args) => this.canEditImage(editor, args.path),
			execute: (_ed, args) => this.resetSize(editor, args),
		});
	}

	// ── Helpers ──────────────────────────────────────────────

	/**
	 * Check if the node at the given path is an image and the editor is not read-only.
	 */
	private canEditImage(editor: JPEditor, path: JPPath): boolean {
		if (editor.isReadOnly()) return false;
		try {
			const node = getNodeAtPath(editor.getDocument(), path);
			return isImage(node);
		} catch {
			return false;
		}
	}

	/**
	 * Get the current properties of the image at the given path.
	 * Throws if the path does not point to an image.
	 */
	private getImageProperties(editor: JPEditor, path: JPPath) {
		const node = getNodeAtPath(editor.getDocument(), path);
		if (!isImage(node)) {
			throw new Error(`Node at path [${path.join(',')}] is not an image`);
		}
		return node.properties;
	}

	// ── Commands ─────────────────────────────────────────────

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
				originalWidth: args.width,
				originalHeight: args.height,
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

	private resizeImage(editor: JPEditor, args: ResizeImageArgs): void {
		const props = this.getImageProperties(editor, args.path);
		let { width, height } = args;

		if (args.preserveAspectRatio) {
			const origW = props.originalWidth ?? props.width;
			const origH = props.originalHeight ?? props.height;
			const constrained = constrainToAspectRatio(width, height, origW, origH);
			width = constrained.width;
			height = constrained.height;
		}

		const oldProperties: Record<string, unknown> = {
			width: props.width,
			height: props.height,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { width, height },
			oldProperties,
		});
	}

	private cropImage(editor: JPEditor, args: CropImageArgs): void {
		const props = this.getImageProperties(editor, args.path);
		const rawCrop: JPImageCrop = {
			top: args.top,
			right: args.right,
			bottom: args.bottom,
			left: args.left,
		};

		// Validate and clamp crop values
		const crop = isValidCrop(rawCrop) ? rawCrop : clampCrop(rawCrop);

		const oldProperties: Record<string, unknown> = {
			crop: props.crop ?? null,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { crop },
			oldProperties,
		});
	}

	private rotateImage(editor: JPEditor, args: RotateImageArgs): void {
		const props = this.getImageProperties(editor, args.path);
		const rotation = normalizeRotation(args.degrees);

		const oldProperties: Record<string, unknown> = {
			rotation: props.rotation ?? null,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { rotation: rotation === 0 ? null : rotation },
			oldProperties,
		});
	}

	private flipImage(editor: JPEditor, args: FlipImageArgs): void {
		const props = this.getImageProperties(editor, args.path);
		const newProperties: Record<string, unknown> = {};
		const oldProperties: Record<string, unknown> = {};

		if (args.horizontal !== undefined) {
			const currentFlipH = props.flipH ?? false;
			const newFlipH = args.horizontal ? !currentFlipH : currentFlipH;
			newProperties.flipH = newFlipH || null; // null removes property when false
			oldProperties.flipH = currentFlipH || null;
		}

		if (args.vertical !== undefined) {
			const currentFlipV = props.flipV ?? false;
			const newFlipV = args.vertical ? !currentFlipV : currentFlipV;
			newProperties.flipV = newFlipV || null;
			oldProperties.flipV = currentFlipV || null;
		}

		if (Object.keys(newProperties).length === 0) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: newProperties,
			oldProperties,
		});
	}

	private setWrap(editor: JPEditor, args: SetWrapArgs): void {
		const props = this.getImageProperties(editor, args.path);

		const oldProperties: Record<string, unknown> = {
			wrapType: props.wrapType ?? null,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { wrapType: args.wrapType },
			oldProperties,
		});
	}

	private setAltText(editor: JPEditor, args: SetAltTextArgs): void {
		const props = this.getImageProperties(editor, args.path);

		const oldProperties: Record<string, unknown> = {
			altText: props.altText ?? null,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { altText: args.altText },
			oldProperties,
		});
	}

	private replaceImage(editor: JPEditor, args: ReplaceImageArgs): void {
		const props = this.getImageProperties(editor, args.path);

		const oldProperties: Record<string, unknown> = {
			src: props.src,
			mimeType: props.mimeType,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { src: args.newSrc, mimeType: args.newMimeType },
			oldProperties,
		});
	}

	private resetSize(editor: JPEditor, args: ResetImageSizeArgs): void {
		const props = this.getImageProperties(editor, args.path);

		const origW = props.originalWidth;
		const origH = props.originalHeight;

		// If original dimensions are not stored, nothing to reset to
		if (origW === undefined || origH === undefined) return;

		const oldProperties: Record<string, unknown> = {
			width: props.width,
			height: props.height,
			crop: props.crop ?? null,
		};

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { width: origW, height: origH, crop: null },
			oldProperties,
		});
	}
}
