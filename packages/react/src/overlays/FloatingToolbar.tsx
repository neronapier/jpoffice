'use client';

import type { JPEditor } from '@jpoffice/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FloatingToolbarProps {
	editor: JPEditor;
	/** Selection rectangle in canvas coordinates */
	selectionRect: { x: number; y: number; width: number; height: number } | null;
	/** Container element for positioning reference */
	containerRef: React.RefObject<HTMLElement | null>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Delay in ms before the toolbar appears after a selection change. */
const SHOW_DELAY_MS = 300;

/** Gap between selection and toolbar (px). */
const TOOLBAR_GAP = 8;

/** Toolbar height estimate for flip calculation (px). */
const TOOLBAR_HEIGHT_ESTIMATE = 40;

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const toolbarContainerStyle: CSSProperties = {
	position: 'absolute',
	zIndex: 1000,
	pointerEvents: 'auto',
	transition: 'opacity 150ms ease, transform 150ms ease',
};

const toolbarInnerStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 2,
	padding: '4px 6px',
	backgroundColor: 'rgba(255, 255, 255, 0.96)',
	border: '1px solid #dadce0',
	borderRadius: 8,
	boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
	whiteSpace: 'nowrap',
};

const btnBase: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 28,
	height: 28,
	border: 'none',
	borderRadius: 4,
	backgroundColor: 'transparent',
	cursor: 'pointer',
	fontSize: 13,
	color: '#444746',
	padding: 0,
	flexShrink: 0,
};

const btnHover = '#e8eaed';

const separatorStyle: CSSProperties = {
	width: 1,
	height: 18,
	backgroundColor: '#dadce0',
	margin: '0 2px',
	flexShrink: 0,
};

const selectStyle: CSSProperties = {
	height: 26,
	border: '1px solid transparent',
	borderRadius: 4,
	backgroundColor: 'transparent',
	fontSize: 12,
	color: '#444746',
	cursor: 'pointer',
	paddingLeft: 4,
	paddingRight: 2,
	outline: 'none',
};

const colorIndicator = (color: string): CSSProperties => ({
	width: 14,
	height: 3,
	backgroundColor: color,
	borderRadius: 1,
	marginTop: 1,
});

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const icon = (d: string, size = 16) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d={d} />
	</svg>
);

const icons = {
	bold: icon(
		'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
	),
	italic: icon('M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z'),
	underline: icon(
		'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
	),
	strikethrough: icon('M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z'),
	textColor: icon(
		'M11 2L5.5 16h2.25l1.12-3h6.25l1.12 3h2.25L13 2h-2zm-1.38 9L12 4.67 14.38 11H9.62z',
	),
	highlight: icon(
		'M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.23-1.23c-.78-.78-2.05-.78-2.83 0L7.17 7.79 4.41 5.04 3 6.45l2.76 2.76-5.38 5.38c-.59.59-.59 1.54 0 2.12l5.66 5.66c.59.59 1.54.59 2.12 0l5.38-5.38 2.76 2.76 1.41-1.41-2.76-2.76 2.62-2.62c.78-.78.78-2.05 0-2.83l-1.23-1.23 3.12-3.12c.39-.39.39-1.02 0-1.41z',
	),
	link: icon(
		'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
	),
	comment: icon(
		'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
	),
};

/* ------------------------------------------------------------------ */
/*  Button                                                             */
/* ------------------------------------------------------------------ */

function FTBtn({
	title,
	children,
	onClick,
	active,
	ariaLabel,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	active?: boolean;
	ariaLabel?: string;
}) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			title={title}
			aria-label={ariaLabel ?? title}
			aria-pressed={active != null ? !!active : undefined}
			tabIndex={-1}
			style={{
				...btnBase,
				backgroundColor: active ? '#c8d7f5' : hovered ? btnHover : 'transparent',
				borderRadius: 4,
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onMouseDown={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			}}
		>
			{children}
		</button>
	);
}

function FTSeparator() {
	return <div aria-hidden="true" style={separatorStyle} />;
}

/* ------------------------------------------------------------------ */
/*  Color Button (simplified: single-click applies last color)         */
/* ------------------------------------------------------------------ */

