import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from '../src/components/Toolbar';
import { EditorContext } from '../src/context/editor-context';
import type { EditorContextValue } from '../src/context/editor-context';

/* ------------------------------------------------------------------ */
/*  Mock Editor                                                        */
/* ------------------------------------------------------------------ */

function makeMockEditor(overrides: Record<string, unknown> = {}) {
	const listeners = new Set<() => void>();

	// Stable snapshot object -- useSyncExternalStore compares by reference
	const stableState = {
		document: {
			id: 'doc1',
			type: 'document',
			body: { id: 'b1', type: 'body', children: [] },
		},
		selection: null,
		readOnly: false,
		history: { undoStack: [], redoStack: [] },
	};

	const mock = {
		getDocument: vi.fn(() => stableState.document),
		getSelection: vi.fn(() => null),
		subscribe: vi.fn((listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}),
		getFormatAtCursor: vi.fn(
			() =>
				({
					run: {},
					paragraph: {},
				}) as {
					run: Record<string, unknown>;
					paragraph: Record<string, unknown>;
				},
		),
		isReadOnly: vi.fn(() => false),
		executeCommand: vi.fn(),
		canExecuteCommand: vi.fn(() => true),
		getPlugin: vi.fn(() => undefined),
		getState: vi.fn(() => stableState),
		canUndo: vi.fn(() => false),
		canRedo: vi.fn(() => false),
		registerCommand: vi.fn(),
		...overrides,
	};
	return mock as unknown as import('@jpoffice/engine').JPEditor;
}

