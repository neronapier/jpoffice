'use client';

import type { JPEditor } from '@jpoffice/engine';
import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useCommand } from '../hooks/useCommand';
import { useEditor } from '../hooks/useEditor';
import { useEditorState } from '../hooks/useEditorState';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const TOUCH_TARGET = 44; // Minimum touch target size per WCAG (px)

const toolbarContainerStyle: CSSProperties = {
	position: 'sticky',
	bottom: 0,
	left: 0,
	right: 0,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: 4,
	padding: '6px 8px',
	backgroundColor: '#f0f4f9',
	borderTop: '1px solid #dadce0',
	flexShrink: 0,
	zIndex: 100,
	overflowX: 'auto',
	WebkitOverflowScrolling: 'touch',
};

const moreMenuStyle: CSSProperties = {
	position: 'absolute',
	bottom: '100%',
	right: 4,
	marginBottom: 4,
	display: 'flex',
	flexWrap: 'wrap',
	gap: 4,
	padding: 8,
	backgroundColor: '#ffffff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	boxShadow: '0 -2px 12px rgba(0,0,0,0.12)',
	zIndex: 101,
	maxWidth: 280,
};

const btnStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	minWidth: TOUCH_TARGET,
	minHeight: TOUCH_TARGET,
	width: TOUCH_TARGET,
	height: TOUCH_TARGET,
	border: 'none',
	borderRadius: 6,
	backgroundColor: 'transparent',
	cursor: 'pointer',
	fontSize: 16,
	color: '#444746',
	padding: 0,
	flexShrink: 0,
	touchAction: 'manipulation',
};

const separatorStyle: CSSProperties = {
	width: 1,
	height: 28,
	backgroundColor: '#c7c7c7',
	margin: '0 2px',
	flexShrink: 0,
};

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const icon = (d: string, size = 20) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d={d} />
	</svg>
);

const icons = {
	undo: icon(
		'M12.5 8c-2.65 0-5.05 1.04-6.83 2.75L3 8v9h9l-2.67-2.67A6.98 6.98 0 0112.5 10c2.76 0 5.15 1.6 6.32 3.94l1.89-.95A8.98 8.98 0 0012.5 8z',
	),
	redo: icon(
		'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16A8.002 8.002 0 0111.5 10c2.14 0 4.08.87 5.48 2.27L14 15h8V7l-3.6 3.6z',
	),
	bold: icon(
		'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
	),
	italic: icon('M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z'),
	underline: icon(
		'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
	),
	strikethrough: icon('M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z'),
	alignLeft: icon('M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zM3 21h18v-2H3v2zM3 3v2h18V3H3z'),
	alignCenter: icon('M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z'),
	alignRight: icon('M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z'),
	bulletList: icon(
		'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
	),
	numberList: icon(
		'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
	),
	clearFormat: icon(
		'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
	),
	moreHoriz: icon(
		'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
	),
	heading: icon('M5 4v3h5.5v12h3V7H19V4H5z'),
	indentIncrease: icon(
		'M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
	),
	close: icon(
		'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
	),
};

/* ------------------------------------------------------------------ */
/*  Touch-friendly button                                              */
/* ------------------------------------------------------------------ */

function MBtn({
	title,
	children,
	onClick,
	disabled,
	active,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
}) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			aria-pressed={active}
			disabled={disabled}
			style={{
				...btnStyle,
				backgroundColor: active ? '#c8d7f5' : 'transparent',
				opacity: disabled ? 0.4 : 1,
			}}
			onPointerDown={(e) => {
				e.preventDefault();
				if (!disabled) onClick();
			}}
		>
			{children}
		</button>
	);
}

function Separator() {
	return <div style={separatorStyle} />;
}

/* ------------------------------------------------------------------ */
/*  MobileToolbar                                                      */
/* ------------------------------------------------------------------ */

export interface MobileToolbarProps {
	/** The JPEditor instance. If omitted, the hook will pull from EditorContext. */
	editor?: JPEditor;
}

/**
 * A simplified toolbar for mobile/touch viewports.
 *
 * Shows essential formatting buttons (Bold, Italic, Underline, Undo, Redo)
 * with a "More" button that expands to show extra options. All touch targets
 * are at least 44x44px per WCAG guidelines.
 *
 * Intended to be rendered at the bottom of the screen on mobile devices.
 */
