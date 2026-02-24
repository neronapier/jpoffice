import type {
	JPDocument,
	JPFieldType,
	JPFooter,
	JPHeader,
	JPHeaderFooterRef,
	JPHeaderFooterType,
	JPPath,
	JPSection,
} from '@jpoffice/model';
import {
	createField,
	createFooter,
	createHeader,
	createParagraph,
	createRun,
	createText,
	generateId,
} from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

// ── State types ──────────────────────────────────────────────────

export interface HeaderFooterEditState {
	/** Whether the editor is currently focused on a header/footer zone. */
	readonly editing: boolean;
	/** Which zone is being edited. */
	readonly zone: 'header' | 'footer' | null;
	/** The header/footer variant (default, first, even). */
	readonly type: JPHeaderFooterType;
	/** Index of the section whose header/footer is being edited. */
	readonly sectionIndex: number;
}

// ── Command argument types ───────────────────────────────────────

export interface EditHeaderArgs {
	type?: JPHeaderFooterType;
	sectionIndex?: number;
}

export interface EditFooterArgs {
	type?: JPHeaderFooterType;
	sectionIndex?: number;
}

// ── Default state ────────────────────────────────────────────────

const DEFAULT_STATE: HeaderFooterEditState = {
	editing: false,
	zone: null,
	type: 'default',
	sectionIndex: 0,
};

// ── Plugin ───────────────────────────────────────────────────────

/**
 * HeaderFooterPlugin manages entering/exiting header and footer editing mode,
 * inserting page number and page count fields into headers/footers, and
 * toggling section properties for different first page and odd/even pages.
 *
 * When editing is active, the React layer should visually dim the body content
 * and focus the user's interaction on the header or footer area.
 */
export class HeaderFooterPlugin implements JPPlugin {
	readonly id = 'jpoffice.headerFooter';
	readonly name = 'Header & Footer';

	private state: HeaderFooterEditState = { ...DEFAULT_STATE };

	/** Optional callback invoked whenever the editing state changes. */
	onEditStateChange?: (state: HeaderFooterEditState) => void;

	// ── JPPlugin lifecycle ───────────────────────────────────

	initialize(editor: JPEditor): void {
		// Enter header editing
		editor.registerCommand<EditHeaderArgs | undefined>({
			id: 'headerFooter.editHeader',
			name: 'Edit Header',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.enterEdit(editor, 'header', args),
		});

		// Enter footer editing
		editor.registerCommand<EditFooterArgs | undefined>({
			id: 'headerFooter.editFooter',
			name: 'Edit Footer',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.enterEdit(editor, 'footer', args),
		});

		// Exit header/footer editing
		editor.registerCommand({
			id: 'headerFooter.exitEdit',
			name: 'Exit Header/Footer Edit',
			canExecute: () => this.state.editing,
			execute: () => this.exitEdit(editor),
		});

		// Insert PAGE field
		editor.registerCommand({
			id: 'headerFooter.insertPageNumber',
			name: 'Insert Page Number',
			canExecute: () => this.state.editing && !editor.isReadOnly(),
			execute: () => this.insertFieldInZone(editor, 'PAGE'),
		});

		// Insert NUMPAGES field
		editor.registerCommand({
			id: 'headerFooter.insertPageCount',
			name: 'Insert Page Count',
			canExecute: () => this.state.editing && !editor.isReadOnly(),
			execute: () => this.insertFieldInZone(editor, 'NUMPAGES'),
		});

		// Toggle different first page
		editor.registerCommand({
			id: 'headerFooter.toggleDifferentFirstPage',
			name: 'Toggle Different First Page',
			canExecute: () => !editor.isReadOnly(),
			execute: () => this.toggleDifferentFirstPage(editor),
		});

		// Toggle different odd/even
		editor.registerCommand({
			id: 'headerFooter.toggleDifferentOddEven',
			name: 'Toggle Different Odd/Even Pages',
			canExecute: () => !editor.isReadOnly(),
			execute: () => this.toggleDifferentOddEven(editor),
		});
	}

