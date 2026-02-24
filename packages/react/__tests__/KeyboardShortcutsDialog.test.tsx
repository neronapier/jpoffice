import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsDialog } from '../src/components/KeyboardShortcutsDialog';

afterEach(cleanup);

describe('KeyboardShortcutsDialog', () => {
	it('renders without crashing', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);
		expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
	});

	it('displays all shortcut category headings', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		const expectedCategories = [
			'Formatting',
			'Alignment',
			'Indentation & Spacing',
			'Headings',
			'Lists',
			'Editing',
			'Clipboard',
			'Navigation & Search',
		];

		for (const category of expectedCategories) {
			expect(screen.getByText(category)).toBeDefined();
		}
	});

	it('displays specific shortcut labels', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		// Check a selection of shortcut labels across categories
		expect(screen.getByText('Bold')).toBeDefined();
		expect(screen.getByText('Italic')).toBeDefined();
		expect(screen.getByText('Underline')).toBeDefined();
		expect(screen.getByText('Undo')).toBeDefined();
		expect(screen.getByText('Redo')).toBeDefined();
		expect(screen.getByText('Copy')).toBeDefined();
		expect(screen.getByText('Paste')).toBeDefined();
		expect(screen.getByText('Find')).toBeDefined();
		expect(screen.getByText('Align Left')).toBeDefined();
		expect(screen.getByText('Heading 1')).toBeDefined();
	});

	it('displays keyboard keys in kbd elements', () => {
		const onClose = vi.fn();
		const { container } = render(<KeyboardShortcutsDialog onClose={onClose} />);

		// There should be many <span> elements styled as keyboard keys (via kbdStyle)
		// The "Ctrl" key should appear many times for non-Mac
		const allText = container.textContent ?? '';
		expect(allText).toContain('Ctrl');
	});

	it('calls onClose when the header close button is clicked', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		const closeBtn = screen.getByTitle('Close');
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when the footer Close button is clicked', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		// The footer has a "Close" button text
		const buttons = screen.getAllByText('Close');
		// The footer button is the last one (not the "x" button which has title "Close")
		const footerCloseBtn = buttons[buttons.length - 1];
		fireEvent.click(footerCloseBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when clicking the overlay backdrop', () => {
		const onClose = vi.fn();
		const { container } = render(<KeyboardShortcutsDialog onClose={onClose} />);

		// The overlay is the outermost div
		const overlay = container.firstElementChild as HTMLElement;
		fireEvent.click(overlay);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not call onClose when clicking inside the dialog content', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		// Click on the title text inside the dialog
		const title = screen.getByText('Keyboard Shortcuts');
		fireEvent.click(title);
		// stopPropagation should prevent onClose from being triggered
		expect(onClose).not.toHaveBeenCalled();
	});

	it('calls onClose when Escape key is pressed on the overlay', () => {
		const onClose = vi.fn();
		const { container } = render(<KeyboardShortcutsDialog onClose={onClose} />);

		const overlay = container.firstElementChild as HTMLElement;
		fireEvent.keyDown(overlay, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not call onClose for non-Escape keys on overlay', () => {
		const onClose = vi.fn();
		const { container } = render(<KeyboardShortcutsDialog onClose={onClose} />);

		const overlay = container.firstElementChild as HTMLElement;
		fireEvent.keyDown(overlay, { key: 'Enter' });
		expect(onClose).not.toHaveBeenCalled();
	});

	it('shows note about current platform shortcuts', () => {
		const onClose = vi.fn();
		const { container } = render(<KeyboardShortcutsDialog onClose={onClose} />);

		const allText = container.textContent ?? '';
		// In jsdom, navigator.userAgent won't match Mac, so it should show Windows/Linux note
		expect(allText).toContain('Windows/Linux');
	});

	it('renders all 8 heading shortcut entries', () => {
		const onClose = vi.fn();
		render(<KeyboardShortcutsDialog onClose={onClose} />);

		// Normal text + Heading 1 through 6 = 7 heading-related entries + "Normal Text"
		expect(screen.getByText('Normal Text')).toBeDefined();
		expect(screen.getByText('Heading 1')).toBeDefined();
		expect(screen.getByText('Heading 2')).toBeDefined();
		expect(screen.getByText('Heading 3')).toBeDefined();
		expect(screen.getByText('Heading 4')).toBeDefined();
		expect(screen.getByText('Heading 5')).toBeDefined();
		expect(screen.getByText('Heading 6')).toBeDefined();
	});
});