function FTColorBtn({
	title,
	iconNode,
	currentColor,
	onApply,
}: {
	title: string;
	iconNode: ReactNode;
	currentColor: string;
	onApply: () => void;
}) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			tabIndex={-1}
			style={{
				...btnBase,
				backgroundColor: hovered ? btnHover : 'transparent',
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onMouseDown={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onApply();
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				{iconNode}
				<div style={colorIndicator(currentColor)} />
			</div>
		</button>
	);
}

/* ------------------------------------------------------------------ */
/*  FloatingToolbar                                                    */
/* ------------------------------------------------------------------ */

export function FloatingToolbar({
	editor,
	selectionRect,
	containerRef,
}: FloatingToolbarProps): ReactElement | null {
	const [visible, setVisible] = useState(false);
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
	const [flipped, setFlipped] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const toolbarRef = useRef<HTMLDivElement>(null);

	// Track text/highlight colors (persist across renders)
	const textColorRef = useRef('#000000');
	const highlightColorRef = useRef('#ffff00');

	// Clear timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	// Show/hide logic based on selectionRect
	useEffect(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		// Hide conditions: no selection, read-only, or no rect
		if (!selectionRect || editor.isReadOnly()) {
			setVisible(false);
			setPosition(null);
			return;
		}

		// Debounce showing the toolbar
		timerRef.current = setTimeout(() => {
			const container = containerRef.current;
			if (!container || !selectionRect) return;

			const containerBounds = container.getBoundingClientRect();

			// Center horizontally over selection
			const selCenterX = selectionRect.x + selectionRect.width / 2;
			const toolbarWidth = toolbarRef.current?.offsetWidth ?? 300;
			let left = selCenterX - toolbarWidth / 2;

			// Clamp to container bounds
			const minLeft = 4;
			const maxLeft = containerBounds.width - toolbarWidth - 4;
			left = Math.max(minLeft, Math.min(left, maxLeft));

			// Position above the selection
			const spaceAbove = selectionRect.y - TOOLBAR_GAP - TOOLBAR_HEIGHT_ESTIMATE;
			const shouldFlip = spaceAbove < 0;

			let top: number;
			if (shouldFlip) {
				// Below the selection
				top = selectionRect.y + selectionRect.height + TOOLBAR_GAP;
			} else {
				// Above the selection
				top = selectionRect.y - TOOLBAR_GAP - TOOLBAR_HEIGHT_ESTIMATE;
			}

			setFlipped(shouldFlip);
			setPosition({ left, top });
			setVisible(true);
		}, SHOW_DELAY_MS);
	}, [selectionRect, editor, containerRef]);

	// Get current formatting
	const format = editor.getFormatAtCursor();
	const runFmt = format?.run ?? {};
	const paraFmt = format?.paragraph ?? {};

	// Command handlers
	const handleBold = useCallback(() => {
		try {
			editor.executeCommand('format.bold');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleItalic = useCallback(() => {
		try {
			editor.executeCommand('format.italic');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleUnderline = useCallback(() => {
		try {
			editor.executeCommand('format.underline');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleStrikethrough = useCallback(() => {
		try {
			editor.executeCommand('format.strikethrough');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleTextColor = useCallback(() => {
		try {
			editor.executeCommand('format.color', { color: textColorRef.current });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleHighlight = useCallback(() => {
		try {
			editor.executeCommand('format.highlight', { color: highlightColorRef.current });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleLink = useCallback(() => {
		try {
			editor.executeCommand('link.showDialog');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleHeading = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const val = e.target.value;
			try {
				if (val === '0') editor.executeCommand('heading.clear');
				else editor.executeCommand('heading.set', { level: Number.parseInt(val, 10) });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleComment = useCallback(() => {
		try {
			editor.executeCommand('comment.add');
		} catch {
			/* not registered */
		}
	}, [editor]);

	// Compute animation styles
	const animationStyle: CSSProperties = visible
		? {
				opacity: 1,
				transform: flipped ? 'translateY(0)' : 'translateY(0)',
			}
		: {
				opacity: 0,
				transform: flipped ? 'translateY(4px)' : 'translateY(-4px)',
				pointerEvents: 'none' as const,
			};

	// Don't render at all if no position computed yet
	if (!position && !visible) return null;

	return (
		<div
			ref={toolbarRef}
			role="toolbar"
			aria-label="Quick formatting"
			style={{
				...toolbarContainerStyle,
				left: position?.left ?? 0,
				top: position?.top ?? 0,
				...animationStyle,
			}}
			onMouseDown={(e) => {
				// Prevent toolbar clicks from stealing focus from the textarea
				e.preventDefault();
			}}
		>
			<div style={toolbarInnerStyle}>
				{/* Heading style dropdown */}
				<select
					aria-label="Paragraph style"
					style={{ ...selectStyle, width: 90 }}
					tabIndex={-1}
					value={String(paraFmt.outlineLevel ?? 0)}
					onChange={handleHeading}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<option value="0">Normal</option>
					<option value="1">Heading 1</option>
					<option value="2">Heading 2</option>
					<option value="3">Heading 3</option>
					<option value="4">Heading 4</option>
					<option value="5">Heading 5</option>
					<option value="6">Heading 6</option>
				</select>

				<FTSeparator />

				{/* Bold */}
				<FTBtn title="Bold" onClick={handleBold} active={!!runFmt.bold}>
					{icons.bold}
				</FTBtn>

				{/* Italic */}
				<FTBtn title="Italic" onClick={handleItalic} active={!!runFmt.italic}>
					{icons.italic}
				</FTBtn>

				{/* Underline */}
				<FTBtn
					title="Underline"
					onClick={handleUnderline}
					active={runFmt.underline != null && runFmt.underline !== 'none'}
				>
					{icons.underline}
				</FTBtn>

				{/* Strikethrough */}
				<FTBtn title="Strikethrough" onClick={handleStrikethrough} active={!!runFmt.strikethrough}>
					{icons.strikethrough}
				</FTBtn>

				<FTSeparator />

				{/* Text Color */}
				<FTColorBtn
					title="Text color"
					iconNode={icons.textColor}
					currentColor={textColorRef.current}
					onApply={handleTextColor}
				/>

				{/* Highlight */}
				<FTColorBtn
					title="Highlight color"
					iconNode={icons.highlight}
					currentColor={highlightColorRef.current}
					onApply={handleHighlight}
				/>

				<FTSeparator />

				{/* Link */}
				<FTBtn title="Insert link" onClick={handleLink}>
					{icons.link}
				</FTBtn>

				{/* Comment */}
				<FTBtn title="Comment" onClick={handleComment}>
					{icons.comment}
				</FTBtn>
			</div>
		</div>
	);
}
