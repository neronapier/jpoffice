import type { JPDocument, JPParagraph, JPRun, JPStyle } from '@jpoffice/model';
import { createStyleRegistry, findStyle, traverseByType } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import { SelectionManager } from '../../selection/selection-manager';
import type { JPPlugin } from '../plugin';
import { getParagraphsInRange, getRunsInRange, resolveSelectionContext } from '../text/text-utils';
import type {
	CreateStyleArgs,
	DeleteStyleArgs,
	ModifyStyleArgs,
	RenameStyleArgs,
	StyleInfo,
	StyleProperties,
} from './style-types';

/** IDs of built-in styles that cannot be deleted. */
const BUILT_IN_STYLE_IDS = new Set([
	'Normal',
	'Heading1',
	'Heading2',
	'Heading3',
	'Heading4',
	'Heading5',
	'Heading6',
	'ListParagraph',
	'TableNormal',
]);

/**
 * StylesPlugin handles applying, clearing, creating, modifying,
 * renaming, and deleting named styles on paragraphs and runs.
 */
export class StylesPlugin implements JPPlugin {
	readonly id = 'jpoffice.styles';
	readonly name = 'Styles';

	private stylesChangeCallbacks: Array<(styles: readonly StyleInfo[]) => void> = [];

	initialize(editor: JPEditor): void {
		// ── Existing commands ──────────────────────────────────
		editor.registerCommand<{
			styleId: string;
			type?: 'paragraph' | 'character';
		}>({
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

		// ── New commands ──────────────────────────────────────
		editor.registerCommand<CreateStyleArgs>({
			id: 'styles.create',
			name: 'Create Style',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.createStyle(editor, args),
		});

		editor.registerCommand<ModifyStyleArgs>({
			id: 'styles.modify',
			name: 'Modify Style',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.modifyStyle(editor, args),
		});

		editor.registerCommand<DeleteStyleArgs>({
			id: 'styles.delete',
			name: 'Delete Style',
			canExecute: (_ed, args) =>
				!editor.isReadOnly() && !BUILT_IN_STYLE_IDS.has(args?.styleId ?? ''),
			execute: (_ed, args) => this.deleteStyle(editor, args.styleId),
		});

		editor.registerCommand<RenameStyleArgs>({
			id: 'styles.rename',
			name: 'Rename Style',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.renameStyle(editor, args.styleId, args.newName),
		});

		editor.registerCommand({
			id: 'styles.getAll',
			name: 'Get All Styles',
			canExecute: () => true,
			execute: () => {
				/* Query method - use getAllStyles() directly */
			},
		});

		editor.registerCommand({
			id: 'styles.getCurrent',
			name: 'Get Current Style',
			canExecute: () => editor.getSelection() !== null,
			execute: () => {
				/* Query method - use getCurrentStyle() directly */
			},
		});
	}

	// ── Public query methods ──────────────────────────────────

	/**
	 * Returns all styles (built-in + custom) with their properties
	 * and usage status.
	 */
	getAllStyles(doc: JPDocument): readonly StyleInfo[] {
		const registry = doc.styles;
		const usedStyleIds = this.collectUsedStyleIds(doc);

		return registry.styles
			.filter((s) => s.type === 'paragraph' || s.type === 'character')
			.map((style) => this.toStyleInfo(style, usedStyleIds));
	}

	/**
	 * Returns the style applied at the current cursor position.
	 * Returns null if no selection or the style cannot be resolved.
	 */
	getCurrentStyle(editor: JPEditor): StyleInfo | null {
		const sel = editor.getSelection();
		if (!sel) return null;

		const doc = editor.getDocument();
		try {
			const ctx = resolveSelectionContext(doc, sel.anchor);
			const styleId = ctx.paragraph.properties.styleId ?? 'Normal';
			const registry = doc.styles;
			const style = findStyle(registry, styleId);
			if (!style) return null;

			const usedStyleIds = this.collectUsedStyleIds(doc);
			return this.toStyleInfo(style, usedStyleIds);
		} catch {
			return null;
		}
	}

	/**
	 * Returns only styles that are currently referenced in the document.
	 */
	getStylesInUse(doc: JPDocument): readonly StyleInfo[] {
		const usedStyleIds = this.collectUsedStyleIds(doc);
		const registry = doc.styles;

		return registry.styles
			.filter((s) => (s.type === 'paragraph' || s.type === 'character') && usedStyleIds.has(s.id))
			.map((style) => this.toStyleInfo(style, usedStyleIds));
	}

	/**
	 * Register a callback that fires when styles are modified
	 * (created, modified, deleted, or renamed).
	 * Returns an unsubscribe function.
	 */
	onStylesChange(callback: (styles: readonly StyleInfo[]) => void): () => void {
		this.stylesChangeCallbacks.push(callback);
		return () => {
			const idx = this.stylesChangeCallbacks.indexOf(callback);
			if (idx >= 0) {
				this.stylesChangeCallbacks.splice(idx, 1);
			}
		};
	}

	// ── Style mutation methods ────────────────────────────────

	private createStyle(editor: JPEditor, args: CreateStyleArgs): void {
		const doc = editor.getDocument();
		const registry = doc.styles;

		// Prevent duplicate IDs - generate from name
		const styleId = this.nameToId(args.name);
		if (findStyle(registry, styleId)) {
			return; // Style with this ID already exists
		}

		const newStyle: JPStyle = {
			id: styleId,
			name: args.name,
			type: args.type,
			basedOn: args.basedOn,
			next: args.nextStyle,
			paragraphProperties: this.extractParagraphProps(args.properties),
			runProperties: this.extractRunProps(args.properties),
		};

		const newRegistry = createStyleRegistry([...registry.styles, newStyle]);
		editor.updateDocumentStyles(newRegistry);
		this.notifyStylesChange(editor);
	}

	private modifyStyle(editor: JPEditor, args: ModifyStyleArgs): void {
		const doc = editor.getDocument();
		const registry = doc.styles;
		const existing = findStyle(registry, args.styleId);
		if (!existing) return;

		const mergedParaProps = {
			...existing.paragraphProperties,
			...this.extractParagraphProps(args.properties),
		};
		const mergedRunProps = {
			...existing.runProperties,
			...this.extractRunProps(args.properties),
		};

		const updatedStyle: JPStyle = {
			...existing,
			paragraphProperties: mergedParaProps,
			runProperties: mergedRunProps,
		};

		const newStyles = registry.styles.map((s) => (s.id === args.styleId ? updatedStyle : s));
		editor.updateDocumentStyles(createStyleRegistry(newStyles));
		this.notifyStylesChange(editor);
	}

	private deleteStyle(editor: JPEditor, styleId: string): void {
		if (BUILT_IN_STYLE_IDS.has(styleId)) return;

		const doc = editor.getDocument();
		const registry = doc.styles;
		if (!findStyle(registry, styleId)) return;

		const newStyles = registry.styles.filter((s) => s.id !== styleId);
		editor.updateDocumentStyles(createStyleRegistry(newStyles));
		this.notifyStylesChange(editor);
	}

	private renameStyle(editor: JPEditor, styleId: string, newName: string): void {
		const doc = editor.getDocument();
		const registry = doc.styles;
		const existing = findStyle(registry, styleId);
		if (!existing) return;

		const updatedStyle: JPStyle = {
			...existing,
			name: newName,
		};

		const newStyles = registry.styles.map((s) => (s.id === styleId ? updatedStyle : s));
		editor.updateDocumentStyles(createStyleRegistry(newStyles));
		this.notifyStylesChange(editor);
	}

	// ── Existing apply/clear methods ──────────────────────────

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
						oldProperties: {
							styleId: para.node.properties.styleId,
						},
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
						oldProperties: {
							styleId: run.node.properties.styleId,
						},
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
					oldProperties: {
						styleId: para.node.properties.styleId,
					},
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
							oldProperties: {
								styleId: run.node.properties.styleId,
							},
						});
					}
				}
			}
		});
	}

	// ── Internal helpers ──────────────────────────────────────

	/**
	 * Collect all style IDs referenced by paragraphs and runs in the document.
	 */
	private collectUsedStyleIds(doc: JPDocument): Set<string> {
		const used = new Set<string>();

		for (const [para] of traverseByType<JPParagraph>(doc, 'paragraph')) {
			if (para.properties.styleId) {
				used.add(para.properties.styleId);
			}
		}

		for (const [run] of traverseByType<JPRun>(doc, 'run')) {
			if (run.properties.styleId) {
				used.add(run.properties.styleId);
			}
		}

		return used;
	}

	/**
	 * Convert a JPStyle to a StyleInfo for UI consumption.
	 */
	private toStyleInfo(style: JPStyle, usedIds: Set<string>): StyleInfo {
		const props: StyleProperties = {
			// Paragraph properties
			alignment: style.paragraphProperties?.alignment,
			spacing: style.paragraphProperties?.spacing
				? {
						before: style.paragraphProperties.spacing.before,
						after: style.paragraphProperties.spacing.after,
						line: style.paragraphProperties.spacing.line,
					}
				: undefined,
			indent: style.paragraphProperties?.indent
				? {
						left: style.paragraphProperties.indent.left,
						right: style.paragraphProperties.indent.right,
						firstLine: style.paragraphProperties.indent.firstLine,
					}
				: undefined,
			outlineLevel: style.paragraphProperties?.outlineLevel,
			// Run properties
			fontFamily: style.runProperties?.fontFamily,
			fontSize: style.runProperties?.fontSize,
			bold: style.runProperties?.bold,
			italic: style.runProperties?.italic,
			underline: style.runProperties?.underline,
			color: style.runProperties?.color,
		};

		return {
			id: style.id,
			name: style.name,
			type: style.type === 'character' ? 'character' : 'paragraph',
			basedOn: style.basedOn,
			nextStyle: style.next,
			builtIn: BUILT_IN_STYLE_IDS.has(style.id),
			inUse: usedIds.has(style.id),
			properties: props,
		};
	}

	/**
	 * Extract paragraph-level properties from flat StyleProperties.
	 */
	private extractParagraphProps(props: Partial<StyleProperties>): JPStyle['paragraphProperties'] {
		const result: Record<string, unknown> = {};
		if (props.alignment !== undefined) result.alignment = props.alignment;
		if (props.spacing !== undefined) result.spacing = props.spacing;
		if (props.indent !== undefined) result.indent = props.indent;
		if (props.outlineLevel !== undefined) result.outlineLevel = props.outlineLevel;
		return Object.keys(result).length > 0 ? (result as JPStyle['paragraphProperties']) : undefined;
	}

	/**
	 * Extract run-level properties from flat StyleProperties.
	 */
	private extractRunProps(props: Partial<StyleProperties>): JPStyle['runProperties'] {
		const result: Record<string, unknown> = {};
		if (props.fontFamily !== undefined) result.fontFamily = props.fontFamily;
		if (props.fontSize !== undefined) result.fontSize = props.fontSize;
		if (props.bold !== undefined) result.bold = props.bold;
		if (props.italic !== undefined) result.italic = props.italic;
		if (props.underline !== undefined) result.underline = props.underline;
		if (props.color !== undefined) result.color = props.color;
		return Object.keys(result).length > 0 ? (result as JPStyle['runProperties']) : undefined;
	}

	/**
	 * Convert a style name to a camelCase ID.
	 */
	private nameToId(name: string): string {
		return name
			.split(/\s+/)
			.map((word, i) =>
				i === 0
					? word.charAt(0).toUpperCase() + word.slice(1)
					: word.charAt(0).toUpperCase() + word.slice(1),
			)
			.join('');
	}

	/**
	 * Notify all registered callbacks about style changes.
	 */
	private notifyStylesChange(editor: JPEditor): void {
		if (this.stylesChangeCallbacks.length === 0) return;
		const allStyles = this.getAllStyles(editor.getDocument());
		for (const cb of this.stylesChangeCallbacks) {
			cb(allStyles);
		}
	}

	destroy(): void {
		this.stylesChangeCallbacks = [];
	}
}
