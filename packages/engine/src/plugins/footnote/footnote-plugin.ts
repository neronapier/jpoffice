import {
	createEndnoteRef,
	createFootnote,
	createFootnoteRef,
	createParagraph,
	createRun,
	createText,
	generateId,
	traverseNodes,
} from '@jpoffice/model';
import type { JPDocument, JPFootnote, JPNode, JPParagraph, JPPath } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

// ── Command argument types ──────────────────────────────────────

export interface InsertFootnoteArgs {
	/** Initial text content for the footnote body. Defaults to empty. */
	content?: string;
}

export interface DeleteFootnoteArgs {
	footnoteId: string;
}

export interface EditFootnoteArgs {
	footnoteId: string;
	content: JPParagraph[];
}

export interface GetFootnoteNumberArgs {
	footnoteId: string;
}

// ── Footnote with display number ────────────────────────────────

export interface FootnoteWithNumber {
	readonly footnote: JPFootnote;
	readonly displayNumber: number;
}

// ── Plugin ──────────────────────────────────────────────────────

export class FootnotePlugin implements JPPlugin {
	readonly id = 'jpoffice.footnote';
	readonly name = 'Footnote';

	/** Optional callback invoked whenever footnotes or endnotes change. */
	onFootnotesChange?: (footnotes: readonly JPFootnote[], endnotes: readonly JPFootnote[]) => void;

	initialize(editor: JPEditor): void {
		// ── Footnote commands ──────────────────────────────────

		editor.registerCommand<InsertFootnoteArgs | undefined>({
			id: 'footnote.insert',
			name: 'Insert Footnote',
			canExecute: () => {
				const sel = editor.getSelection();
				return !editor.isReadOnly() && sel !== null;
			},
			execute: (_ed, args) => this.insertNote(editor, 'footnote', args),
		});

		editor.registerCommand<DeleteFootnoteArgs>({
			id: 'footnote.delete',
			name: 'Delete Footnote',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.deleteNote(editor, 'footnote', args.footnoteId),
		});

		editor.registerCommand<EditFootnoteArgs>({
			id: 'footnote.edit',
			name: 'Edit Footnote',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.editNote(editor, 'footnote', args.footnoteId, args.content),
		});

		editor.registerCommand<GetFootnoteNumberArgs>({
			id: 'footnote.getNumber',
			name: 'Get Footnote Number',
			canExecute: () => true,
			execute: (_ed, args) => {
				// Command execution is void, but the number can be obtained via getFootnoteNumber()
				return this.getFootnoteNumber(editor.getDocument(), args.footnoteId);
			},
		});

		// ── Endnote commands ──────────────────────────────────

		editor.registerCommand<InsertFootnoteArgs | undefined>({
			id: 'endnote.insert',
			name: 'Insert Endnote',
			canExecute: () => {
				const sel = editor.getSelection();
				return !editor.isReadOnly() && sel !== null;
			},
			execute: (_ed, args) => this.insertNote(editor, 'endnote', args),
		});

		editor.registerCommand<DeleteFootnoteArgs>({
			id: 'endnote.delete',
			name: 'Delete Endnote',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.deleteNote(editor, 'endnote', args.footnoteId),
		});
	}

	// ── Public API ────────────────────────────────────────────

	/**
	 * Get all footnotes with their display numbers (ordered by appearance of refs in document).
	 */
	getFootnotes(doc: JPDocument): readonly FootnoteWithNumber[] {
		return this.getNotesWithNumbers(doc, 'footnote');
	}

	/**
	 * Get all endnotes with their display numbers (ordered by appearance of refs in document).
	 */
	getEndnotes(doc: JPDocument): readonly FootnoteWithNumber[] {
		return this.getNotesWithNumbers(doc, 'endnote');
	}

	/**
	 * Get the display number for a specific footnote by its ID.
	 * Returns -1 if not found.
	 */
	getFootnoteNumber(doc: JPDocument, footnoteId: string): number {
		const refType = this.findNoteType(doc, footnoteId);
		if (!refType) return -1;

		const refIds = this.collectRefIdsInOrder(
			doc,
			refType === 'footnote' ? 'footnote-ref' : 'endnote-ref',
		);
		const idx = refIds.indexOf(footnoteId);
		return idx === -1 ? -1 : idx + 1;
	}

	// ── Private: Insert ───────────────────────────────────────

