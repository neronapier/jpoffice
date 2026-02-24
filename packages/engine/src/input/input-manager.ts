import type { JPEditor } from '../editor';
import { documentToHtml } from '../plugins/clipboard/document-to-html';
import type { KeyBinding } from './keybindings';
import { DEFAULT_KEYBINDINGS, eventToShortcut } from './keybindings';

/**
 * InputManager handles keyboard input via a hidden textarea.
 * It translates DOM events to editor commands.
 *
 * Client-side only - never instantiated during SSR.
 */
export class InputManager {
	private editor: JPEditor;
	private textarea: HTMLTextAreaElement | null = null;
	private keybindings: KeyBinding[];
	private composing = false;

	constructor(editor: JPEditor, keybindings?: readonly KeyBinding[]) {
		this.editor = editor;
		this.keybindings = [...(keybindings ?? DEFAULT_KEYBINDINGS)];
	}

	/**
	 * Attach to a hidden textarea element.
	 */
	attach(textarea: HTMLTextAreaElement): void {
		this.textarea = textarea;
		textarea.addEventListener('keydown', this.onKeyDown);
		textarea.addEventListener('input', this.onInput);
		textarea.addEventListener('compositionstart', this.onCompositionStart);
		textarea.addEventListener('compositionend', this.onCompositionEnd);
		textarea.addEventListener('paste', this.onPaste);
		textarea.addEventListener('copy', this.onCopy);
		textarea.addEventListener('cut', this.onCut);
	}

	/**
	 * Detach from the textarea.
	 */
	detach(): void {
		if (!this.textarea) return;
		this.textarea.removeEventListener('keydown', this.onKeyDown);
		this.textarea.removeEventListener('input', this.onInput);
		this.textarea.removeEventListener('compositionstart', this.onCompositionStart);
		this.textarea.removeEventListener('compositionend', this.onCompositionEnd);
		this.textarea.removeEventListener('paste', this.onPaste);
		this.textarea.removeEventListener('copy', this.onCopy);
		this.textarea.removeEventListener('cut', this.onCut);
		this.textarea = null;
	}

	/**
	 * Focus the hidden textarea to capture keyboard input.
	 */
	focus(): void {
		this.textarea?.focus();
	}

	/**
	 * Add a custom keybinding.
	 */
	addKeybinding(binding: KeyBinding): void {
		this.keybindings.push(binding);
	}

	private safeExecute(commandId: string, args?: unknown): void {
		try {
			this.editor.executeCommand(commandId, args);
		} catch (e) {
			console.warn(`[JPOffice] Command failed: ${commandId}`, e);
		}
	}

	private onKeyDown = (e: KeyboardEvent): void => {
		if (this.composing) return;
		if (this.editor.getState().readOnly) return;

		const shortcut = eventToShortcut(e);

		// Check keybindings
		for (const binding of this.keybindings) {
			if (binding.shortcut === shortcut) {
				e.preventDefault();
				this.safeExecute(binding.commandId, binding.args);
				return;
			}
		}

		// Handle special keys
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			this.safeExecute('text.insertParagraph');
		} else if (e.key === 'Enter' && e.shiftKey) {
			e.preventDefault();
			this.safeExecute('text.insertLineBreak');
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			this.safeExecute('text.deleteBackward');
		} else if (e.key === 'Delete') {
			e.preventDefault();
			this.safeExecute('text.deleteForward');
		} else if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault();
			this.safeExecute('text.shiftTab');
		} else if (e.key === 'Tab') {
			e.preventDefault();
			this.safeExecute('text.insertTab');
		}
		// Arrow keys, Home, End, etc. are handled by selection commands
		else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
			e.preventDefault();
			this.safeExecute('selection.move', {
				direction: e.key,
				extend: e.shiftKey,
				word: e.ctrlKey || e.metaKey,
			});
		}
		// Handle printable characters directly to avoid browser input event inconsistencies
		// (e.g., space with selection, or input events not firing reliably)
		else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			this.safeExecute('text.insert', { text: e.key });
			if (this.textarea) this.textarea.value = '';
		}
	};

	private onInput = (e: Event): void => {
		if (this.composing) return;
		if (this.editor.getState().readOnly) return;

		const input = e as InputEvent;
		if (input.inputType === 'insertText' && input.data) {
			this.safeExecute('text.insert', { text: input.data });
			// Clear textarea after processing
			if (this.textarea) this.textarea.value = '';
		}
	};

	private onCompositionStart = (): void => {
		this.composing = true;
	};

	private onCompositionEnd = (e: CompositionEvent): void => {
		this.composing = false;
		if (this.editor.getState().readOnly) return;

		if (e.data) {
			this.safeExecute('text.insert', { text: e.data });
		}
		if (this.textarea) this.textarea.value = '';
	};

	private onPaste = (e: ClipboardEvent): void => {
		e.preventDefault();
		if (this.editor.getState().readOnly) return;

		const html = e.clipboardData?.getData('text/html');
		const text = e.clipboardData?.getData('text/plain');

		// Check for pasted images
		const items = Array.from(e.clipboardData?.items ?? []);
		const imageItem = items.find((i) => i.type.startsWith('image/'));

		if (imageItem) {
			const file = imageItem.getAsFile();
			if (file) {
				const reader = new FileReader();
				reader.onload = () => {
					const dataUrl = reader.result as string;
					this.safeExecute('image.insert', {
						src: dataUrl,
						mimeType: file.type,
						width: 4800, // default ~200px in EMU
						height: 3600, // default ~150px in EMU
					});
				};
				reader.readAsDataURL(file);
				return;
			}
		}

		this.safeExecute('clipboard.paste', { html, text });
	};

	private onCopy = (e: ClipboardEvent): void => {
		e.preventDefault();
		const text = this.editor.getSelectedText();
		if (text) {
			e.clipboardData?.setData('text/plain', text);
		}

		// Write HTML for rich copy
		const sel = this.editor.getSelection();
		if (sel) {
			try {
				const html = documentToHtml(this.editor.getDocument(), sel);
				if (html) {
					e.clipboardData?.setData('text/html', html);
				}
			} catch {
				// Silently fall back to plain text only
			}
		}
	};

	private onCut = (e: ClipboardEvent): void => {
		e.preventDefault();
		if (this.editor.getState().readOnly) return;

		const sel = this.editor.getSelection();
		const text = this.editor.getSelectedText();
		if (text) {
			e.clipboardData?.setData('text/plain', text);
		}

		// Write HTML for rich cut
		if (sel) {
			try {
				const html = documentToHtml(this.editor.getDocument(), sel);
				if (html) {
					e.clipboardData?.setData('text/html', html);
				}
			} catch {
				// Silently fall back to plain text only
			}
		}

		if (text) {
			this.safeExecute('text.deleteSelection');
		}
	};
}
