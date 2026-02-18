import { describe, it, expect } from 'vitest';
import { eventToShortcut, DEFAULT_KEYBINDINGS } from '../src/input/keybindings';

describe('eventToShortcut', () => {
	it('converts basic key', () => {
		expect(
			eventToShortcut({
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				key: 'a',
			}),
		).toBe('A');
	});

	it('converts Ctrl+B', () => {
		expect(
			eventToShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				key: 'b',
			}),
		).toBe('Ctrl+B');
	});

	it('converts Meta+Shift+Z', () => {
		expect(
			eventToShortcut({
				ctrlKey: false,
				metaKey: true,
				shiftKey: true,
				altKey: false,
				key: 'z',
			}),
		).toBe('Meta+Shift+Z');
	});

	it('converts special keys without upcasing', () => {
		expect(
			eventToShortcut({
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				key: 'Enter',
			}),
		).toBe('Enter');
	});

	it('includes Alt modifier', () => {
		expect(
			eventToShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: true,
				key: 'f',
			}),
		).toBe('Ctrl+Alt+F');
	});
});

describe('DEFAULT_KEYBINDINGS', () => {
	it('contains formatting shortcuts', () => {
		const bold = DEFAULT_KEYBINDINGS.find((b) => b.commandId === 'format.bold');
		expect(bold).toBeDefined();
		expect(bold!.shortcut).toBe('Ctrl+B');
	});

	it('contains undo/redo shortcuts', () => {
		const undo = DEFAULT_KEYBINDINGS.find(
			(b) => b.commandId === 'history.undo' && b.shortcut === 'Ctrl+Z',
		);
		expect(undo).toBeDefined();

		const redo = DEFAULT_KEYBINDINGS.find(
			(b) => b.commandId === 'history.redo' && b.shortcut === 'Ctrl+Y',
		);
		expect(redo).toBeDefined();
	});

	it('contains select all', () => {
		const selectAll = DEFAULT_KEYBINDINGS.find(
			(b) => b.commandId === 'selection.selectAll',
		);
		expect(selectAll).toBeDefined();
	});
});