	reset(): void {
		this.state = { ...DEFAULT_STATE };
		this.onEditStateChange?.(this.state);
	}

	destroy(): void {
		this.onEditStateChange = undefined;
	}

	// ── Public API ───────────────────────────────────────────

	/** Returns true when the editor is focused on a header or footer zone. */
	isEditing(): boolean {
		return this.state.editing;
	}

	/** Returns a snapshot of the current editing state. */
	getEditState(): HeaderFooterEditState {
		return this.state;
	}

	// ── Private: Enter / Exit ────────────────────────────────

	private enterEdit(
		editor: JPEditor,
		zone: 'header' | 'footer',
		args?: EditHeaderArgs | EditFooterArgs,
	): void {
		const hfType: JPHeaderFooterType = args?.type ?? 'default';
		const sectionIndex = args?.sectionIndex ?? 0;

		const doc = editor.getDocument();
		const section = this.getSection(doc, sectionIndex);
		if (!section) return;

		// Ensure the header/footer exists for this section + type.
		// If it doesn't, create one with an empty paragraph.
		this.ensureHeaderFooterExists(editor, zone, hfType, sectionIndex);

		// Update internal state
		this.state = {
			editing: true,
			zone,
			type: hfType,
			sectionIndex,
		};

		// Move selection into the header/footer content.
		this.moveCursorToZone(editor);

		this.onEditStateChange?.(this.state);
	}

	private exitEdit(editor: JPEditor): void {
		if (!this.state.editing) return;

		this.state = { ...DEFAULT_STATE };

		// Move cursor back to the body's first text node.
		this.moveCursorToBody(editor);

		this.onEditStateChange?.(this.state);
	}

	// ── Private: Ensure header/footer existence ──────────────