function renderToolbar(
	editorOverrides: Record<string, unknown> = {},
	props: Partial<import('../src/components/Toolbar').ToolbarProps> = {},
) {
	const editor = makeMockEditor(editorOverrides);
	const value: EditorContextValue = { editor };
	const result = render(
		<EditorContext.Provider value={value}>
			<Toolbar {...props} />
		</EditorContext.Provider>,
	);
	return { ...result, editor };
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Toolbar', () => {
	it('renders without crashing', () => {
		renderToolbar();
		expect(screen.getByRole('toolbar')).toBeDefined();
	});

	it('has the correct aria-label', () => {
		renderToolbar();
		const toolbar = screen.getByRole('toolbar');
		expect(toolbar.getAttribute('aria-label')).toBe('Formatting toolbar');
	});

	it('renders undo and redo buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Undo')).toBeDefined();
		expect(screen.getByLabelText('Redo')).toBeDefined();
	});

	it('disables undo button when canUndo returns false', () => {
		renderToolbar({ canUndo: vi.fn(() => false) });
		const undoBtn = screen.getByLabelText('Undo');
		expect((undoBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('disables redo button when canRedo returns false', () => {
		renderToolbar({ canRedo: vi.fn(() => false) });
		const redoBtn = screen.getByLabelText('Redo');
		expect((redoBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('enables undo button when canUndo returns true', () => {
		renderToolbar({ canUndo: vi.fn(() => true) });
		const undoBtn = screen.getByLabelText('Undo');
		expect((undoBtn as HTMLButtonElement).disabled).toBe(false);
	});

	it('renders formatting toggle buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Bold')).toBeDefined();
		expect(screen.getByLabelText('Italic')).toBeDefined();
		expect(screen.getByLabelText('Underline')).toBeDefined();
		expect(screen.getByLabelText('Strikethrough')).toBeDefined();
		expect(screen.getByLabelText('Superscript')).toBeDefined();
		expect(screen.getByLabelText('Subscript')).toBeDefined();
	});

	it('renders alignment buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Align left')).toBeDefined();
		expect(screen.getByLabelText('Align center')).toBeDefined();
		expect(screen.getByLabelText('Align right')).toBeDefined();
		expect(screen.getByLabelText('Justify')).toBeDefined();
	});

	it('renders list buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Bulleted list')).toBeDefined();
		expect(screen.getByLabelText('Numbered list')).toBeDefined();
	});

	it('renders indent buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Decrease indent')).toBeDefined();
		expect(screen.getByLabelText('Increase indent')).toBeDefined();
	});

	it('renders insert buttons', () => {
		renderToolbar();
		expect(screen.getByLabelText('Insert link')).toBeDefined();
		expect(screen.getByLabelText('Insert image')).toBeDefined();
		expect(screen.getByLabelText('Insert table')).toBeDefined();
	});

	it('renders font family select', () => {
		renderToolbar();
		const fontSelect = screen.getByLabelText('Font family');
		expect(fontSelect).toBeDefined();
		expect(fontSelect.tagName.toLowerCase()).toBe('select');
	});

	it('renders paragraph style select', () => {
		renderToolbar();
		const headingSelect = screen.getByLabelText('Paragraph style');
		expect(headingSelect).toBeDefined();
		expect(headingSelect.tagName.toLowerCase()).toBe('select');
	});

	it('renders zoom level select', () => {
		renderToolbar();
		const zoomSelect = screen.getByLabelText('Zoom level');
		expect(zoomSelect).toBeDefined();
	});

	it('calls onZoomChange when zoom select changes', () => {
		const onZoomChange = vi.fn();
		renderToolbar({}, { zoom: 100, onZoomChange });
		const zoomSelect = screen.getByLabelText('Zoom level');
		fireEvent.change(zoomSelect, { target: { value: '150' } });
		expect(onZoomChange).toHaveBeenCalledWith(150);
	});

	it('renders clear formatting button', () => {
		renderToolbar();
		expect(screen.getByLabelText('Clear formatting')).toBeDefined();
	});

	it('renders search and replace button', () => {
		renderToolbar();
		expect(screen.getByLabelText('Search and replace')).toBeDefined();
	});

	it('renders print button', () => {
		renderToolbar();
		expect(screen.getByLabelText('Print')).toBeDefined();
	});

	it('renders paint format button', () => {
		renderToolbar();
		expect(screen.getByLabelText('Paint format')).toBeDefined();
	});

	it('renders font size control group', () => {
		renderToolbar();
		// Both the group div and the input share aria-label "Font size"
		const elements = screen.getAllByLabelText('Font size');
		expect(elements.length).toBeGreaterThanOrEqual(2);
	});

	it('renders line & paragraph spacing button', () => {
		renderToolbar();
		expect(screen.getByTitle('Line & paragraph spacing')).toBeDefined();
	});

	it('reflects bold active state from format', () => {
		renderToolbar({
			getFormatAtCursor: vi.fn(() => ({
				run: { bold: true },
				paragraph: {},
			})),
		});
		const boldBtn = screen.getByLabelText('Bold');
		expect(boldBtn.getAttribute('aria-pressed')).toBe('true');
	});

	it('reflects italic active state from format', () => {
		renderToolbar({
			getFormatAtCursor: vi.fn(() => ({
				run: { italic: true },
				paragraph: {},
			})),
		});
		const italicBtn = screen.getByLabelText('Italic');
		expect(italicBtn.getAttribute('aria-pressed')).toBe('true');
	});

	it('shows default zoom value', () => {
		renderToolbar({}, { zoom: 125 });
		const zoomSelect = screen.getByLabelText('Zoom level') as HTMLSelectElement;
		expect(zoomSelect.value).toBe('125');
	});

	it('applies custom style prop', () => {
		renderToolbar({}, { style: { marginTop: 10 } });
		const toolbar = screen.getByRole('toolbar');
		expect(toolbar.style.marginTop).toBe('10px');
	});

	it('executes undo command via mouseDown', () => {
		const { editor } = renderToolbar({ canUndo: vi.fn(() => true) });
		const undoBtn = screen.getByLabelText('Undo');
		fireEvent.mouseDown(undoBtn);
		expect(editor.executeCommand as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
			'history.undo',
			undefined,
		);
	});

	it('executes redo command via mouseDown', () => {
		const { editor } = renderToolbar({ canRedo: vi.fn(() => true) });
		const redoBtn = screen.getByLabelText('Redo');
		fireEvent.mouseDown(redoBtn);
		expect(editor.executeCommand as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
			'history.redo',
			undefined,
		);
	});

	it('renders grouped sections with separators', () => {
		const { container } = renderToolbar();
		// Separators are div elements with aria-hidden="true"
		const separators = container.querySelectorAll('[aria-hidden="true"]');
		expect(separators.length).toBeGreaterThan(0);
	});

	it('renders role groups for button sections', () => {
		renderToolbar();
		const groups = screen.getAllByRole('group');
		expect(groups.length).toBeGreaterThan(0);

		const groupLabels = groups.map((g) => g.getAttribute('aria-label'));
		expect(groupLabels).toContain('History and tools');
		expect(groupLabels).toContain('Text formatting');
		expect(groupLabels).toContain('Alignment');
		expect(groupLabels).toContain('Lists');
		expect(groupLabels).toContain('Insert');
		expect(groupLabels).toContain('Extra formatting');
	});
});