export function MobileToolbar({ editor: editorProp }: MobileToolbarProps) {
	const editorFromContext = useEditor();
	const editor = editorProp ?? editorFromContext;
	useEditorState(); // subscribe to re-render on state changes

	const [moreOpen, setMoreOpen] = useState(false);

	// Current formatting at cursor
	const format = editor.getFormatAtCursor();
	const runFmt = format?.run ?? {};
	const paraFmt = format?.paragraph ?? {};

	// Commands
	const { execute: undo } = useCommand('history.undo');
	const { execute: redo } = useCommand('history.redo');
	const { execute: bold } = useCommand('format.bold');
	const { execute: italic } = useCommand('format.italic');
	const { execute: underline } = useCommand('format.underline');
	const { execute: strikethrough } = useCommand('format.strikethrough');
	const { execute: clearFormatting } = useCommand('format.clearFormatting');
	const { execute: toggleBullet } = useCommand('list.toggleBullet');
	const { execute: toggleNumbered } = useCommand('list.toggleNumbered');

	const alignLeft = useCallback(() => {
		try {
			editor.executeCommand('format.align', { alignment: 'left' });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const alignCenter = useCallback(() => {
		try {
			editor.executeCommand('format.align', { alignment: 'center' });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const alignRight = useCallback(() => {
		try {
			editor.executeCommand('format.align', { alignment: 'right' });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleIndentIncrease = useCallback(() => {
		try {
			if (editor.canExecuteCommand('list.indent')) {
				editor.executeCommand('list.indent');
			} else {
				editor.executeCommand('format.indent', { direction: 'increase' });
			}
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleHeading = useCallback(
		(level: number) => {
			try {
				if (level === 0) editor.executeCommand('heading.clear');
				else editor.executeCommand('heading.set', { level });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const toggleMore = useCallback(() => {
		setMoreOpen((prev) => !prev);
	}, []);

	const closeMore = useCallback(() => {
		setMoreOpen(false);
	}, []);

	return (
		<div style={{ position: 'relative', flexShrink: 0 }}>
			{/* Backdrop to close More menu */}
			{moreOpen && (
				<div
					style={{ position: 'fixed', inset: 0, zIndex: 99 }}
					onPointerDown={(e) => {
						e.preventDefault();
						closeMore();
					}}
				/>
			)}

			{/* More options panel */}
			{moreOpen && (
				<div style={moreMenuStyle}>
					{/* Row 1: Strikethrough, Heading levels, Clear format */}
					<MBtn title="Strikethrough" onClick={strikethrough} active={!!runFmt.strikethrough}>
						{icons.strikethrough}
					</MBtn>
					<MBtn
						title="Heading 1"
						onClick={() => handleHeading(1)}
						active={paraFmt.outlineLevel === 1}
					>
						{icons.heading}
					</MBtn>
					<MBtn title="Clear formatting" onClick={clearFormatting}>
						{icons.clearFormat}
					</MBtn>

					<Separator />

					{/* Row 2: Alignment */}
					<MBtn
						title="Align left"
						onClick={alignLeft}
						active={(paraFmt.alignment ?? 'left') === 'left'}
					>
						{icons.alignLeft}
					</MBtn>
					<MBtn title="Align center" onClick={alignCenter} active={paraFmt.alignment === 'center'}>
						{icons.alignCenter}
					</MBtn>
					<MBtn title="Align right" onClick={alignRight} active={paraFmt.alignment === 'right'}>
						{icons.alignRight}
					</MBtn>

					<Separator />

					{/* Row 3: Lists, indent */}
					<MBtn
						title="Bulleted list"
						onClick={toggleBullet}
						active={paraFmt.numbering?.numId === 1}
					>
						{icons.bulletList}
					</MBtn>
					<MBtn
						title="Numbered list"
						onClick={toggleNumbered}
						active={paraFmt.numbering?.numId === 2}
					>
						{icons.numberList}
					</MBtn>
					<MBtn title="Increase indent" onClick={handleIndentIncrease}>
						{icons.indentIncrease}
					</MBtn>
				</div>
			)}

			{/* Primary toolbar row */}
			<div style={toolbarContainerStyle}>
				<MBtn title="Undo" onClick={undo} disabled={!editor.canUndo()}>
					{icons.undo}
				</MBtn>
				<MBtn title="Redo" onClick={redo} disabled={!editor.canRedo()}>
					{icons.redo}
				</MBtn>

				<Separator />

				<MBtn title="Bold" onClick={bold} active={!!runFmt.bold}>
					{icons.bold}
				</MBtn>
				<MBtn title="Italic" onClick={italic} active={!!runFmt.italic}>
					{icons.italic}
				</MBtn>
				<MBtn
					title="Underline"
					onClick={underline}
					active={runFmt.underline != null && runFmt.underline !== 'none'}
				>
					{icons.underline}
				</MBtn>

				<Separator />

				<MBtn title={moreOpen ? 'Close' : 'More options'} onClick={toggleMore} active={moreOpen}>
					{moreOpen ? icons.close : icons.moreHoriz}
				</MBtn>
			</div>
		</div>
	);
}
