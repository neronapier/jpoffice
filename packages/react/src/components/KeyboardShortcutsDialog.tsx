'use client';

/**
 * KeyboardShortcutsDialog displays a reference modal showing all
 * available keyboard shortcuts organized by category (Navigation,
 * Editing, Formatting, etc.).
 */

import type { CSSProperties } from 'react';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const overlayStyle: CSSProperties = {
	position: 'fixed',
	inset: 0,
	background: 'rgba(0, 0, 0, 0.4)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 100,
};

const dialogStyle: CSSProperties = {
	width: 520,
	maxHeight: '80vh',
	background: '#fff',
	borderRadius: 8,
	boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
	display: 'flex',
	flexDirection: 'column',
	overflow: 'hidden',
};

const headerStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '16px 20px',
	borderBottom: '1px solid #e0e0e0',
	flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
	fontSize: 16,
	fontWeight: 600,
	color: '#202124',
	margin: 0,
};

const closeBtnStyle: CSSProperties = {
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 20,
	color: '#5f6368',
	padding: '2px 6px',
	borderRadius: 4,
	lineHeight: 1,
};

const bodyStyle: CSSProperties = {
	flex: 1,
	overflowY: 'auto',
	padding: '8px 20px 20px',
};

const categoryTitleStyle: CSSProperties = {
	fontSize: 13,
	fontWeight: 600,
	color: '#1a73e8',
	marginTop: 16,
	marginBottom: 8,
	paddingBottom: 4,
	borderBottom: '1px solid #e8f0fe',
};

const shortcutRowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '6px 0',
};

const shortcutLabelStyle: CSSProperties = {
	fontSize: 13,
	color: '#3c4043',
};

const shortcutKeysStyle: CSSProperties = {
	fontSize: 12,
	fontFamily: "'SF Mono', 'Consolas', 'Courier New', monospace",
	color: '#5f6368',
	display: 'flex',
	gap: 4,
};

const kbdStyle: CSSProperties = {
	display: 'inline-block',
	padding: '2px 8px',
	background: '#f1f3f4',
	border: '1px solid #dadce0',
	borderRadius: 4,
	fontSize: 11,
	fontFamily: "'SF Mono', 'Consolas', 'Courier New', monospace",
	color: '#3c4043',
	lineHeight: 1.4,
	boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
};

const footerStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'flex-end',
	padding: '12px 20px',
	borderTop: '1px solid #e0e0e0',
	flexShrink: 0,
};

const closeBtnFooterStyle: CSSProperties = {
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	color: '#3c4043',
	padding: '8px 24px',
	borderRadius: 4,
};

const noteStyle: CSSProperties = {
	fontSize: 11,
	color: '#80868b',
	marginTop: 16,
	padding: '8px 0',
	borderTop: '1px solid #f1f3f4',
};

/* ------------------------------------------------------------------ */
/*  Shortcut Data                                                      */
/* ------------------------------------------------------------------ */

interface ShortcutEntry {
	label: string;
	keys: string;
	macKeys?: string;
}

