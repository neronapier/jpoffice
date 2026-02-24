import type { JPDocument, JPOperation, JPParagraph, JPPath } from '@jpoffice/model';
import { getPlainText, isElement, traverseByType } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { BrowserSpellCheckProvider } from './browser-spellcheck-provider';
import type { SpellCheckProvider, SpellCheckState, SpellError } from './spellcheck-types';

/**
 * SpellcheckPlugin provides spell checking for the document.
 *
 * It maintains a map of paragraph IDs to spell errors. After document
 * changes, only modified paragraphs are re-checked (incremental).
 * Checking is debounced (300ms after the last edit).
 */
export class SpellcheckPlugin implements JPPlugin {
	readonly id = 'jpoffice.spellcheck';
	readonly name = 'Spell Check';

	private provider: SpellCheckProvider = new BrowserSpellCheckProvider();
	private errors: Map<string, SpellError[]> = new Map();
	private enabled = true;
	private language = 'en';
	private checking = false;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private dirtyParagraphs: Set<string> = new Set();
	private userDictionary: Set<string> = new Set();

	private static readonly USER_DICTIONARY_KEY = 'jpoffice.userDictionary';

	/** Callback set by React layer to respond to error changes */
	onErrorsChange?: (state: SpellCheckState) => void;

	initialize(editor: JPEditor): void {
		// Load user dictionary from localStorage
		this.loadUserDictionary();

		editor.registerCommand({
			id: 'spellcheck.toggle',
			name: 'Toggle Spell Check',
			canExecute: () => true,
			execute: () => {
				this.enabled = !this.enabled;
				if (!this.enabled) {
					this.errors.clear();
				} else {
					this.checkAll(editor);
				}
				this.notifyChange();
			},
		});

		editor.registerCommand({
			id: 'spellcheck.checkAll',
			name: 'Check Entire Document',
			canExecute: () => this.enabled,
			execute: () => this.checkAll(editor),
		});

		editor.registerCommand<{ paragraphId: string }>({
			id: 'spellcheck.checkParagraph',
			name: 'Check Paragraph',
			canExecute: () => this.enabled,
			execute: (_ed, args) => {
				this.dirtyParagraphs.add(args.paragraphId);
				this.scheduleCheck(editor);
			},
		});

		editor.registerCommand<{ word: string }>({
			id: 'spellcheck.ignore',
			name: 'Add to Dictionary',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.provider.addToPersonalDictionary?.(args.word);
				// Re-check to clear the ignored word's errors
				this.checkAll(editor);
			},
		});

		editor.registerCommand<{ path: JPPath; offset: number; length: number; replacement: string }>({
			id: 'spellcheck.replaceWord',
			name: 'Replace Misspelled Word',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => {
				this.replaceWord(editor, args.path, args.offset, args.length, args.replacement);
			},
		});