	private insertNote(
		editor: JPEditor,
		noteType: 'footnote' | 'endnote',
		args?: InsertFootnoteArgs,
	): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, sel.anchor);

		// Create the footnote body
		const initialText = args?.content ?? '';
		const notePara = createParagraph(generateId(), [
			createRun(generateId(), [createText(generateId(), initialText)]),
		]);
		const footnote = createFootnote(noteType, [notePara]);

		// Create the inline reference marker
		const ref =
			noteType === 'footnote' ? createFootnoteRef(footnote.id) : createEndnoteRef(footnote.id);

		// Insert the reference marker after the current run in the paragraph
		const runPath = ctx.textPath.slice(0, -1); // path to the run
		const runIdx = runPath[runPath.length - 1];
		const paraPath = runPath.slice(0, -1); // path to the paragraph
		const insertPath: JPPath = [...paraPath, runIdx + 1];

		editor.batch(() => {
			// Insert inline ref node
			editor.apply({
				type: 'insert_node',
				path: insertPath,
				node: ref as unknown as JPNode,
			});

			// Add footnote to the document's footnotes/endnotes array
			const currentDoc = editor.getDocument();
			if (noteType === 'footnote') {
				const currentFootnotes = currentDoc.footnotes ?? [];
				editor.apply({
					type: 'set_properties',
					path: [],
					properties: { footnotes: [...currentFootnotes, footnote] },
					oldProperties: { footnotes: currentFootnotes },
				});
			} else {
				const currentEndnotes = currentDoc.endnotes ?? [];
				editor.apply({
					type: 'set_properties',
					path: [],
					properties: { endnotes: [...currentEndnotes, footnote] },
					oldProperties: { endnotes: currentEndnotes },
				});
			}
		});

		this.notifyChange(editor);
	}

	// ── Private: Delete ───────────────────────────────────────

	private deleteNote(editor: JPEditor, noteType: 'footnote' | 'endnote', footnoteId: string): void {
		const doc = editor.getDocument();
		const refNodeType = noteType === 'footnote' ? 'footnote-ref' : 'endnote-ref';

		// Find the inline ref marker in the document tree
		const markers: { path: JPPath; node: JPNode }[] = [];
		for (const [node, path] of traverseNodes(doc)) {
			if (
				node.type === refNodeType &&
				'footnoteId' in node &&
				(node as { footnoteId: string }).footnoteId === footnoteId
			) {
				markers.push({ path: [...path], node });
			}
		}

		editor.batch(() => {
			// Remove inline markers in reverse path order to preserve paths
			markers.sort((a, b) => {
				for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
					if (a.path[i] !== b.path[i]) return b.path[i] - a.path[i];
				}
				return b.path.length - a.path.length;
			});

			for (const marker of markers) {
				editor.apply({
					type: 'remove_node',
					path: marker.path,
					node: marker.node,
				});
			}

			// Remove the footnote/endnote from the document array
			const currentDoc = editor.getDocument();
			if (noteType === 'footnote') {
				const currentFootnotes = currentDoc.footnotes ?? [];
				const filtered = currentFootnotes.filter((fn) => fn.id !== footnoteId);
				editor.apply({
					type: 'set_properties',
					path: [],
					properties: { footnotes: filtered },
					oldProperties: { footnotes: currentFootnotes },
				});
			} else {
				const currentEndnotes = currentDoc.endnotes ?? [];
				const filtered = currentEndnotes.filter((en) => en.id !== footnoteId);
				editor.apply({
					type: 'set_properties',
					path: [],
					properties: { endnotes: filtered },
					oldProperties: { endnotes: currentEndnotes },
				});
			}
		});

		this.notifyChange(editor);
	}

	// ── Private: Edit ─────────────────────────────────────────

	private editNote(
		editor: JPEditor,
		noteType: 'footnote' | 'endnote',
		footnoteId: string,
		content: JPParagraph[],
	): void {
		const doc = editor.getDocument();

		if (noteType === 'footnote') {
			const currentFootnotes = doc.footnotes ?? [];
			const updatedFootnotes = currentFootnotes.map((fn) =>
				fn.id === footnoteId ? { ...fn, content } : fn,
			);
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { footnotes: updatedFootnotes },
				oldProperties: { footnotes: currentFootnotes },
			});
		} else {
			const currentEndnotes = doc.endnotes ?? [];
			const updatedEndnotes = currentEndnotes.map((en) =>
				en.id === footnoteId ? { ...en, content } : en,
			);
			editor.apply({
				type: 'set_properties',
				path: [],
				properties: { endnotes: updatedEndnotes },
				oldProperties: { endnotes: currentEndnotes },
			});
		}

		this.notifyChange(editor);
	}

	// ── Private: Numbering helpers ────────────────────────────

	/**
	 * Collect all footnote/endnote ref IDs in document order.
	 */
	private collectRefIdsInOrder(doc: JPDocument, refType: 'footnote-ref' | 'endnote-ref'): string[] {
		const ids: string[] = [];
		for (const [node] of traverseNodes(doc)) {
			if (node.type === refType && 'footnoteId' in node) {
				ids.push((node as { footnoteId: string }).footnoteId);
			}
		}
		return ids;
	}

	/**
	 * Get notes with display numbers, ordered by reference appearance in document.
	 */
	private getNotesWithNumbers(
		doc: JPDocument,
		noteType: 'footnote' | 'endnote',
	): FootnoteWithNumber[] {
		const refType = noteType === 'footnote' ? 'footnote-ref' : 'endnote-ref';
		const refIds = this.collectRefIdsInOrder(doc, refType);
		const notes = noteType === 'footnote' ? (doc.footnotes ?? []) : (doc.endnotes ?? []);
		const noteMap = new Map<string, JPFootnote>();
		for (const note of notes) {
			noteMap.set(note.id, note);
		}

		const result: FootnoteWithNumber[] = [];
		let number = 1;
		for (const refId of refIds) {
			const note = noteMap.get(refId);
			if (note) {
				result.push({ footnote: note, displayNumber: number });
				number++;
			}
		}

		return result;
	}

	/**
	 * Find which type (footnote or endnote) a given note ID belongs to.
	 */
	private findNoteType(doc: JPDocument, footnoteId: string): 'footnote' | 'endnote' | null {
		const footnotes = doc.footnotes ?? [];
		if (footnotes.some((fn) => fn.id === footnoteId)) return 'footnote';
		const endnotes = doc.endnotes ?? [];
		if (endnotes.some((en) => en.id === footnoteId)) return 'endnote';
		return null;
	}

	// ── Private: Notify ───────────────────────────────────────

	private notifyChange(editor: JPEditor): void {
		if (this.onFootnotesChange) {
			const doc = editor.getDocument();
			this.onFootnotesChange(doc.footnotes ?? [], doc.endnotes ?? []);
		}
	}
}
