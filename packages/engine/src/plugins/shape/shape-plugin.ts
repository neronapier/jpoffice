import type { JPPath, JPShape, JPShapeFill, JPShapeStroke, JPShapeType } from '@jpoffice/model';
import {
	createParagraph,
	createRun,
	createShape,
	createShapeGroup,
	createText,
	createTextBox,
	generateId,
	getNodeAtPath,
	isShape,
	isShapeGroup,
	isTextBox,
} from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';

// ── Command argument types ──────────────────────────────────

export interface InsertShapeArgs {
	shapeType: JPShapeType;
	x: number; // EMU
	y: number; // EMU
	width: number; // EMU
	height: number; // EMU
	fill?: JPShapeFill;
	stroke?: JPShapeStroke;
	rotation?: number;
	text?: string;
	zIndex?: number;
}

export interface DeleteShapeArgs {
	path: JPPath;
}

export interface ResizeShapeArgs {
	path: JPPath;
	width: number; // EMU
	height: number; // EMU
}

export interface MoveShapeArgs {
	path: JPPath;
	x: number; // EMU
	y: number; // EMU
}

export interface SetShapePropertiesArgs {
	path: JPPath;
	fill?: JPShapeFill;
	stroke?: JPShapeStroke;
	rotation?: number;
	text?: string;
	zIndex?: number;
}

export interface GroupShapeArgs {
	paths: JPPath[];
}

export interface UngroupShapeArgs {
	path: JPPath;
}

export interface InsertTextBoxArgs {
	x: number; // EMU
	y: number; // EMU
	width: number; // EMU
	height: number; // EMU
	fill?: JPShapeFill;
	stroke?: JPShapeStroke;
	rotation?: number;
	zIndex?: number;
}

export interface DeleteTextBoxArgs {
	path: JPPath;
}

/**
 * ShapePlugin handles shapes and text boxes:
 * insert, delete, resize, move, and set properties.
 */
export class ShapePlugin implements JPPlugin {
	readonly id = 'jpoffice.shape';
	readonly name = 'Shape';

	initialize(editor: JPEditor): void {
		// Shape commands
		editor.registerCommand<InsertShapeArgs>({
			id: 'shape.insert',
			name: 'Insert Shape',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.insertShape(editor, args),
		});

		editor.registerCommand<DeleteShapeArgs>({
			id: 'shape.delete',
			name: 'Delete Shape',
			canExecute: (_ed, args) => this.canEditShape(editor, args.path),
			execute: (_ed, args) => this.deleteShape(editor, args),
		});

		editor.registerCommand<ResizeShapeArgs>({
			id: 'shape.resize',
			name: 'Resize Shape',
			canExecute: (_ed, args) => this.canEditShape(editor, args.path),
			execute: (_ed, args) => this.resizeShape(editor, args),
		});

		editor.registerCommand<MoveShapeArgs>({
			id: 'shape.move',
			name: 'Move Shape',
			canExecute: (_ed, args) => this.canEditShape(editor, args.path),
			execute: (_ed, args) => this.moveShape(editor, args),
		});

		editor.registerCommand<SetShapePropertiesArgs>({
			id: 'shape.setProperties',
			name: 'Set Shape Properties',
			canExecute: (_ed, args) => this.canEditShape(editor, args.path),
			execute: (_ed, args) => this.setShapeProperties(editor, args),
		});

		// Group/Ungroup commands
		editor.registerCommand<GroupShapeArgs>({
			id: 'shape.group',
			name: 'Group Shapes',
			canExecute: (_ed, args) => this.canGroupShapes(editor, args.paths),
			execute: (_ed, args) => this.groupShapes(editor, args),
		});

		editor.registerCommand<UngroupShapeArgs>({
			id: 'shape.ungroup',
			name: 'Ungroup Shapes',
			canExecute: (_ed, args) => this.canUngroupShape(editor, args.path),
			execute: (_ed, args) => this.ungroupShapes(editor, args),
		});

		// TextBox commands
		editor.registerCommand<InsertTextBoxArgs>({
			id: 'textbox.insert',
			name: 'Insert Text Box',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.insertTextBox(editor, args),
		});

		editor.registerCommand<DeleteTextBoxArgs>({
			id: 'textbox.delete',
			name: 'Delete Text Box',
			canExecute: (_ed, args) => this.canEditTextBox(editor, args.path),
			execute: (_ed, args) => this.deleteTextBox(editor, args),
		});
	}

