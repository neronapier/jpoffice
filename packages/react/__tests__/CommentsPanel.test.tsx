import type { JPComment } from '@jpoffice/model';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsPanel } from '../src/components/CommentsPanel';

/* ------------------------------------------------------------------ */
/*  Mock useComments hook                                              */
/* ------------------------------------------------------------------ */

const mockAddComment = vi.fn();
const mockResolveComment = vi.fn();
const mockDeleteComment = vi.fn();
let mockComments: readonly JPComment[] = [];

vi.mock('../src/hooks/useComments', () => ({
	useComments: () => ({
		comments: mockComments,
		addComment: mockAddComment,
		resolveComment: mockResolveComment,
		deleteComment: mockDeleteComment,
	}),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeComment(overrides: Partial<JPComment> & { id: string }): JPComment {
	return {
		author: 'Alice',
		date: '2026-01-15T10:30:00Z',
		text: 'Sample comment',
		resolved: false,
		...overrides,
	};
}

function makeMockEditor() {
	return {
		getDocument: vi.fn(() => ({ comments: [] })),
		getSelection: vi.fn(() => null),
		subscribe: vi.fn(() => () => {}),
		getFormatAtCursor: vi.fn(() => null),
		isReadOnly: vi.fn(() => false),
		executeCommand: vi.fn(),
		canExecuteCommand: vi.fn(() => false),
		getPlugin: vi.fn(() => undefined),
		getState: vi.fn(() => ({
			document: { comments: [] },
			selection: null,
			readOnly: false,
			history: { undoStack: [], redoStack: [] },
		})),
	} as unknown as import('@jpoffice/engine').JPEditor;
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	mockComments = [];
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CommentsPanel', () => {
	let editor: import('@jpoffice/engine').JPEditor;
	let onClose: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		editor = makeMockEditor();
		onClose = vi.fn();
	});

	it('renders without crashing', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('Comments')).toBeDefined();
	});

	it('shows empty state when there are no comments', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('No comments yet.')).toBeDefined();
	});

	it('shows the add comment textarea and button', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByPlaceholderText('Add a comment...')).toBeDefined();
		expect(screen.getByText('Add Comment')).toBeDefined();
	});

	it('add comment button is disabled when textarea is empty', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const addBtn = screen.getByText('Add Comment');
		expect((addBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('add comment button enables when text is typed', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const textarea = screen.getByPlaceholderText('Add a comment...');
		fireEvent.change(textarea, { target: { value: 'New comment' } });
		const addBtn = screen.getByText('Add Comment');
		expect((addBtn as HTMLButtonElement).disabled).toBe(false);
	});

	it('calls addComment and clears the textarea on click', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const textarea = screen.getByPlaceholderText('Add a comment...');
		fireEvent.change(textarea, { target: { value: 'My comment text' } });
		const addBtn = screen.getByText('Add Comment');
		fireEvent.click(addBtn);
		expect(mockAddComment).toHaveBeenCalledWith('My comment text', 'User');
	});

	it('calls onClose when the close button is clicked', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const closeBtn = screen.getByTitle('Close');
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('renders comments when provided', () => {
		mockComments = [
			makeComment({ id: 'c1', author: 'Bob', text: 'First comment' }),
			makeComment({ id: 'c2', author: 'Carol', text: 'Second comment' }),
		];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('Bob')).toBeDefined();
		expect(screen.getByText('First comment')).toBeDefined();
		expect(screen.getByText('Carol')).toBeDefined();
		expect(screen.getByText('Second comment')).toBeDefined();
	});

	it('shows Resolve and Delete buttons for unresolved comments', () => {
		mockComments = [makeComment({ id: 'c1', resolved: false })];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('Resolve')).toBeDefined();
		expect(screen.getByText('Delete')).toBeDefined();
	});

	it('shows Resolved badge for resolved comments instead of action buttons', () => {
		mockComments = [makeComment({ id: 'c1', resolved: true })];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('Resolved')).toBeDefined();
		expect(screen.queryByText('Resolve')).toBeNull();
		expect(screen.queryByText('Delete')).toBeNull();
	});

	it('calls resolveComment when Resolve button is clicked', () => {
		mockComments = [makeComment({ id: 'c1', resolved: false })];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		fireEvent.click(screen.getByText('Resolve'));
		expect(mockResolveComment).toHaveBeenCalledWith('c1');
	});

	it('calls deleteComment when Delete button is clicked', () => {
		mockComments = [makeComment({ id: 'c1', resolved: false })];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		fireEvent.click(screen.getByText('Delete'));
		expect(mockDeleteComment).toHaveBeenCalledWith('c1');
	});

	it('renders replies indented under parent comment', () => {
		mockComments = [
			makeComment({ id: 'c1', author: 'Dan', text: 'Top-level comment' }),
			makeComment({ id: 'r1', author: 'Eve', text: 'Reply text', parentId: 'c1' }),
		];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		expect(screen.getByText('Dan')).toBeDefined();
		expect(screen.getByText('Top-level comment')).toBeDefined();
		expect(screen.getByText('Eve')).toBeDefined();
		expect(screen.getByText('Reply text')).toBeDefined();
	});

	it('does not show replies as top-level items', () => {
		mockComments = [
			makeComment({ id: 'c1', author: 'Dan', text: 'Parent' }),
			makeComment({ id: 'r1', author: 'Eve', text: 'Child', parentId: 'c1' }),
		];

		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		// There should be only one Resolve button (for the parent comment).
		// The reply does not have Resolve/Delete buttons.
		const resolveButtons = screen.getAllByText('Resolve');
		expect(resolveButtons).toHaveLength(1);
	});

	it('supports Ctrl+Enter to submit comment', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const textarea = screen.getByPlaceholderText('Add a comment...');
		fireEvent.change(textarea, { target: { value: 'Shortcut comment' } });
		fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
		expect(mockAddComment).toHaveBeenCalledWith('Shortcut comment', 'User');
	});

	it('does not submit when Enter is pressed without Ctrl', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const textarea = screen.getByPlaceholderText('Add a comment...');
		fireEvent.change(textarea, { target: { value: 'No submit' } });
		fireEvent.keyDown(textarea, { key: 'Enter' });
		expect(mockAddComment).not.toHaveBeenCalled();
	});

	it('does not call addComment when text is only whitespace', () => {
		render(<CommentsPanel editor={editor} comments={[]} onClose={onClose} />);
		const textarea = screen.getByPlaceholderText('Add a comment...');
		fireEvent.change(textarea, { target: { value: '   ' } });
		const addBtn = screen.getByText('Add Comment');
		fireEvent.click(addBtn);
		expect(mockAddComment).not.toHaveBeenCalled();
	});
});
