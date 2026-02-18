import type { JPEditor } from '../editor';
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

	private onKeyDown = (e: KeyboardEvent): void => {
		if (this.composing) return;
		if (this.editor.getState().readOnly) return;

		const shortcut = eventToShortcut(e);

		// Check keybindings
		for (const binding of this.keybindings) {
			if (binding.shortcut === shortcut) {
				e.preventDefault();
				this.editor.executeCommand(binding.commandId, binding.args);
				return;
			}
		}

		// Handle special keys
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			this.editor.executeCommand('text.insertParagraph');
		} else if (e.key === 'Enter' && e.shiftKey) {
			e.preventDefault();
			this.editor.executeCommand('text.insertLineBreak');
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			this.editor.executeCommand('text.deleteBackward');
		} else if (e.key === 'Delete') {
			e.preventDefault();
			this.editor.executeCommand('text.deleteForward');
		} else if (e.key === 'Tab') {
			e.preventDefault();
			this.editor.executeCommand('text.insertTab');
		}
		// Arrow keys, Home, End, etc. are handled by selection commands
		else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
			e.preventDefault();
			this.editor.executeCommand('selection.move', {
				direction: e.key,
				extend: e.shiftKey,
				word: e.ctrlKey || e.metaKey,
			});
		}
	};

	private onInput = (e: Event): void => {
		if (this.composing) return;
		if (this.editor.getState().readOnly) return;

		const input = e as InputEvent;
		if (input.inputType === 'insertText' && input.data) {
			this.editor.executeCommand('text.insert', { text: input.data });
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
			this.editor.executeCommand('text.insert', { text: e.data });
		}
		if (this.textarea) this.textarea.value = '';
	};

	private onPaste = (e: ClipboardEvent): void => {
		e.preventDefault();
		if (this.editor.getState().readOnly) return;

		const text = e.clipboardData?.getData('text/plain');
		if (text) {
			this.editor.executeCommand('text.insert', { text });
		}
	};

	private onCopy = (e: ClipboardEvent): void => {
		e.preventDefault();
		const text = this.editor.getSelectedText();
		if (text) {
			e.clipboardData?.setData('text/plain', text);
		}
	};

	private onCut = (e: ClipboardEvent): void => {
		e.preventDefault();
		if (this.editor.getState().readOnly) return;

		const text = this.editor.getSelectedText();
		if (text) {
			e.clipboardData?.setData('text/plain', text);
			this.editor.executeCommand('text.deleteSelection');
		}
	};
}