	// ── Helpers ─────────────────────────────────────────────────

	private canEditShape(editor: JPEditor, path: JPPath): boolean {
		if (editor.isReadOnly()) return false;
		try {
			const node = getNodeAtPath(editor.getDocument(), path);
			return isShape(node);
		} catch {
			return false;
		}
	}

	private canEditTextBox(editor: JPEditor, path: JPPath): boolean {
		if (editor.isReadOnly()) return false;
		try {
			const node = getNodeAtPath(editor.getDocument(), path);
			return isTextBox(node);
		} catch {
			return false;
		}
	}

	/**
	 * Find the path to the current section where the cursor is.
	 * Returns the section path (body index + section index).
	 */
	private getSectionPath(editor: JPEditor): JPPath {
		const sel = editor.getSelection();
		if (sel && sel.anchor.path.length >= 2) {
			// Path structure: [bodyIdx, sectionIdx, ...]
			return [sel.anchor.path[0], sel.anchor.path[1]];
		}
		// Default to first section
		return [0, 0];
	}

	/**
	 * Get the number of children in the section so we can append at the end.
	 */
	private getSectionChildCount(editor: JPEditor, sectionPath: JPPath): number {
		const doc = editor.getDocument();
		try {
			const section = getNodeAtPath(doc, sectionPath);
			if ('children' in section) {
				return (section.children as readonly unknown[]).length;
			}
		} catch {
			// fallback
		}
		return 0;
	}

	// ── Shape Commands ──────────────────────────────────────────

	private insertShape(editor: JPEditor, args: InsertShapeArgs): void {
		const shape = createShape(args.shapeType, args.x, args.y, args.width, args.height, {
			fill: args.fill,
			stroke: args.stroke,
			rotation: args.rotation,
			text: args.text,
			zIndex: args.zIndex,
		});

		const sectionPath = this.getSectionPath(editor);
		const childCount = this.getSectionChildCount(editor, sectionPath);
		const insertPath: JPPath = [...sectionPath, childCount];

		editor.apply({
			type: 'insert_node',
			path: insertPath,
			node: shape,
		});
	}

	private deleteShape(editor: JPEditor, args: DeleteShapeArgs): void {
		const node = getNodeAtPath(editor.getDocument(), args.path);
		editor.apply({
			type: 'remove_node',
			path: args.path,
			node,
		});
	}

