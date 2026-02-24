import type { JPOperation, JPText } from '@jpoffice/model';
import { getNodeAtPath, parentPath } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';
import type { AutoCorrectRule } from './autocorrect-rules';
import { DEFAULT_AUTOCORRECT_RULES } from './autocorrect-rules';

/**
 * Characters that trigger auto-correct rule matching.
 * When the user types one of these, we look back at the preceding text
 * to see if it matches any rule trigger.
 */
const TRIGGER_CHARS = new Set([' ', '.', ',', ';', ':', '!', '?', ')', ']', '}', '\n', '\t']);

/**
 * Characters that indicate the preceding quote should be an opening quote.
 * A quote is "opening" when preceded by one of these or when at the start of text.
 */
const OPEN_QUOTE_PRECEDING = new Set([' ', '\t', '\n', '(', '[', '{', '\u2014', '\u2013']);

/** Sentence-ending punctuation followed by a space triggers auto-capitalize. */
const SENTENCE_ENDINGS = new Set(['.', '!', '?']);

/**
 * AutoCorrectPlugin provides automatic text corrections as the user types:
 *
 * - **Symbol replacement**: (c) -> copyright, -- -> em dash, etc.
 * - **Smart quotes**: straight quotes -> curly quotes based on context
 * - **Auto-capitalization**: capitalize first letter after sentence-ending punctuation
 *
 * Each correction is applied as a batched operation so a single Ctrl+Z undoes it.
 */
export class AutoCorrectPlugin implements JPPlugin {
	readonly id = 'jpoffice.autocorrect';
	readonly name = 'AutoCorrect';

	private enabled = true;
	private smartQuotesEnabled = true;
	private autoCapitalizeEnabled = true;
	private rules: AutoCorrectRule[];

	/** Guard to prevent re-entrant corrections from our own apply() calls */
	private applying = false;

	/** Optional callback invoked whenever settings change */
	onSettingsChange?: () => void;

	constructor() {
		this.rules = [...DEFAULT_AUTOCORRECT_RULES];
	}

	// ── Public API ───────────────────────────────────────────

	isEnabled(): boolean {
		return this.enabled;
	}

	isSmartQuotesEnabled(): boolean {
		return this.smartQuotesEnabled;
	}

	isAutoCapitalizeEnabled(): boolean {
		return this.autoCapitalizeEnabled;
	}

	getRules(): readonly AutoCorrectRule[] {
		return this.rules;
	}

	// ── Plugin lifecycle ─────────────────────────────────────

	initialize(editor: JPEditor): void {
		editor.registerCommand({
			id: 'autocorrect.toggle',
			name: 'Toggle AutoCorrect',
			canExecute: () => true,
			execute: () => {
				this.enabled = !this.enabled;
				this.onSettingsChange?.();
			},
		});

		editor.registerCommand({
			id: 'autocorrect.toggleSmartQuotes',
			name: 'Toggle Smart Quotes',
			canExecute: () => true,
			execute: () => {
				this.smartQuotesEnabled = !this.smartQuotesEnabled;
				this.onSettingsChange?.();
			},
		});

		editor.registerCommand({
			id: 'autocorrect.toggleAutoCapitalize',
			name: 'Toggle Auto-Capitalization',
			canExecute: () => true,
			execute: () => {
				this.autoCapitalizeEnabled = !this.autoCapitalizeEnabled;
				this.onSettingsChange?.();
			},
		});

		editor.registerCommand<{ trigger: string; replacement: string }>({
			id: 'autocorrect.addRule',
			name: 'Add AutoCorrect Rule',
			canExecute: () => true,
			execute: (_ed, args) => {
				// Remove existing rule with same trigger if any
				this.rules = this.rules.filter((r) => r.trigger !== args.trigger);
				this.rules.push({
					trigger: args.trigger,
					replacement: args.replacement,
					category: 'custom',
					enabled: true,
				});
				this.onSettingsChange?.();
			},
		});

		editor.registerCommand<{ trigger: string }>({
			id: 'autocorrect.removeRule',
			name: 'Remove AutoCorrect Rule',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.rules = this.rules.filter((r) => r.trigger !== args.trigger);
				this.onSettingsChange?.();
			},
		});