interface ShortcutCategory {
	title: string;
	shortcuts: ShortcutEntry[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
	{
		title: 'Formatting',
		shortcuts: [
			{ label: 'Bold', keys: 'Ctrl+B', macKeys: 'Cmd+B' },
			{ label: 'Italic', keys: 'Ctrl+I', macKeys: 'Cmd+I' },
			{ label: 'Underline', keys: 'Ctrl+U', macKeys: 'Cmd+U' },
			{ label: 'Strikethrough', keys: 'Ctrl+Shift+X', macKeys: 'Cmd+Shift+X' },
			{ label: 'Superscript', keys: 'Ctrl+.', macKeys: 'Cmd+.' },
			{ label: 'Subscript', keys: 'Ctrl+,', macKeys: 'Cmd+,' },
			{ label: 'Clear Formatting', keys: 'Ctrl+\\', macKeys: 'Cmd+\\' },
		],
	},
	{
		title: 'Alignment',
		shortcuts: [
			{ label: 'Align Left', keys: 'Ctrl+L', macKeys: 'Cmd+L' },
			{ label: 'Align Center', keys: 'Ctrl+E', macKeys: 'Cmd+E' },
			{ label: 'Align Right', keys: 'Ctrl+R', macKeys: 'Cmd+R' },
			{ label: 'Justify', keys: 'Ctrl+J', macKeys: 'Cmd+J' },
		],
	},
	{
		title: 'Indentation & Spacing',
		shortcuts: [
			{ label: 'Increase Indent', keys: 'Ctrl+]', macKeys: 'Cmd+]' },
			{ label: 'Decrease Indent', keys: 'Ctrl+[', macKeys: 'Cmd+[' },
			{ label: 'Single Spacing', keys: 'Ctrl+1', macKeys: 'Cmd+1' },
			{ label: 'Double Spacing', keys: 'Ctrl+2', macKeys: 'Cmd+2' },
			{ label: '1.5 Spacing', keys: 'Ctrl+5', macKeys: 'Cmd+5' },
		],
	},
	{
		title: 'Headings',
		shortcuts: [
			{ label: 'Normal Text', keys: 'Ctrl+Alt+0', macKeys: 'Cmd+Alt+0' },
			{ label: 'Heading 1', keys: 'Ctrl+Alt+1', macKeys: 'Cmd+Alt+1' },
			{ label: 'Heading 2', keys: 'Ctrl+Alt+2', macKeys: 'Cmd+Alt+2' },
			{ label: 'Heading 3', keys: 'Ctrl+Alt+3', macKeys: 'Cmd+Alt+3' },
			{ label: 'Heading 4', keys: 'Ctrl+Alt+4', macKeys: 'Cmd+Alt+4' },
			{ label: 'Heading 5', keys: 'Ctrl+Alt+5', macKeys: 'Cmd+Alt+5' },
			{ label: 'Heading 6', keys: 'Ctrl+Alt+6', macKeys: 'Cmd+Alt+6' },
		],
	},
	{
		title: 'Lists',
		shortcuts: [
			{ label: 'Numbered List', keys: 'Ctrl+Shift+7', macKeys: 'Cmd+Shift+7' },
			{ label: 'Bulleted List', keys: 'Ctrl+Shift+8', macKeys: 'Cmd+Shift+8' },
		],
	},
	{
		title: 'Editing',
		shortcuts: [
			{ label: 'Undo', keys: 'Ctrl+Z', macKeys: 'Cmd+Z' },
			{ label: 'Redo', keys: 'Ctrl+Y', macKeys: 'Cmd+Shift+Z' },
			{ label: 'Select All', keys: 'Ctrl+A', macKeys: 'Cmd+A' },
			{ label: 'Insert Page Break', keys: 'Ctrl+Enter', macKeys: 'Cmd+Enter' },
		],
	},
	{
		title: 'Clipboard',
		shortcuts: [
			{ label: 'Copy', keys: 'Ctrl+C', macKeys: 'Cmd+C' },
			{ label: 'Cut', keys: 'Ctrl+X', macKeys: 'Cmd+X' },
			{ label: 'Paste', keys: 'Ctrl+V', macKeys: 'Cmd+V' },
			{ label: 'Copy Formatting', keys: 'Ctrl+Shift+C', macKeys: 'Cmd+Shift+C' },
			{ label: 'Paste Formatting', keys: 'Ctrl+Shift+V', macKeys: 'Cmd+Shift+V' },
		],
	},
	{
		title: 'Navigation & Search',
		shortcuts: [
			{ label: 'Find', keys: 'Ctrl+F', macKeys: 'Cmd+F' },
			{ label: 'Find & Replace', keys: 'Ctrl+H', macKeys: 'Cmd+H' },
			{ label: 'Insert Link', keys: 'Ctrl+K', macKeys: 'Cmd+K' },
		],
	},
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderKeys(entry: ShortcutEntry): React.ReactNode {
	const keysStr = isMac && entry.macKeys ? entry.macKeys : entry.keys;
	const parts = keysStr.split('+');
	return (
		<span style={shortcutKeysStyle}>
			{parts.map((part, i) => (
				<span key={`${entry.label}-${part}-${i}`}>
					<span style={kbdStyle}>{part}</span>
					{i < parts.length - 1 && <span style={{ color: '#80868b', margin: '0 1px' }}>+</span>}
				</span>
			))}
		</span>
	);
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface KeyboardShortcutsDialogProps {
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsDialog({ onClose }: KeyboardShortcutsDialogProps) {
	return (
		<div
			style={overlayStyle}
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose();
			}}
		>
			<div
				style={dialogStyle}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div style={headerStyle}>
					<h3 style={headerTitleStyle}>Keyboard Shortcuts</h3>
					<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
						&times;
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{SHORTCUT_CATEGORIES.map((category) => (
						<div key={category.title}>
							<div style={categoryTitleStyle}>{category.title}</div>
							{category.shortcuts.map((entry) => (
								<div key={entry.label} style={shortcutRowStyle}>
									<span style={shortcutLabelStyle}>{entry.label}</span>
									{renderKeys(entry)}
								</div>
							))}
						</div>
					))}
					<div style={noteStyle}>
						{isMac
							? 'Showing macOS shortcuts. On Windows/Linux, Cmd is replaced with Ctrl.'
							: 'Showing Windows/Linux shortcuts. On macOS, Ctrl is replaced with Cmd.'}
					</div>
				</div>

				{/* Footer */}
				<div style={footerStyle}>
					<button type="button" style={closeBtnFooterStyle} onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