	private resizeShape(editor: JPEditor, args: ResizeShapeArgs): void {
		const node = getNodeAtPath(editor.getDocument(), args.path);
		if (!isShape(node)) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { width: args.width, height: args.height },
			oldProperties: { width: node.width, height: node.height },
		});
	}

	private moveShape(editor: JPEditor, args: MoveShapeArgs): void {
		const node = getNodeAtPath(editor.getDocument(), args.path);
		if (!isShape(node)) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: { x: args.x, y: args.y },
			oldProperties: { x: node.x, y: node.y },
		});
	}

	private setShapeProperties(editor: JPEditor, args: SetShapePropertiesArgs): void {
		const node = getNodeAtPath(editor.getDocument(), args.path);
		if (!isShape(node)) return;

		const newProperties: Record<string, unknown> = {};
		const oldProperties: Record<string, unknown> = {};

		if (args.fill !== undefined) {
			newProperties.fill = args.fill;
			oldProperties.fill = node.fill ?? null;
		}
		if (args.stroke !== undefined) {
			newProperties.stroke = args.stroke;
			oldProperties.stroke = node.stroke ?? null;
		}
		if (args.rotation !== undefined) {
			newProperties.rotation = args.rotation;
			oldProperties.rotation = node.rotation ?? null;
		}
		if (args.text !== undefined) {
			newProperties.text = args.text;
			oldProperties.text = node.text ?? null;
		}
		if (args.zIndex !== undefined) {
			newProperties.zIndex = args.zIndex;
			oldProperties.zIndex = node.zIndex ?? null;
		}

		if (Object.keys(newProperties).length === 0) return;

		editor.apply({
			type: 'set_properties',
			path: args.path,
			properties: newProperties,
			oldProperties,
		});
	}

	// ── Group/Ungroup Commands ──────────────────────────────────

	private canGroupShapes(editor: JPEditor, paths: JPPath[]): boolean {
		if (editor.isReadOnly()) return false;
		if (!paths || paths.length < 2) return false;
		try {
			for (const path of paths) {
				const node = getNodeAtPath(editor.getDocument(), path);
				if (!isShape(node)) return false;
			}
			return true;
		} catch {
			return false;
		}
	}

	private canUngroupShape(editor: JPEditor, path: JPPath): boolean {
		if (editor.isReadOnly()) return false;
		try {
			const node = getNodeAtPath(editor.getDocument(), path);
			return isShapeGroup(node);
		} catch {
			return false;
		}
	}

	private groupShapes(editor: JPEditor, args: GroupShapeArgs): void {
		const doc = editor.getDocument();
		// Collect the shape nodes
		const shapes: JPShape[] = [];
		for (const path of args.paths) {
			const node = getNodeAtPath(doc, path);
			if (isShape(node)) {
				shapes.push(node);
			}
		}

		if (shapes.length < 2) return;

		// Sort paths in descending order so removal doesn't shift earlier indices
		const sortedPaths = [...args.paths].sort((a, b) => {
			for (let i = 0; i < Math.min(a.length, b.length); i++) {
				if (a[i] !== b[i]) return b[i] - a[i]; // descending
			}
			return b.length - a.length;
		});

		const group = createShapeGroup(shapes);

		editor.batch(() => {
			// Remove shapes in reverse order
			for (const path of sortedPaths) {
				const node = getNodeAtPath(editor.getDocument(), path);
				editor.apply({
					type: 'remove_node',
					path,
					node,
				});
			}

			// Insert the group at the position of the first (lowest index) shape
			// The first path in ascending order (last in sortedPaths)
			const insertPath = sortedPaths[sortedPaths.length - 1];
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: group,
			});
		});
	}

	private ungroupShapes(editor: JPEditor, args: UngroupShapeArgs): void {
		const doc = editor.getDocument();
		const node = getNodeAtPath(doc, args.path);
		if (!isShapeGroup(node)) return;

		const childShapes = node.children;

		editor.batch(() => {
			// Remove the group node
			editor.apply({
				type: 'remove_node',
				path: args.path,
				node,
			});

			// Insert each child shape at the group's position
			for (let i = 0; i < childShapes.length; i++) {
				const insertPath = [...args.path.slice(0, -1), args.path[args.path.length - 1] + i];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: childShapes[i],
				});
			}
		});
	}

	// ── TextBox Commands ────────────────────────────────────────

	private insertTextBox(editor: JPEditor, args: InsertTextBoxArgs): void {
		// Create a text box with a single empty paragraph inside
		const emptyPara = createParagraph(generateId(), [
			createRun(generateId(), [createText(generateId(), '')]),
		]);

		const textBox = createTextBox(args.x, args.y, args.width, args.height, {
			children: [emptyPara],
			fill: args.fill,
			stroke: args.stroke,
			rotation: args.rotation,
			zIndex: args.zIndex,
		});

		const sectionPath = this.getSectionPath(editor);
		const childCount = this.getSectionChildCount(editor, sectionPath);
		const insertPath: JPPath = [...sectionPath, childCount];

		editor.apply({
			type: 'insert_node',
			path: insertPath,
			node: textBox,
		});
	}

	private deleteTextBox(editor: JPEditor, args: DeleteTextBoxArgs): void {
		const node = getNodeAtPath(editor.getDocument(), args.path);
		editor.apply({
			type: 'remove_node',
			path: args.path,
			node,
		});
	}
}