		editor.registerCommand<{ language: string }>({
			id: 'spellcheck.setLanguage',
			name: 'Set Language',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.language = args.language;
				this.errors.clear();
				this.checkAll(editor);
			},
		});

		editor.registerCommand<{ provider: SpellCheckProvider }>({
			id: 'spellcheck.setProvider',
			name: 'Set Spell Check Provider',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.provider = args.provider;
				this.errors.clear();
				this.checkAll(editor);
			},
		});

		editor.registerCommand<{ word: string }>({
			id: 'spellcheck.addWord',
			name: 'Add to User Dictionary',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.addWord(args.word);
				this.checkAll(editor);
			},
		});

		editor.registerCommand<{ word: string }>({
			id: 'spellcheck.removeWord',
			name: 'Remove from User Dictionary',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.removeWord(args.word);
				this.checkAll(editor);
			},
		});

		// Initial check after a short delay
		setTimeout(() => {
			if (this.enabled) {
				this.checkAll(editor);
			}
		}, 500);
	}

	/**
	 * After operations are applied, mark affected paragraphs dirty
	 * and schedule a debounced re-check.
	 */
	onAfterApply(editor: JPEditor, ops: readonly JPOperation[]): void {
		if (!this.enabled) return;

		let hasMutations = false;
		for (const op of ops) {
			if (op.type === 'set_selection') continue;
			hasMutations = true;

			// Determine which paragraph was affected by this operation
			const paraId = this.findAffectedParagraphId(editor.getDocument(), op);
			if (paraId) {
				this.dirtyParagraphs.add(paraId);
			}
		}

		if (hasMutations && this.dirtyParagraphs.size > 0) {
			this.scheduleCheck(editor);
		}
	}

	reset(_editor: JPEditor): void {
		this.errors.clear();
		this.dirtyParagraphs.clear();
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.checking = false;
		this.notifyChange();
	}

	destroy(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	// ── Public API ─────────────────────────────────────────────

	/** Get all errors for the entire document. */
	getErrors(): ReadonlyMap<string, readonly SpellError[]> {
		return this.errors;
	}

	/** Get errors for a specific paragraph. */
	getErrorsForParagraph(paragraphId: string): readonly SpellError[] {
		return this.errors.get(paragraphId) ?? [];
	}

	/** Whether spell checking is currently enabled. */
	isEnabled(): boolean {
		return this.enabled;
	}

	/** Get the current spell check state. */
	getState(): SpellCheckState {
		return {
			enabled: this.enabled,
			errors: this.errors,
			language: this.language,
			checking: this.checking,
		};
	}

	/**
	 * Find the spell error at a given document position.
	 * Returns the error if the cursor/offset is within a misspelled word.
	 */
	getErrorAtPosition(path: JPPath, offset: number): SpellError | null {
		// Find the paragraph ID for this path
		for (const [paraId, paraErrors] of this.errors) {
			for (const err of paraErrors) {
				if (
					this.pathMatchesParagraph(err.path, path) &&
					offset >= err.offset &&
					offset <= err.offset + err.length
				) {
					return err;
				}
			}
			// Suppress unused variable lint -- we iterate all entries
			void paraId;
		}
		return null;
	}

	// ── User Dictionary ──────────────────────────────────────

	/** Add a word to the user dictionary and persist to localStorage. */
	addWord(word: string): void {
		const lower = word.toLowerCase();
		this.userDictionary.add(lower);
		this.persistUserDictionary();
	}

	/** Remove a word from the user dictionary and update localStorage. */
	removeWord(word: string): void {
		const lower = word.toLowerCase();
		this.userDictionary.delete(lower);
		this.persistUserDictionary();
	}

	/** Return current user dictionary words. */
	getUserDictionary(): string[] {
		return Array.from(this.userDictionary);
	}

	/** Check if a word is in the user dictionary. */
	isInUserDictionary(word: string): boolean {
		return this.userDictionary.has(word.toLowerCase());
	}

	private loadUserDictionary(): void {
		try {
			if (typeof localStorage !== 'undefined') {
				const stored = localStorage.getItem(SpellcheckPlugin.USER_DICTIONARY_KEY);
				if (stored) {
					const words: string[] = JSON.parse(stored);
					for (const w of words) {
						this.userDictionary.add(w.toLowerCase());
					}
				}
			}
		} catch {
			// localStorage may not be available (SSR, etc.)
		}
	}

	private persistUserDictionary(): void {
		try {
			if (typeof localStorage !== 'undefined') {
				const words = Array.from(this.userDictionary);
				localStorage.setItem(SpellcheckPlugin.USER_DICTIONARY_KEY, JSON.stringify(words));
			}
		} catch {
			// localStorage may not be available
		}
	}

	// ── Private Methods ────────────────────────────────────────

	private scheduleCheck(editor: JPEditor): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			this.checkDirtyParagraphs(editor);
		}, 300);
	}

	private async checkAll(editor: JPEditor): Promise<void> {
		if (!this.enabled) return;

		this.checking = true;
		this.notifyChange();

		const doc = editor.getDocument();
		const newErrors = new Map<string, SpellError[]>();

		for (const [para, paraPath] of traverseByType<JPParagraph>(doc, 'paragraph')) {
			const text = getPlainText(para);
			if (text.trim().length === 0) continue;

			const paraErrors = await this.checkParagraphText(para, paraPath, text);
			if (paraErrors.length > 0) {
				newErrors.set(para.id, paraErrors);
			}
		}

		this.errors = newErrors;
		this.checking = false;
		this.notifyChange();
	}

	private async checkDirtyParagraphs(editor: JPEditor): Promise<void> {
		if (!this.enabled || this.dirtyParagraphs.size === 0) return;

		this.checking = true;
		this.notifyChange();

		const doc = editor.getDocument();
		const dirtyIds = new Set(this.dirtyParagraphs);
		this.dirtyParagraphs.clear();

		for (const [para, paraPath] of traverseByType<JPParagraph>(doc, 'paragraph')) {
			if (!dirtyIds.has(para.id)) continue;

			const text = getPlainText(para);
			if (text.trim().length === 0) {
				this.errors.delete(para.id);
				continue;
			}

			const paraErrors = await this.checkParagraphText(para, paraPath, text);
			if (paraErrors.length > 0) {
				this.errors.set(para.id, paraErrors);
			} else {
				this.errors.delete(para.id);
			}
		}

		// Remove errors for paragraphs that no longer exist in the document
		const existingIds = new Set<string>();
		for (const [para] of traverseByType<JPParagraph>(doc, 'paragraph')) {
			existingIds.add(para.id);
		}
		for (const paraId of this.errors.keys()) {
			if (!existingIds.has(paraId)) {
				this.errors.delete(paraId);
			}
		}

		this.checking = false;
		this.notifyChange();
	}

	/**
	 * Check a single paragraph's text and return errors with correct paths.
	 *
	 * The provider returns errors with offsets relative to the concatenated text
	 * of the paragraph. We need to map those offsets back to the correct
	 * text node paths and offsets.
	 */
	private async checkParagraphText(
		para: JPParagraph,
		paraPath: JPPath,
		fullText: string,
	): Promise<SpellError[]> {
		const rawErrors = await this.provider.check(fullText, this.language);
		if (rawErrors.length === 0) return [];

		// Filter out words that are in the user dictionary
		const filteredErrors = rawErrors.filter(
			(err) => !this.userDictionary.has(err.word.toLowerCase()),
		);
		if (filteredErrors.length === 0) return [];

		// Build a map from concatenated-text offset to [textNodePath, localOffset]
		const textSegments = this.buildTextSegments(para, paraPath);
		const resolvedErrors: SpellError[] = [];

		for (const err of filteredErrors) {
			const resolved = this.resolveErrorPath(err, textSegments);
			if (resolved) {
				resolvedErrors.push(resolved);
			}
		}

		return resolvedErrors;
	}

	/**
	 * Build an array of text segments: each segment represents a contiguous
	 * text node with its path, start offset in the concatenated string, and length.
	 */
	private buildTextSegments(
		para: JPParagraph,
		paraPath: JPPath,
	): Array<{ path: JPPath; start: number; length: number }> {
		const segments: Array<{ path: JPPath; start: number; length: number }> = [];
		let offset = 0;

		for (let ri = 0; ri < para.children.length; ri++) {
			const child = para.children[ri];
			if (!isElement(child)) continue;

			// child is a run
			for (let ti = 0; ti < child.children.length; ti++) {
				const textNode = child.children[ti];
				if (textNode.type === 'text' && 'text' in textNode) {
					const text = (textNode as { text: string }).text;
					segments.push({
						path: [...paraPath, ri, ti],
						start: offset,
						length: text.length,
					});
					offset += text.length;
				}
			}
		}

		return segments;
	}

	/**
	 * Map a raw error (with offset relative to concatenated text) back to the
	 * correct text node path and local offset.
	 */
	private resolveErrorPath(
		err: SpellError,
		segments: Array<{ path: JPPath; start: number; length: number }>,
	): SpellError | null {
		for (const seg of segments) {
			const segEnd = seg.start + seg.length;
			if (err.offset >= seg.start && err.offset < segEnd) {
				return {
					...err,
					path: seg.path,
					offset: err.offset - seg.start,
				};
			}
		}
		return null;
	}

	/**
	 * Replace a misspelled word at the given path/offset with a replacement.
	 */
	private replaceWord(
		editor: JPEditor,
		path: JPPath,
		offset: number,
		length: number,
		replacement: string,
	): void {
		// First read the original text to build proper delete op
		let node: unknown = editor.getDocument();
		for (const idx of path) {
			node = (node as { children: unknown[] }).children[idx];
		}
		const originalText = (node as { text: string }).text.slice(offset, offset + length);

		editor.batch(() => {
			editor.apply({
				type: 'delete_text',
				path,
				offset,
				text: originalText,
			});
			if (replacement.length > 0) {
				editor.apply({
					type: 'insert_text',
					path,
					offset,
					text: replacement,
				});
			}
		});
	}

	/**
	 * Determine which paragraph was affected by an operation.
	 * Returns the paragraph's ID, or null if indeterminate.
	 */
	private findAffectedParagraphId(doc: JPDocument, op: JPOperation): string | null {
		if (op.type === 'set_selection') return null;

		// For operations with a path, walk up to find the containing paragraph
		let opPath: JPPath | null = null;
		if ('path' in op && Array.isArray(op.path)) {
			opPath = op.path as JPPath;
		}

		if (!opPath || opPath.length === 0) return null;

		// Walk the tree from root to find the paragraph ancestor
		let current: unknown = doc;
		for (let i = 0; i < opPath.length; i++) {
			if (
				current &&
				typeof current === 'object' &&
				'type' in (current as Record<string, unknown>)
			) {
				if ((current as { type: string }).type === 'paragraph') {
					return (current as { id: string }).id;
				}
			}
			if (
				current &&
				typeof current === 'object' &&
				'children' in (current as Record<string, unknown>)
			) {
				const children = (current as { children: unknown[] }).children;
				const idx = opPath[i];
				if (idx < children.length) {
					current = children[idx];
				} else {
					return null;
				}
			} else {
				return null;
			}
		}

		// The node at the path itself might be a paragraph
		if (current && typeof current === 'object' && 'type' in (current as Record<string, unknown>)) {
			if ((current as { type: string }).type === 'paragraph') {
				return (current as { id: string }).id;
			}
		}

		return null;
	}

	/**
	 * Check whether a spell error's path belongs to the same paragraph
	 * as the given path (for getErrorAtPosition).
	 */
	private pathMatchesParagraph(errorPath: JPPath, queryPath: JPPath): boolean {
		// Both paths should share the same paragraph-level prefix
		// Paragraph is at depth 3 (body > section > paragraph)
		// but could be deeper in tables
		// Compare up to the common prefix minus the run/text parts
		if (errorPath.length < 2 || queryPath.length < 2) return false;

		// Error path points to a text node: [...paraPath, runIdx, textIdx]
		// Query path also points to a text node: [...paraPath, runIdx, textIdx]
		// Strip the last 2 segments to get paragraph path
		const errParaPath = errorPath.slice(0, -2);
		const queryParaPath = queryPath.slice(0, -2);

		if (errParaPath.length !== queryParaPath.length) return false;
		return errParaPath.every((v, i) => v === queryParaPath[i]);
	}

	private notifyChange(): void {
		this.onErrorsChange?.({
			enabled: this.enabled,
			errors: this.errors,
			language: this.language,
			checking: this.checking,
		});
	}
}