		editor.registerCommand({
			id: 'autocorrect.getRules',
			name: 'Get AutoCorrect Rules',
			canExecute: () => true,
			execute: () => {
				// Rules can be retrieved via plugin instance directly
			},
		});
	}

	/**
	 * After each operation is applied, check whether auto-correction is needed.
	 * We only act on `insert_text` operations.
	 */
	onAfterApply(editor: JPEditor, ops: readonly JPOperation[]): void {
		if (!this.enabled || this.applying || editor.isReadOnly()) return;

		// Find the last insert_text op in the batch
		const insertOp = findLastInsertText(ops);
		if (!insertOp) return;

		const insertedText = insertOp.text;
		if (insertedText.length === 0) return;

		// The last character inserted is the potential trigger
		const lastChar = insertedText[insertedText.length - 1];

		// Try smart quotes first (they apply to the inserted char itself)
		if (this.smartQuotesEnabled && (lastChar === '"' || lastChar === "'")) {
			this.applySmartQuote(editor, insertOp, lastChar);
			return;
		}

		// Check for auto-correct rule triggers
		if (TRIGGER_CHARS.has(lastChar)) {
			this.applyRuleCorrection(editor, insertOp);
		}

		// Check for auto-capitalization
		if (this.autoCapitalizeEnabled) {
			this.applyAutoCapitalize(editor, insertOp);
		}
	}

	reset(): void {
		this.applying = false;
	}

	destroy(): void {
		this.onSettingsChange = undefined;
	}

	// ── Private: Smart Quotes ────────────────────────────────

	/**
	 * Replace a straight quote with the appropriate curly quote.
	 * A quote is "opening" if preceded by whitespace, punctuation, or start of text.
	 */
	private applySmartQuote(
		editor: JPEditor,
		insertOp: { path: readonly number[]; offset: number; text: string },
		quote: '"' | "'",
	): void {
		const doc = editor.getDocument();

		// Where the quote was inserted. After insert_text, the text at path
		// already contains the inserted character. The quote is at:
		//   insertOp.offset + insertOp.text.length - 1
		// But if more text was inserted we only care about the last char position.
		const quoteOffset = insertOp.offset + insertOp.text.length - 1;

		// Get the text node to inspect the character before the quote
		let textNode: JPText;
		try {
			textNode = getNodeAtPath(doc, insertOp.path) as JPText;
		} catch {
			return;
		}

		// Determine if this should be an opening or closing quote
		const isOpening = this.isOpeningQuotePosition(textNode, quoteOffset, editor);

		let replacement: string;
		if (quote === '"') {
			replacement = isOpening ? '\u201C' : '\u201D'; // left/right double
		} else {
			replacement = isOpening ? '\u2018' : '\u2019'; // left/right single
		}

		this.applying = true;
		try {
			editor.batch(() => {
				// Delete the straight quote
				editor.apply({
					type: 'delete_text',
					path: insertOp.path,
					offset: quoteOffset,
					text: quote,
				});
				// Insert the curly quote
				editor.apply({
					type: 'insert_text',
					path: insertOp.path,
					offset: quoteOffset,
					text: replacement,
				});
			});
		} finally {
			this.applying = false;
		}
	}

	/**
	 * Determine if a quote at the given offset should be an opening quote.
	 * Returns true if preceded by whitespace, certain punctuation, or at start of text.
	 */
	private isOpeningQuotePosition(textNode: JPText, quoteOffset: number, editor: JPEditor): boolean {
		// If at the start of the text node
		if (quoteOffset === 0) {
			// Check if this is the first text node in its paragraph or document
			// For simplicity, look at the previous text node to see if it ends
			// with a relevant character
			const doc = editor.getDocument();
			const sel = editor.getSelection();
			if (!sel) return true;

			try {
				const ctx = resolveSelectionContext(doc, sel.anchor);
				// If this is the first run's first text, it's opening
				if (ctx.runIndex === 0) return true;
			} catch {
				return true;
			}

			return true;
		}

		const charBefore = textNode.text[quoteOffset - 1];
		return OPEN_QUOTE_PRECEDING.has(charBefore);
	}

	// ── Private: Rule-based Corrections ──────────────────────

	/**
	 * After a trigger character is typed, look backwards in the text to see
	 * if the preceding text matches any auto-correct rule.
	 */
	private applyRuleCorrection(
		editor: JPEditor,
		insertOp: { path: readonly number[]; offset: number; text: string },
	): void {
		const doc = editor.getDocument();
		let textNode: JPText;
		try {
			textNode = getNodeAtPath(doc, insertOp.path) as JPText;
		} catch {
			return;
		}

		const currentText = textNode.text;
		// The trigger character is at the end of the inserted text.
		// Position in the node's text: insertOp.offset + insertOp.text.length - 1
		const triggerPos = insertOp.offset + insertOp.text.length - 1;

		// The text before the trigger character (excluding it)
		const textBeforeTrigger = currentText.slice(0, triggerPos);

		// Find a matching rule: check if textBeforeTrigger ends with the rule trigger
		const enabledRules = this.rules.filter((r) => r.enabled);

		for (const rule of enabledRules) {
			if (!textBeforeTrigger.endsWith(rule.trigger)) continue;

			// Make sure the trigger is at a word boundary:
			// The character before the trigger (if any) should be a space, start of text,
			// or punctuation — NOT a letter/digit that would make it part of a longer word.
			const triggerStart = triggerPos - rule.trigger.length;
			if (triggerStart > 0) {
				const charBeforeTrigger = currentText[triggerStart - 1];
				// For some triggers like (c), ->, etc., we don't need word boundary checks
				// because they contain non-alphanumeric chars. But for safety, we skip
				// triggers that are purely alphanumeric and not at a word boundary.
				if (isAlphanumericTrigger(rule.trigger) && isAlphanumeric(charBeforeTrigger)) {
					continue;
				}
			}

			// Apply the correction
			this.applying = true;
			try {
				editor.batch(() => {
					// Delete the trigger text
					editor.apply({
						type: 'delete_text',
						path: insertOp.path,
						offset: triggerStart,
						text: rule.trigger,
					});
					// Insert the replacement
					editor.apply({
						type: 'insert_text',
						path: insertOp.path,
						offset: triggerStart,
						text: rule.replacement,
					});

					// Update the selection to account for the length change
					const lengthDiff = rule.replacement.length - rule.trigger.length;
					const sel = editor.getSelection();
					if (sel) {
						const newOffset = sel.anchor.offset + lengthDiff;
						const newPoint = { path: sel.anchor.path, offset: newOffset };
						editor.setSelection({ anchor: newPoint, focus: newPoint });
					}
				});
			} finally {
				this.applying = false;
			}

			// Only apply the first matching rule
			return;
		}
	}

	// ── Private: Auto-Capitalization ─────────────────────────

	/**
	 * Capitalize the first letter typed after sentence-ending punctuation + space,
	 * or at the very start of a paragraph.
	 */
	private applyAutoCapitalize(
		editor: JPEditor,
		insertOp: { path: readonly number[]; offset: number; text: string },
	): void {
		const insertedText = insertOp.text;

		// We only auto-capitalize single character insertions that are lowercase letters
		if (insertedText.length !== 1) return;
		const ch = insertedText[0];
		if (ch < 'a' || ch > 'z') return;

		const doc = editor.getDocument();
		let textNode: JPText;
		try {
			textNode = getNodeAtPath(doc, insertOp.path) as JPText;
		} catch {
			return;
		}

		// Where the character was inserted (now present in the text node)
		const charPos = insertOp.offset;

		if (this.shouldCapitalize(textNode, charPos, insertOp.path, editor)) {
			const upper = ch.toUpperCase();
			this.applying = true;
			try {
				editor.batch(() => {
					editor.apply({
						type: 'delete_text',
						path: insertOp.path,
						offset: charPos,
						text: ch,
					});
					editor.apply({
						type: 'insert_text',
						path: insertOp.path,
						offset: charPos,
						text: upper,
					});
				});
			} finally {
				this.applying = false;
			}
		}
	}

	/**
	 * Determine if the character at `charPos` should be auto-capitalized.
	 *
	 * Returns true when:
	 * 1. It is the first character of the document
	 * 2. It is the first character of a paragraph (charPos === 0 and first run)
	 * 3. It follows ". " or "! " or "? " (sentence ending + space)
	 */
	private shouldCapitalize(
		textNode: JPText,
		charPos: number,
		textPath: readonly number[],
		editor: JPEditor,
	): boolean {
		const fullText = textNode.text;

		// Case: first character in the text node at position 0
		if (charPos === 0) {
			// Check if this is the first text node in a paragraph
			const doc = editor.getDocument();
			try {
				const runPath = parentPath(textPath);
				const paragraphPath = parentPath(runPath);
				// Validate the paragraph exists (throws if path is invalid)
				getNodeAtPath(doc, paragraphPath);

				// textPath = [..., runIdx, textIdx]. If runIdx === 0 and textIdx === 0,
				// this is the start of the paragraph.
				const runIdx = runPath[runPath.length - 1];
				const textIdx = textPath[textPath.length - 1];
				if (runIdx === 0 && textIdx === 0) {
					// First character of the paragraph — check if the paragraph is
					// the first one or if the text is truly empty (new paragraph).
					// If the paragraph text is empty before this insert, capitalize.
					if (fullText.length <= 1) {
						return true;
					}
				}

				// If not start of paragraph, check if the previous character in the
				// same paragraph context ends a sentence. But charPos === 0 in a non-first
				// run means we'd need to check the previous run's trailing text — for
				// simplicity, skip this edge case (the main path handles it via the
				// "two chars back" logic below).
			} catch {
				// Path resolution failed, don't capitalize
			}
			return false;
		}

		// Case: preceded by space, and two chars back is sentence-ending punctuation
		if (charPos >= 2) {
			const twoBack = fullText[charPos - 2];
			const oneBack = fullText[charPos - 1];
			if (SENTENCE_ENDINGS.has(twoBack) && oneBack === ' ') {
				return true;
			}
		}

		return false;
	}
}

// ── Utility functions ──────────────────────────────────────────

/**
 * Find the last `insert_text` operation in a list.
 */
function findLastInsertText(
	ops: readonly JPOperation[],
): { path: readonly number[]; offset: number; text: string } | null {
	for (let i = ops.length - 1; i >= 0; i--) {
		if (ops[i].type === 'insert_text') {
			const op = ops[i] as {
				type: 'insert_text';
				path: readonly number[];
				offset: number;
				text: string;
			};
			return { path: op.path, offset: op.offset, text: op.text };
		}
	}
	return null;
}

/**
 * Check if a character is alphanumeric (a-z, A-Z, 0-9).
 */
function isAlphanumeric(ch: string): boolean {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
}

/**
 * Check if a trigger string consists entirely of alphanumeric characters.
 */
function isAlphanumericTrigger(trigger: string): boolean {
	for (let i = 0; i < trigger.length; i++) {
		if (!isAlphanumeric(trigger[i])) return false;
	}
	return true;
}