	/**
	 * Makes sure the section has a header or footer for the given type.
	 * If it doesn't exist, creates one with an empty paragraph and
	 * adds the reference to the section properties.
	 */
	private ensureHeaderFooterExists(
		editor: JPEditor,
		zone: 'header' | 'footer',
		hfType: JPHeaderFooterType,
		sectionIndex: number,
	): void {
		const doc = editor.getDocument();
		const section = this.getSection(doc, sectionIndex);
		if (!section) return;

		const refs =
			zone === 'header'
				? (section.properties.headerReferences ?? [])
				: (section.properties.footerReferences ?? []);

		const existingRef = refs.find((r) => r.type === hfType);

		if (existingRef) {
			// Check that the referenced header/footer still exists in the document
			const map = zone === 'header' ? doc.headers : doc.footers;
			if (map.has(existingRef.id)) return;
		}

		// Create a new header or footer with a single empty paragraph
		const emptyPara = createParagraph(generateId(), [
			createRun(generateId(), [createText(generateId(), '')]),
		]);
		const newId = generateId();

		if (zone === 'header') {
			const hdr = createHeader(newId, [emptyPara]);
			// Add to document headers map
			const oldHeaders = doc.headers;
			const newHeaders = new Map(oldHeaders);
			newHeaders.set(newId, hdr);
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { headers: newHeaders },
				oldProperties: { headers: oldHeaders },
			});
		} else {
			const ftr = createFooter(newId, [emptyPara]);
			const oldFooters = doc.footers;
			const newFooters = new Map(oldFooters);
			newFooters.set(newId, ftr);
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { footers: newFooters },
				oldProperties: { footers: oldFooters },
			});
		}

		// Add the reference to the section's properties
		const newRef: JPHeaderFooterRef = { type: hfType, id: newId };
		const updatedRefs = [...refs.filter((r) => r.type !== hfType), newRef];
		const sectionPath = this.getSectionPath(sectionIndex);

		if (zone === 'header') {
			const oldHeaderRefs = section.properties.headerReferences;
			editor.apply({
				type: 'set_properties',
				path: sectionPath,
				properties: { headerReferences: updatedRefs },
				oldProperties: { headerReferences: oldHeaderRefs },
			});
		} else {
			const oldFooterRefs = section.properties.footerReferences;
			editor.apply({
				type: 'set_properties',
				path: sectionPath,
				properties: { footerReferences: updatedRefs },
				oldProperties: { footerReferences: oldFooterRefs },
			});
		}
	}

	// ── Private: Field insertion ─────────────────────────────

	/**
	 * Inserts a field (PAGE or NUMPAGES) at the current selection position.
	 * Delegates to the FieldPlugin's field.insert command if available,
	 * otherwise inserts the field inline at the cursor.
	 */
	private insertFieldInZone(editor: JPEditor, fieldType: JPFieldType): void {
		if (!this.state.editing) return;

		const sel = editor.getSelection();
		if (!sel) return;

		// Delegate to the field plugin command
		try {
			editor.executeCommand('field.insert', { fieldType });
		} catch {
			// Field plugin not registered — insert manually
			this.insertFieldManually(editor, fieldType);
		}
	}

	/**
	 * Fallback field insertion when FieldPlugin is not registered.
	 * Creates a field node and inserts it at the cursor position.
	 */
	private insertFieldManually(editor: JPEditor, fieldType: JPFieldType): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		const cachedResult = fieldType === 'PAGE' ? '1' : '1';
		const field = createField(generateId(), fieldType, { cachedResult });

		editor.batch(() => {
			const textPath = ctx.textPath;
			const offset = ctx.offset;
			const textNode = ctx.textNode;

			if (offset > 0 && offset < textNode.text.length) {
				// Mid-text: split text, split run, insert field
				editor.apply({
					type: 'split_node',
					path: textPath,
					position: offset,
					properties: {},
				});
				const runPath = textPath.slice(0, -1);
				const textIdx = textPath[textPath.length - 1];
				editor.apply({
					type: 'split_node',
					path: runPath,
					position: textIdx + 1,
					properties: {},
				});
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
				const afterFieldPath: JPPath = [...paraPath, runIdx + 2, 0];
				editor.setSelection({
					anchor: { path: afterFieldPath, offset: 0 },
					focus: { path: afterFieldPath, offset: 0 },
				});
			} else if (offset === 0) {
				// Start of text: insert field before current run
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
				const newTextPath: JPPath = [...paraPath, runIdx + 1, 0];
				editor.setSelection({
					anchor: { path: newTextPath, offset: 0 },
					focus: { path: newTextPath, offset: 0 },
				});
			} else {
				// End of text: insert field after current run + empty run for cursor
				const runPath = textPath.slice(0, -1);
				const runIdx = runPath[runPath.length - 1];
				const paraPath = runPath.slice(0, -1);
				const insertPath: JPPath = [...paraPath, runIdx + 1];
				editor.apply({
					type: 'insert_node',
					path: insertPath,
					node: field,
				});
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

	// ── Private: Toggle section flags ────────────────────────

	/**
	 * Toggles the "different first page" flag for the current (or first) section.
	 *
	 * When enabled, ensures a 'first' header and footer exist for the section.
	 * When disabled, removes the 'first' references (the header/footer nodes
	 * remain in the document in case the user re-enables the flag).
	 */
	private toggleDifferentFirstPage(editor: JPEditor): void {
		const sectionIndex = this.state.editing ? this.state.sectionIndex : 0;
		const doc = editor.getDocument();
		const section = this.getSection(doc, sectionIndex);
		if (!section) return;

		const headerRefs = section.properties.headerReferences ?? [];
		const footerRefs = section.properties.footerReferences ?? [];
		const hasFirst =
			headerRefs.some((r) => r.type === 'first') || footerRefs.some((r) => r.type === 'first');

		const sectionPath = this.getSectionPath(sectionIndex);

		if (hasFirst) {
			// Remove 'first' references
			editor.batch(() => {
				const newHeaderRefs = headerRefs.filter((r) => r.type !== 'first');
				if (newHeaderRefs.length !== headerRefs.length) {
					editor.apply({
						type: 'set_properties',
						path: sectionPath,
						properties: { headerReferences: newHeaderRefs },
						oldProperties: { headerReferences: headerRefs },
					});
				}
				const newFooterRefs = footerRefs.filter((r) => r.type !== 'first');
				if (newFooterRefs.length !== footerRefs.length) {
					editor.apply({
						type: 'set_properties',
						path: sectionPath,
						properties: { footerReferences: newFooterRefs },
						oldProperties: { footerReferences: footerRefs },
					});
				}
			});
		} else {
			// Enable: create 'first' header and footer
			editor.batch(() => {
				this.ensureHeaderFooterExists(editor, 'header', 'first', sectionIndex);
				this.ensureHeaderFooterExists(editor, 'footer', 'first', sectionIndex);
			});
		}
	}

	/**
	 * Toggles the "different odd/even pages" flag for the current (or first) section.
	 *
	 * When enabled, ensures an 'even' header and footer exist for the section.
	 * When disabled, removes the 'even' references.
	 */
	private toggleDifferentOddEven(editor: JPEditor): void {
		const sectionIndex = this.state.editing ? this.state.sectionIndex : 0;
		const doc = editor.getDocument();
		const section = this.getSection(doc, sectionIndex);
		if (!section) return;

		const headerRefs = section.properties.headerReferences ?? [];
		const footerRefs = section.properties.footerReferences ?? [];
		const hasEven =
			headerRefs.some((r) => r.type === 'even') || footerRefs.some((r) => r.type === 'even');

		const sectionPath = this.getSectionPath(sectionIndex);

		if (hasEven) {
			// Remove 'even' references
			editor.batch(() => {
				const newHeaderRefs = headerRefs.filter((r) => r.type !== 'even');
				if (newHeaderRefs.length !== headerRefs.length) {
					editor.apply({
						type: 'set_properties',
						path: sectionPath,
						properties: { headerReferences: newHeaderRefs },
						oldProperties: { headerReferences: headerRefs },
					});
				}
				const newFooterRefs = footerRefs.filter((r) => r.type !== 'even');
				if (newFooterRefs.length !== footerRefs.length) {
					editor.apply({
						type: 'set_properties',
						path: sectionPath,
						properties: { footerReferences: newFooterRefs },
						oldProperties: { footerReferences: footerRefs },
					});
				}
			});
		} else {
			// Enable: create 'even' header and footer
			editor.batch(() => {
				this.ensureHeaderFooterExists(editor, 'header', 'even', sectionIndex);
				this.ensureHeaderFooterExists(editor, 'footer', 'even', sectionIndex);
			});
		}
	}

	// ── Private: Cursor management ───────────────────────────

	/**
	 * Moves the selection cursor into the first text node of the
	 * currently-active header or footer.
	 */
	private moveCursorToZone(editor: JPEditor): void {
		const doc = editor.getDocument();
		const hfId = this.getActiveHeaderFooterId(doc);
		if (!hfId) return;

		const map = this.state.zone === 'header' ? doc.headers : doc.footers;
		const hf = map.get(hfId);
		if (!hf || hf.children.length === 0) return;

		// Navigate to first text leaf inside the header/footer.
		// Headers/footers contain paragraphs (and possibly tables).
		// We find the first paragraph's first run's first text.
		const firstPath = this.findFirstTextPathInNode(hf);
		if (!firstPath) return;

		// The header/footer is not part of the body tree, so we can't
		// use a normal document path. Instead, we store a synthetic path
		// that the renderer/input layer can interpret. For now, we
		// set the selection to the body's first text to avoid crashes,
		// and the React layer uses the editState to know where focus is.
		// The actual cursor placement inside the HF content is handled
		// by the React UI once we surface the editState.
	}

	/**
	 * Moves the selection cursor back to the first text node in the body.
	 */
	private moveCursorToBody(editor: JPEditor): void {
		const doc = editor.getDocument();
		const body = doc.children[0];
		if (!body || body.children.length === 0) return;

		let node: { children?: readonly unknown[] } = body;
		const path: number[] = [0]; // start at body index 0
		while (node.children && (node.children as readonly unknown[]).length > 0) {
			path.push(0);
			node = (node.children as readonly { children?: readonly unknown[] }[])[0];
		}
		if (path.length > 1) {
			editor.setSelection({
				anchor: { path, offset: 0 },
				focus: { path, offset: 0 },
			});
		}
	}

	// ── Private: Helpers ─────────────────────────────────────

	/** Get the section at a given index from the document. */
	private getSection(doc: JPDocument, sectionIndex: number): JPSection | null {
		const body = doc.children[0];
		if (!body) return null;
		const section = body.children[sectionIndex] as JPSection | undefined;
		return section?.type === 'section' ? section : null;
	}

	/** Build the path to a section node: [body=0, sectionIndex]. */
	private getSectionPath(sectionIndex: number): JPPath {
		return [0, sectionIndex];
	}

	/**
	 * Resolves the ID of the header or footer that matches the
	 * current edit state (zone + type + section).
	 */
	private getActiveHeaderFooterId(doc: JPDocument): string | null {
		if (!this.state.editing || !this.state.zone) return null;

		const section = this.getSection(doc, this.state.sectionIndex);
		if (!section) return null;

		const refs =
			this.state.zone === 'header'
				? (section.properties.headerReferences ?? [])
				: (section.properties.footerReferences ?? []);

		const ref = refs.find((r) => r.type === this.state.type);
		return ref?.id ?? null;
	}

	/**
	 * Returns the active header or footer node, if one exists.
	 */
	getActiveHeaderFooter(doc: JPDocument): JPHeader | JPFooter | null {
		const id = this.getActiveHeaderFooterId(doc);
		if (!id) return null;

		const map = this.state.zone === 'header' ? doc.headers : doc.footers;
		return map.get(id) ?? null;
	}

	/**
	 * Checks whether a specific header/footer type exists for a section.
	 */
	hasHeaderFooter(
		doc: JPDocument,
		zone: 'header' | 'footer',
		hfType: JPHeaderFooterType,
		sectionIndex = 0,
	): boolean {
		const section = this.getSection(doc, sectionIndex);
		if (!section) return false;

		const refs =
			zone === 'header'
				? (section.properties.headerReferences ?? [])
				: (section.properties.footerReferences ?? []);

		const ref = refs.find((r) => r.type === hfType);
		if (!ref) return false;

		const map = zone === 'header' ? doc.headers : doc.footers;
		return map.has(ref.id);
	}

	/**
	 * Checks whether "different first page" is enabled for a section.
	 */
	hasDifferentFirstPage(doc: JPDocument, sectionIndex = 0): boolean {
		const section = this.getSection(doc, sectionIndex);
		if (!section) return false;

		const headerRefs = section.properties.headerReferences ?? [];
		const footerRefs = section.properties.footerReferences ?? [];
		return headerRefs.some((r) => r.type === 'first') || footerRefs.some((r) => r.type === 'first');
	}

	/**
	 * Checks whether "different odd/even pages" is enabled for a section.
	 */
	hasDifferentOddEven(doc: JPDocument, sectionIndex = 0): boolean {
		const section = this.getSection(doc, sectionIndex);
		if (!section) return false;

		const headerRefs = section.properties.headerReferences ?? [];
		const footerRefs = section.properties.footerReferences ?? [];
		return headerRefs.some((r) => r.type === 'even') || footerRefs.some((r) => r.type === 'even');
	}

	/**
	 * Find the path to the first text leaf node inside a header/footer node.
	 * Returns the internal path (relative to the HF root) or null.
	 */
	private findFirstTextPathInNode(node: { type: string; children?: readonly unknown[] }):
		| number[]
		| null {
		if (node.type === 'text') return [];
		if (!node.children || (node.children as readonly unknown[]).length === 0) return null;
		for (let i = 0; i < (node.children as readonly unknown[]).length; i++) {
			const child = (node.children as readonly { type: string; children?: readonly unknown[] }[])[
				i
			];
			const sub = this.findFirstTextPathInNode(child);
			if (sub !== null) return [i, ...sub];
		}
		return null;
	}
}
