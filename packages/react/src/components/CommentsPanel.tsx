'use client';

/**
 * CommentsPanel displays a sidebar with document comment threads.
 * Shows each comment with author, date, and text, along with
 * "Resolve" and "Delete" actions per comment and an "Add Comment" form.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { JPComment } from '@jpoffice/model';
import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { useComments } from '../hooks/useComments';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const panelStyle: CSSProperties = {
	position: 'absolute',
	right: 0,
	top: 0,
	bottom: 0,
	width: 300,
	background: '#fff',
	borderLeft: '1px solid #e0e0e0',
	display: 'flex',
	flexDirection: 'column',
	zIndex: 10,
};

const headerStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '12px 16px',
	borderBottom: '1px solid #e0e0e0',
	flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
	fontSize: 14,
	fontWeight: 600,
	color: '#202124',
	margin: 0,
};

const closeBtnStyle: CSSProperties = {
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 18,
	color: '#5f6368',
	padding: '2px 6px',
	borderRadius: 4,
	lineHeight: 1,
};

const bodyStyle: CSSProperties = {
	flex: 1,
	overflowY: 'auto',
	padding: '8px 0',
};

const commentCardStyle: CSSProperties = {
	padding: '10px 16px',
	borderBottom: '1px solid #f1f3f4',
};

const commentResolvedStyle: CSSProperties = {
	...commentCardStyle,
	opacity: 0.5,
};

const commentAuthorStyle: CSSProperties = {
	fontSize: 13,
	fontWeight: 600,
	color: '#202124',
	marginBottom: 2,
};

const commentDateStyle: CSSProperties = {
	fontSize: 11,
	color: '#80868b',
	marginBottom: 6,
};

const commentTextStyle: CSSProperties = {
	fontSize: 13,
	color: '#3c4043',
	lineHeight: 1.4,
	marginBottom: 8,
};

const commentActionsStyle: CSSProperties = {
	display: 'flex',
	gap: 6,
};

const actionBtnStyle: CSSProperties = {
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 11,
	color: '#5f6368',
	padding: '4px 10px',
	borderRadius: 4,
};

const resolvedBadgeStyle: CSSProperties = {
	fontSize: 11,
	color: '#34a853',
	fontWeight: 500,
};

const footerStyle: CSSProperties = {
	borderTop: '1px solid #e0e0e0',
	padding: '12px 16px',
	flexShrink: 0,
};

const inputStyle: CSSProperties = {
	width: '100%',
	border: '1px solid #dadce0',
	borderRadius: 4,
	padding: '8px 10px',
	fontSize: 13,
	outline: 'none',
	boxSizing: 'border-box',
	resize: 'vertical',
	minHeight: 60,
	fontFamily: 'inherit',
};

const addBtnStyle: CSSProperties = {
	marginTop: 8,
	width: '100%',
	border: 'none',
	background: '#1a73e8',
	color: '#fff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	padding: '8px 0',
	borderRadius: 4,
};

const addBtnDisabledStyle: CSSProperties = {
	...addBtnStyle,
	background: '#dadce0',
	color: '#80868b',
	cursor: 'default',
};

const emptyStyle: CSSProperties = {
	padding: '24px 16px',
	textAlign: 'center',
	color: '#80868b',
	fontSize: 13,
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CommentsPanelProps {
	editor: JPEditor;
	comments: readonly JPComment[];
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommentsPanel({ editor, onClose }: CommentsPanelProps) {
	const { comments, addComment, resolveComment, deleteComment } = useComments(editor);
	const [newText, setNewText] = useState('');
	const [author] = useState('User');

	const handleAdd = useCallback(() => {
		const trimmed = newText.trim();
		if (!trimmed) return;
		addComment(trimmed, author);
		setNewText('');
	}, [newText, author, addComment]);

	const topLevelComments = comments.filter((c) => !c.parentId);
	const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

	const formatDate = (iso: string) => {
		try {
			const d = new Date(iso);
			return d.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch {
			return iso;
		}
	};

	return (
		<div style={panelStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<h3 style={headerTitleStyle}>Comments</h3>
				<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
					&times;
				</button>
			</div>

			{/* Body */}
			<div style={bodyStyle}>
				{topLevelComments.length === 0 ? (
					<div style={emptyStyle}>No comments yet.</div>
				) : (
					topLevelComments.map((comment) => (
						<div key={comment.id}>
							<div style={comment.resolved ? commentResolvedStyle : commentCardStyle}>
								<div style={commentAuthorStyle}>{comment.author}</div>
								<div style={commentDateStyle}>{formatDate(comment.date)}</div>
								<div style={commentTextStyle}>{comment.text}</div>
								{comment.resolved ? (
									<span style={resolvedBadgeStyle}>Resolved</span>
								) : (
									<div style={commentActionsStyle}>
										<button
											type="button"
											style={actionBtnStyle}
											onClick={() => resolveComment(comment.id)}
										>
											Resolve
										</button>
										<button
											type="button"
											style={actionBtnStyle}
											onClick={() => deleteComment(comment.id)}
										>
											Delete
										</button>
									</div>
								)}
							</div>
							{/* Replies */}
							{replies(comment.id).map((reply) => (
								<div
									key={reply.id}
									style={{ ...commentCardStyle, paddingLeft: 32, background: '#f8f9fa' }}
								>
									<div style={commentAuthorStyle}>{reply.author}</div>
									<div style={commentDateStyle}>{formatDate(reply.date)}</div>
									<div style={commentTextStyle}>{reply.text}</div>
								</div>
							))}
						</div>
					))
				)}
			</div>

			{/* Footer: add comment form */}
			<div style={footerStyle}>
				<textarea
					style={inputStyle}
					placeholder="Add a comment..."
					value={newText}
					onChange={(e) => setNewText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
							handleAdd();
						}
					}}
				/>
				<button
					type="button"
					style={newText.trim() ? addBtnStyle : addBtnDisabledStyle}
					onClick={handleAdd}
					disabled={!newText.trim()}
				>
					Add Comment
				</button>
			</div>
		</div>
	);
}
