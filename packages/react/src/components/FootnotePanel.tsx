'use client';

/**
 * FootnotePanel displays a sidebar listing all footnotes and endnotes
 * in the document. Each entry shows its display number and preview text.
 * Includes buttons for adding and deleting footnotes/endnotes.
 */

import type { JPEditor } from '@jpoffice/engine';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFootnotes } from '../hooks/useFootnotes';

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

const tabRowStyle: CSSProperties = {
	display: 'flex',
	borderBottom: '1px solid #e0e0e0',
	flexShrink: 0,
};

const tabStyle: CSSProperties = {
	flex: 1,
	padding: '10px 16px',
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	color: '#5f6368',
	borderBottom: '2px solid transparent',
	transition: 'color 0.1s, border-color 0.1s',
};

const tabActiveStyle: CSSProperties = {
	...tabStyle,
	color: '#1a73e8',
	borderBottomColor: '#1a73e8',
};

const bodyStyle: CSSProperties = {
	flex: 1,
	overflowY: 'auto',
	padding: '4px 0',
};

const noteItemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'flex-start',
	padding: '10px 16px',
	borderBottom: '1px solid #f1f3f4',
	gap: 10,
};

const noteNumberStyle: CSSProperties = {
	fontSize: 12,
	fontWeight: 700,
	color: '#1a73e8',
	minWidth: 24,
	textAlign: 'right',
	paddingTop: 1,
	flexShrink: 0,
};

const noteContentStyle: CSSProperties = {
	flex: 1,
	minWidth: 0,
};

const notePreviewStyle: CSSProperties = {
	fontSize: 13,
	color: '#3c4043',
	lineHeight: 1.4,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	display: '-webkit-box',
	WebkitLineClamp: 2,
	WebkitBoxOrient: 'vertical',
};

const deleteBtnStyle: CSSProperties = {
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 14,
	color: '#80868b',
	padding: '2px 6px',
	borderRadius: 4,
	flexShrink: 0,
};

const footerStyle: CSSProperties = {
	display: 'flex',
	gap: 8,
	padding: '12px 16px',
	borderTop: '1px solid #e0e0e0',
	flexShrink: 0,
};

const addBtnStyle: CSSProperties = {
	flex: 1,
	border: 'none',
	background: '#1a73e8',
	color: '#fff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	padding: '8px 0',
	borderRadius: 4,
};

const emptyStyle: CSSProperties = {
	padding: '24px 16px',
	textAlign: 'center',
	color: '#80868b',
	fontSize: 13,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getFootnotePreview(content: ReadonlyArray<{ children?: ReadonlyArray<unknown> }>): string {
	// Extract plain text from the first paragraph of footnote content
	const parts: string[] = [];
	for (const para of content) {
		if (!para.children) continue;
		for (const child of para.children) {
			const c = child as { children?: ReadonlyArray<unknown>; text?: string };
			if (c.text !== undefined) {
				parts.push(c.text);
			} else if (c.children) {
				for (const leaf of c.children) {
					const l = leaf as { text?: string };
					if (l.text !== undefined) {
						parts.push(l.text);
					}
				}
			}
		}
	}
	return parts.join('') || '(empty)';
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface FootnotePanelProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FootnotePanel({ editor, onClose }: FootnotePanelProps) {
	const { footnotes, endnotes, addFootnote, addEndnote, removeFootnote } = useFootnotes(editor);
	const [activeTab, setActiveTab] = useState<'footnotes' | 'endnotes'>('footnotes');

	const currentList = activeTab === 'footnotes' ? footnotes : endnotes;

	return (
		<div style={panelStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<h3 style={headerTitleStyle}>Footnotes & Endnotes</h3>
				<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
					&times;
				</button>
			</div>

			{/* Tabs */}
			<div style={tabRowStyle}>
				<button
					type="button"
					style={activeTab === 'footnotes' ? tabActiveStyle : tabStyle}
					onClick={() => setActiveTab('footnotes')}
				>
					Footnotes ({footnotes.length})
				</button>
				<button
					type="button"
					style={activeTab === 'endnotes' ? tabActiveStyle : tabStyle}
					onClick={() => setActiveTab('endnotes')}
				>
					Endnotes ({endnotes.length})
				</button>
			</div>

			{/* Body */}
			<div style={bodyStyle}>
				{currentList.length === 0 ? (
					<div style={emptyStyle}>
						No {activeTab === 'footnotes' ? 'footnotes' : 'endnotes'} in this document.
					</div>
				) : (
					currentList.map((item) => (
						<div key={item.footnote.id} style={noteItemStyle}>
							<span style={noteNumberStyle}>{item.displayNumber}</span>
							<div style={noteContentStyle}>
								<div style={notePreviewStyle}>{getFootnotePreview(item.footnote.content)}</div>
							</div>
							<button
								type="button"
								style={deleteBtnStyle}
								onClick={() => removeFootnote(item.footnote.id)}
								title="Delete"
								onMouseEnter={(e) => {
									(e.currentTarget as HTMLButtonElement).style.color = '#c5221f';
								}}
								onMouseLeave={(e) => {
									(e.currentTarget as HTMLButtonElement).style.color = '#80868b';
								}}
							>
								&times;
							</button>
						</div>
					))
				)}
			</div>

			{/* Footer */}
			<div style={footerStyle}>
				<button
					type="button"
					style={addBtnStyle}
					onClick={() => {
						if (activeTab === 'footnotes') {
							addFootnote();
						} else {
							addEndnote();
						}
					}}
				>
					Add {activeTab === 'footnotes' ? 'Footnote' : 'Endnote'}
				</button>
			</div>
		</div>
	);
}
