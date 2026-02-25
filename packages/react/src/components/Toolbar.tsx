'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useCommand } from '../hooks/useCommand';
import { useEditor } from '../hooks/useEditor';
import { useEditorState } from '../hooks/useEditorState';
import { ShapePicker } from './ShapePicker';
import { TableSizePicker } from './TableSizePicker';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const toolbarStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 2,
	padding: '4px 8px',
	backgroundColor: '#edf2fa',
	borderBottom: 'none',
	borderRadius: '0 0 8px 8px',
	flexShrink: 0,
	flexWrap: 'wrap',
	minHeight: 40,
	margin: '0 4px',
};

const btnBase: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 30,
	height: 30,
	border: 'none',
	borderRadius: 4,
	backgroundColor: 'transparent',
	cursor: 'pointer',
	fontSize: 14,
	color: '#444746',
	padding: 0,
	flexShrink: 0,
};

const btnHover = '#dce3ed';

const separatorStyle: CSSProperties = {
	width: 1,
	height: 20,
	backgroundColor: '#c7c7c7',
	margin: '0 4px',
	flexShrink: 0,
};

const selectStyle: CSSProperties = {
	height: 28,
	border: '1px solid transparent',
	borderRadius: 4,
	backgroundColor: 'transparent',
	fontSize: 13,
	color: '#444746',
	cursor: 'pointer',
	paddingLeft: 6,
	paddingRight: 4,
	outline: 'none',
};

const fontSizeInputStyle: CSSProperties = {
	width: 36,
	height: 28,
	border: '1px solid #c7c7c7',
	borderRadius: 4,
	textAlign: 'center',
	fontSize: 13,
	color: '#444746',
	backgroundColor: '#fff',
	outline: 'none',
};

const colorIndicator = (color: string): CSSProperties => ({
	width: 16,
	height: 3,
	backgroundColor: color,
	borderRadius: 1,
	marginTop: 1,
});

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const icon = (d: string, size = 18) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		role="img"
		aria-hidden="true"
	>
		<path d={d} />
	</svg>
);

const icons = {
	search: icon(
		'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
	),
	undo: icon(
		'M12.5 8c-2.65 0-5.05 1.04-6.83 2.75L3 8v9h9l-2.67-2.67A6.98 6.98 0 0112.5 10c2.76 0 5.15 1.6 6.32 3.94l1.89-.95A8.98 8.98 0 0012.5 8z',
	),
	redo: icon(
		'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16A8.002 8.002 0 0111.5 10c2.14 0 4.08.87 5.48 2.27L14 15h8V7l-3.6 3.6z',
	),
	print: icon(
		'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 110-2 1 1 0 010 2zm-1-9H6v4h12V3z',
	),
	spellcheck: icon(
		'M12.45 16h2.09L9.43 3H7.57L2.46 16h2.09l1.12-3h5.64l1.14 3zm-6.02-5L8.5 5.48 10.57 11H6.43zm15.16.59l-8.09 8.09L9.83 16l-1.41 1.41 5.09 5.09L23 13l-1.41-1.41z',
	),
	paintFormat: icon(
		'M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z',
	),
	bold: icon(
		'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
	),
	italic: icon('M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z'),
	underline: icon(
		'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
	),
	strikethrough: icon('M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z'),
	superscript: icon('M5 7v3h3v11h4V10h3V7H5zm17-3h-5v2h2.5L14 11v2h7V7z'),
	subscript: icon('M5 7v3h3v11h4V10h3V7H5zm14 10h-5v2h2.5L14 24v2h7v-2h-2.5L21 17z'),
	textColor: icon(
		'M11 2L5.5 16h2.25l1.12-3h6.25l1.12 3h2.25L13 2h-2zm-1.38 9L12 4.67 14.38 11H9.62z',
	),
	highlight: icon(
		'M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.23-1.23c-.78-.78-2.05-.78-2.83 0L7.17 7.79 4.41 5.04 3 6.45l2.76 2.76-5.38 5.38c-.59.59-.59 1.54 0 2.12l5.66 5.66c.59.59 1.54.59 2.12 0l5.38-5.38 2.76 2.76 1.41-1.41-2.76-2.76 2.62-2.62c.78-.78.78-2.05 0-2.83l-1.23-1.23 3.12-3.12c.39-.39.39-1.02 0-1.41z',
	),
	alignLeft: icon('M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zM3 21h18v-2H3v2zM3 3v2h18V3H3z'),
	alignCenter: icon('M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z'),
	alignRight: icon('M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z'),
	alignJustify: icon('M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zM3 3v2h18V3H3z'),
	bulletList: icon(
		'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
	),
	numberList: icon(
		'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
	),
	indentIncrease: icon(
		'M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
	),
	indentDecrease: icon(
		'M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
	),
	clearFormat: icon(
		'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
	),
	link: icon(
		'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
	),
	image: icon(
		'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
	),
	table: icon(
		'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 18H4v-6h8v6zm0-8H4V6h8v6zm10 8h-8v-6h8v6zm0-8h-8V6h8v6z',
	),
	lineSpacing: icon(
		'M6 7h2.5L5 3.5 1.5 7H4v10H1.5L5 20.5 8.5 17H6V7zm4-2v2h12V5H10zm0 14h12v-2H10v2zm0-6h12v-2H10v2z',
	),
	moreVert: icon(
		'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
	),
	shape: icon(
		'M11.15 3.4L7.43 9.48c-.41.66.07 1.52.85 1.52h7.43c.78 0 1.26-.86.85-1.52L12.85 3.4a.993.993 0 00-1.7 0zM17 14h-4v4h4v-4zM8.5 21a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
	),
};

/* ------------------------------------------------------------------ */
/*  Toolbar Button                                                     */
/* ------------------------------------------------------------------ */

function TBtn({
	title,
	children,
	onClick,
	disabled,
	active,
	ariaLabel,
	isToggle,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
	/** Explicit aria-label; defaults to title if not provided */
	ariaLabel?: string;
	/** If true, renders aria-pressed based on active state */
	isToggle?: boolean;
}) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			title={title}
			aria-label={ariaLabel ?? title}
			aria-pressed={isToggle ? !!active : undefined}
			disabled={disabled}
			tabIndex={-1}
			style={{
				...btnBase,
				backgroundColor: active ? '#c8d7f5' : hovered && !disabled ? btnHover : 'transparent',
				opacity: disabled ? 0.4 : 1,
				borderRadius: 4,
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onMouseDown={(e) => {
				e.preventDefault();
				if (!disabled) onClick();
			}}
		>
			{children}
		</button>
	);
}

function Separator() {
	return <div aria-hidden="true" style={separatorStyle} />;
}

/* ------------------------------------------------------------------ */
/*  Color Picker Dropdown                                              */
/* ------------------------------------------------------------------ */

const COLORS = [
	'#000000',
	'#434343',
	'#666666',
	'#999999',
	'#b7b7b7',
	'#cccccc',
	'#d9d9d9',
	'#efefef',
	'#f3f3f3',
	'#ffffff',
	'#980000',
	'#ff0000',
	'#ff9900',
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#4a86e8',
	'#0000ff',
	'#9900ff',
	'#ff00ff',
	'#e6b8af',
	'#f4cccc',
	'#fce5cd',
	'#fff2cc',
	'#d9ead3',
	'#d0e0e3',
	'#c9daf8',
	'#cfe2f3',
	'#d9d2e9',
	'#ead1dc',
	'#dd7e6b',
	'#ea9999',
	'#f9cb9c',
	'#ffe599',
	'#b6d7a8',
	'#a2c4c9',
	'#a4c2f4',
	'#9fc5e8',
	'#b4a7d6',
	'#d5a6bd',
	'#cc4125',
	'#e06666',
	'#f6b26b',
	'#ffd966',
	'#93c47d',
	'#76a5af',
	'#6d9eeb',
	'#6fa8dc',
	'#8e7cc3',
	'#c27ba0',
	'#a61c00',
	'#cc0000',
	'#e69138',
	'#f1c232',
	'#6aa84f',
	'#45818e',
	'#3c78d8',
	'#3d85c6',
	'#674ea7',
	'#a64d79',
	'#85200c',
	'#990000',
	'#b45f06',
	'#bf9000',
	'#38761d',
	'#134f5c',
	'#1155cc',
	'#0b5394',
	'#351c75',
	'#741b47',
	'#5b0f00',
	'#660000',
	'#783f04',
	'#7f6000',
	'#274e13',
	'#0c343d',
	'#1c4587',
	'#073763',
	'#20124d',
	'#4c1130',
];

function ColorPicker({
	title,
	iconNode,
	currentColor,
	onSelect,
}: {
	title: string;
	iconNode: ReactNode;
	currentColor: string;
	onSelect: (color: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const close = useCallback(() => setOpen(false), []);

	return (
		<div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
			<TBtn
				title={title}
				ariaLabel={`${title} (current: ${currentColor})`}
				onClick={() => setOpen(!open)}
			>
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					{iconNode}
					<div style={colorIndicator(currentColor)} />
				</div>
			</TBtn>
			{open && (
				<>
					<div
						style={{ position: 'fixed', inset: 0, zIndex: 999 }}
						onMouseDown={(e) => {
							e.preventDefault();
							close();
						}}
					/>
					<div
						aria-label={`${title} picker`}
						style={{
							position: 'absolute',
							top: '100%',
							left: 0,
							zIndex: 1000,
							background: '#fff',
							border: '1px solid #dadce0',
							borderRadius: 8,
							padding: 8,
							boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
							display: 'grid',
							gridTemplateColumns: 'repeat(10, 20px)',
							gap: 2,
						}}
					>
						{COLORS.map((c) => (
							<button
								key={c}
								type="button"
								aria-label={`Color ${c}`}
								aria-current={c === currentColor ? 'true' : undefined}
								style={{
									width: 20,
									height: 20,
									backgroundColor: c,
									border:
										c === currentColor
											? '2px solid #1a73e8'
											: c === '#ffffff'
												? '1px solid #ddd'
												: '1px solid transparent',
									borderRadius: 2,
									cursor: 'pointer',
									padding: 0,
								}}
								title={c}
								onMouseDown={(e) => {
									e.preventDefault();
									onSelect(c);
									close();
								}}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Font Size Input                                                    */
/* ------------------------------------------------------------------ */

function FontSizeControl({
	onChangeSize,
	currentSize,
}: { onChangeSize: (size: number) => void; currentSize?: number }) {
	const [value, setValue] = useState(String(currentSize ?? 11));

	useEffect(() => {
		if (currentSize != null) setValue(String(currentSize));
	}, [currentSize]);

	const apply = useCallback(() => {
		const n = Number.parseInt(value, 10);
		if (n > 0 && n <= 400) onChangeSize(n);
	}, [value, onChangeSize]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout
		<div
			role="group"
			aria-label="Font size"
			style={{ display: 'flex', alignItems: 'center', gap: 0 }}
		>
			<TBtn
				title="Decrease font size"
				ariaLabel="Decrease font size"
				onClick={() => {
					const n = Math.max(1, Number.parseInt(value, 10) - 1);
					setValue(String(n));
					onChangeSize(n);
				}}
			>
				<span style={{ fontSize: 16, fontWeight: 'bold' }}>−</span>
			</TBtn>
			<input
				type="text"
				value={value}
				aria-label="Font size"
				style={fontSizeInputStyle}
				tabIndex={-1}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						apply();
					}
				}}
				onBlur={apply}
			/>
			<TBtn
				title="Increase font size"
				ariaLabel="Increase font size"
				onClick={() => {
					const n = Math.min(400, Number.parseInt(value, 10) + 1);
					setValue(String(n));
					onChangeSize(n);
				}}
			>
				<span style={{ fontSize: 16, fontWeight: 'bold' }}>+</span>
			</TBtn>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Line Spacing Dropdown                                              */
/* ------------------------------------------------------------------ */

const LINE_SPACING_OPTIONS = [
	{ label: 'Single', value: 240 },
	{ label: '1.15', value: 276 },
	{ label: '1.5', value: 360 },
	{ label: 'Double', value: 480 },
	{ label: '2.5', value: 600 },
	{ label: '3.0', value: 720 },
] as const;

const PARAGRAPH_SPACING_OPTIONS = [
	{ label: '0 pt', value: 0 },
	{ label: '6 pt', value: 120 },
	{ label: '8 pt', value: 160 },
	{ label: '10 pt', value: 200 },
	{ label: '12 pt', value: 240 },
	{ label: '24 pt', value: 480 },
	{ label: '48 pt', value: 960 },
] as const;

const dropdownMenuStyle: CSSProperties = {
	position: 'absolute',
	top: '100%',
	left: 0,
	zIndex: 1000,
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	padding: '8px 0',
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
	minWidth: 220,
};

const dropdownItemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	width: '100%',
	padding: '6px 16px',
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 13,
	color: '#202124',
	textAlign: 'left',
};

const dropdownSectionLabel: CSSProperties = {
	padding: '6px 16px 2px',
	fontSize: 11,
	color: '#70757a',
	fontWeight: 500,
	textTransform: 'uppercase' as const,
	letterSpacing: '0.5px',
};

const dropdownSeparator: CSSProperties = {
	height: 1,
	backgroundColor: '#e0e0e0',
	margin: '4px 0',
};

function LineSpacingDropdown({
	onLineSpacing,
	onSpaceBefore,
	onSpaceAfter,
}: {
	onLineSpacing: (value: number) => void;
	onSpaceBefore: (value: number) => void;
	onSpaceAfter: (value: number) => void;
}) {
	const [open, setOpen] = useState(false);
	const [submenu, setSubmenu] = useState<'before' | 'after' | null>(null);
	const [hovered, setHovered] = useState<string | null>(null);

	const close = useCallback(() => {
		setOpen(false);
		setSubmenu(null);
	}, []);

	return (
		<div style={{ position: 'relative', display: 'inline-flex' }}>
			<TBtn title="Line & paragraph spacing" onClick={() => setOpen(!open)}>
				{icons.lineSpacing}
			</TBtn>
			{open && (
				<>
					<div
						style={{ position: 'fixed', inset: 0, zIndex: 999 }}
						onMouseDown={(e) => {
							e.preventDefault();
							close();
						}}
					/>
					<div style={dropdownMenuStyle}>
						<div style={dropdownSectionLabel}>Line spacing</div>
						{LINE_SPACING_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								style={{
									...dropdownItemStyle,
									backgroundColor: hovered === `ls-${opt.value}` ? '#f1f3f4' : 'transparent',
								}}
								onMouseEnter={() => {
									setHovered(`ls-${opt.value}`);
									setSubmenu(null);
								}}
								onMouseLeave={() => setHovered(null)}
								onMouseDown={(e) => {
									e.preventDefault();
									onLineSpacing(opt.value);
									close();
								}}
							>
								{opt.label}
							</button>
						))}

						<div style={dropdownSeparator} />

						<div
							style={{ position: 'relative' }}
							onMouseEnter={() => {
								setHovered('spaceBefore');
								setSubmenu('before');
							}}
							onMouseLeave={() => setHovered(null)}
						>
							<button
								type="button"
								style={{
									...dropdownItemStyle,
									backgroundColor: hovered === 'spaceBefore' ? '#f1f3f4' : 'transparent',
								}}
							>
								<span>Add space before paragraph</span>
								<span style={{ fontSize: 11, color: '#70757a' }}>▸</span>
							</button>
							{submenu === 'before' && (
								<div style={{ ...dropdownMenuStyle, left: '100%', top: -8 }}>
									{PARAGRAPH_SPACING_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											style={{
												...dropdownItemStyle,
												backgroundColor: hovered === `sb-${opt.value}` ? '#f1f3f4' : 'transparent',
											}}
											onMouseEnter={() => setHovered(`sb-${opt.value}`)}
											onMouseLeave={() => setHovered('spaceBefore')}
											onMouseDown={(e) => {
												e.preventDefault();
												onSpaceBefore(opt.value);
												close();
											}}
										>
											{opt.label}
										</button>
									))}
								</div>
							)}
						</div>

						<div
							style={{ position: 'relative' }}
							onMouseEnter={() => {
								setHovered('spaceAfter');
								setSubmenu('after');
							}}
							onMouseLeave={() => setHovered(null)}
						>
							<button
								type="button"
								style={{
									...dropdownItemStyle,
									backgroundColor: hovered === 'spaceAfter' ? '#f1f3f4' : 'transparent',
								}}
							>
								<span>Add space after paragraph</span>
								<span style={{ fontSize: 11, color: '#70757a' }}>▸</span>
							</button>
							{submenu === 'after' && (
								<div style={{ ...dropdownMenuStyle, left: '100%', top: -8 }}>
									{PARAGRAPH_SPACING_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											style={{
												...dropdownItemStyle,
												backgroundColor: hovered === `sa-${opt.value}` ? '#f1f3f4' : 'transparent',
											}}
											onMouseEnter={() => setHovered(`sa-${opt.value}`)}
											onMouseLeave={() => setHovered('spaceAfter')}
											onMouseDown={(e) => {
												e.preventDefault();
												onSpaceAfter(opt.value);
												close();
											}}
										>
											{opt.label}
										</button>
									))}
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Main Toolbar                                                       */
/* ------------------------------------------------------------------ */

export interface ToolbarProps {
	className?: string;
	style?: CSSProperties;
	zoom?: number;
	onZoomChange?: (zoom: number) => void;
	paintFormatActive?: boolean;
	onPaintFormatToggle?: () => void;
}

export function Toolbar({
	className,
	style,
	zoom,
	onZoomChange,
	paintFormatActive,
	onPaintFormatToggle,
}: ToolbarProps) {
	const editor = useEditor();
	useEditorState(); // subscribe to re-render on state changes

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
	const { execute: superscript } = useCommand('format.superscript');
	const { execute: subscript } = useCommand('format.subscript');
	const { execute: clearFormatting } = useCommand('format.clearFormatting');
	const { execute: toggleBullet } = useCommand('list.toggleBullet');
	const { execute: toggleNumbered } = useCommand('list.toggleNumbered');
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

	const handleIndentDecrease = useCallback(() => {
		try {
			if (editor.canExecuteCommand('list.outdent')) {
				editor.executeCommand('list.outdent');
			} else {
				editor.executeCommand('format.indent', { direction: 'decrease' });
			}
		} catch {
			/* not registered */
		}
	}, [editor]);

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
	const alignJustify = useCallback(() => {
		try {
			editor.executeCommand('format.align', { alignment: 'justify' });
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleFontSize = useCallback(
		(size: number) => {
			try {
				// Model stores fontSize in half-points (24 = 12pt), UI shows pt
				editor.executeCommand('format.fontSize', { size: size * 2 });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleFontFamily = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			try {
				editor.executeCommand('format.fontFamily', { family: e.target.value });
			} catch {
				/* */
			}
		},
		[editor],
	);

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

	const handleTextColor = useCallback(
		(color: string) => {
			try {
				editor.executeCommand('format.color', { color });
			} catch {
				/* */
			}
		},
		[editor],
	);

	const handleHighlight = useCallback(
		(color: string) => {
			try {
				editor.executeCommand('format.highlight', { color });
			} catch {
				/* */
			}
		},
		[editor],
	);

	const handleInsertImage = useCallback(() => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				const img = new Image();
				img.onload = () => {
					try {
						editor.executeCommand('image.insert', {
							src: reader.result as string,
							mimeType: file.type,
							width: Math.min(img.width, 600),
							height: Math.min(img.height, 400),
						});
					} catch {
						/* */
					}
				};
				img.src = reader.result as string;
			};
			reader.readAsDataURL(file);
		};
		input.click();
	}, [editor]);

	const [tablePickerOpen, setTablePickerOpen] = useState(false);
	const [shapePickerOpen, setShapePickerOpen] = useState(false);
	const handleInsertTableFromPicker = useCallback(
		(rows: number, cols: number) => {
			setTablePickerOpen(false);
			try {
				editor.executeCommand('table.insert', { rows, cols });
			} catch {
				/* */
			}
		},
		[editor],
	);

	const handleLineSpacing = useCallback(
		(spacing: number) => {
			try {
				editor.executeCommand('format.lineSpacing', { spacing });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleSpaceBefore = useCallback(
		(space: number) => {
			try {
				editor.executeCommand('format.spaceBefore', { space });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleSpaceAfter = useCallback(
		(space: number) => {
			try {
				editor.executeCommand('format.spaceAfter', { space });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const [textColor, setTextColor] = useState('#000000');
	const [highlightColor, setHighlightColor] = useState('#ffff00');
	const toolbarRef = useRef<HTMLDivElement>(null);

	// Keyboard navigation: Arrow Left/Right moves focus between focusable elements in toolbar
	const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

		const toolbar = toolbarRef.current;
		if (!toolbar) return;

		const focusable = Array.from(
			toolbar.querySelectorAll<HTMLElement>('button:not([disabled]), select, input'),
		);
		if (focusable.length === 0) return;

		const current = document.activeElement as HTMLElement;
		const idx = focusable.indexOf(current);
		if (idx === -1) return;

		e.preventDefault();
		let next: number;
		if (e.key === 'ArrowRight') {
			next = idx + 1 < focusable.length ? idx + 1 : 0;
		} else {
			next = idx - 1 >= 0 ? idx - 1 : focusable.length - 1;
		}
		focusable[next].tabIndex = 0;
		focusable[next].focus();
		if (current !== focusable[next]) {
			current.tabIndex = -1;
		}
	}, []);

	return (
		<div
			ref={toolbarRef}
			className={className}
			role="toolbar"
			aria-label="Formatting toolbar"
			aria-orientation="horizontal"
			onKeyDown={handleToolbarKeyDown}
			style={{ ...toolbarStyle, ...style }}
		>
			{/* Search */}
			<TBtn
				title="Search and replace (Ctrl+H)"
				ariaLabel="Search and replace"
				onClick={() => {
					try {
						editor.executeCommand('find.showUI', { replace: true });
					} catch {
						/* not registered */
					}
				}}
			>
				{icons.search}
			</TBtn>

			<Separator />

			{/* Undo / Redo / Print / Spellcheck / Paint format */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="History and tools" style={{ display: 'contents' }}>
				<TBtn title="Undo (Ctrl+Z)" ariaLabel="Undo" onClick={undo} disabled={!editor.canUndo()}>
					{icons.undo}
				</TBtn>
				<TBtn title="Redo (Ctrl+Y)" ariaLabel="Redo" onClick={redo} disabled={!editor.canRedo()}>
					{icons.redo}
				</TBtn>
				<TBtn title="Print (Ctrl+P)" ariaLabel="Print" onClick={() => window.print()}>
					{icons.print}
				</TBtn>
				<TBtn
					title="Spelling and grammar check"
					ariaLabel="Spelling and grammar check"
					onClick={() => {
						try {
							editor.executeCommand('spellcheck.toggle');
						} catch {
							/* not registered */
						}
					}}
				>
					{icons.spellcheck}
				</TBtn>
				<TBtn
					title="Paint format"
					ariaLabel="Paint format"
					onClick={onPaintFormatToggle ?? (() => {})}
					active={paintFormatActive}
					isToggle
				>
					{icons.paintFormat}
				</TBtn>
			</div>

			<Separator />

			{/* Zoom */}
			<select
				aria-label="Zoom level"
				style={{ ...selectStyle, width: 70 }}
				tabIndex={-1}
				value={String(zoom ?? 100)}
				onChange={(e) => onZoomChange?.(Number.parseInt(e.target.value, 10))}
			>
				<option value="50">50%</option>
				<option value="75">75%</option>
				<option value="90">90%</option>
				<option value="100">100%</option>
				<option value="125">125%</option>
				<option value="150">150%</option>
				<option value="200">200%</option>
			</select>

			<Separator />

			{/* Styles / Heading */}
			<select
				aria-label="Paragraph style"
				style={{ ...selectStyle, width: 130 }}
				tabIndex={-1}
				value={String(paraFmt.outlineLevel ?? 0)}
				onChange={handleHeading}
			>
				<option value="0">Normal text</option>
				<option value="1">Heading 1</option>
				<option value="2">Heading 2</option>
				<option value="3">Heading 3</option>
				<option value="4">Heading 4</option>
				<option value="5">Heading 5</option>
				<option value="6">Heading 6</option>
			</select>

			<Separator />

			{/* Font Family */}
			<select
				aria-label="Font family"
				style={{ ...selectStyle, width: 120 }}
				tabIndex={-1}
				value={runFmt.fontFamily ?? 'Arial'}
				onChange={handleFontFamily}
			>
				<option value="Arial">Arial</option>
				<option value="Calibri">Calibri</option>
				<option value="Cambria">Cambria</option>
				<option value="Comic Sans MS">Comic Sans MS</option>
				<option value="Courier New">Courier New</option>
				<option value="Georgia">Georgia</option>
				<option value="Helvetica">Helvetica</option>
				<option value="Impact">Impact</option>
				<option value="Roboto">Roboto</option>
				<option value="Times New Roman">Times New Roman</option>
				<option value="Trebuchet MS">Trebuchet MS</option>
				<option value="Verdana">Verdana</option>
			</select>

			<Separator />

			{/* Font Size */}
			<FontSizeControl
				onChangeSize={handleFontSize}
				currentSize={runFmt.fontSize != null ? runFmt.fontSize / 2 : undefined}
			/>

			<Separator />

			{/* Text formatting */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="Text formatting" style={{ display: 'contents' }}>
				<TBtn title="Bold (Ctrl+B)" ariaLabel="Bold" onClick={bold} active={!!runFmt.bold} isToggle>
					{icons.bold}
				</TBtn>
				<TBtn
					title="Italic (Ctrl+I)"
					ariaLabel="Italic"
					onClick={italic}
					active={!!runFmt.italic}
					isToggle
				>
					{icons.italic}
				</TBtn>
				<TBtn
					title="Underline (Ctrl+U)"
					ariaLabel="Underline"
					onClick={underline}
					active={runFmt.underline != null && runFmt.underline !== 'none'}
					isToggle
				>
					{icons.underline}
				</TBtn>

				{/* Text Color */}
				<ColorPicker
					title="Text color"
					iconNode={icons.textColor}
					currentColor={textColor}
					onSelect={(c) => {
						setTextColor(c);
						handleTextColor(c);
					}}
				/>

				{/* Highlight Color */}
				<ColorPicker
					title="Highlight color"
					iconNode={icons.highlight}
					currentColor={highlightColor}
					onSelect={(c) => {
						setHighlightColor(c);
						handleHighlight(c);
					}}
				/>
			</div>

			<Separator />

			{/* Insert */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="Insert" style={{ display: 'contents' }}>
				<TBtn
					title="Insert link (Ctrl+K)"
					ariaLabel="Insert link"
					onClick={() => {
						try {
							editor.executeCommand('link.showDialog');
						} catch {
							/* not registered */
						}
					}}
				>
					{icons.link}
				</TBtn>
				<TBtn title="Insert image" ariaLabel="Insert image" onClick={handleInsertImage}>
					{icons.image}
				</TBtn>
				<div style={{ position: 'relative', display: 'inline-flex' }}>
					<TBtn
						title="Insert table"
						ariaLabel="Insert table"
						onClick={() => setTablePickerOpen(!tablePickerOpen)}
					>
						{icons.table}
					</TBtn>
					{tablePickerOpen && (
						<TableSizePicker
							onSelect={handleInsertTableFromPicker}
							onClose={() => setTablePickerOpen(false)}
						/>
					)}
				</div>
				<div style={{ position: 'relative', display: 'inline-flex' }}>
					<TBtn
						title="Insert shape"
						ariaLabel="Insert shape"
						onClick={() => setShapePickerOpen(!shapePickerOpen)}
					>
						{icons.shape}
					</TBtn>
					{shapePickerOpen && (
						<ShapePicker editor={editor} onClose={() => setShapePickerOpen(false)} />
					)}
				</div>
			</div>

			<Separator />

			{/* Alignment */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="Alignment" style={{ display: 'contents' }}>
				<TBtn
					title="Align left"
					ariaLabel="Align left"
					onClick={alignLeft}
					active={(paraFmt.alignment ?? 'left') === 'left'}
					isToggle
				>
					{icons.alignLeft}
				</TBtn>
				<TBtn
					title="Align center"
					ariaLabel="Align center"
					onClick={alignCenter}
					active={paraFmt.alignment === 'center'}
					isToggle
				>
					{icons.alignCenter}
				</TBtn>
				<TBtn
					title="Align right"
					ariaLabel="Align right"
					onClick={alignRight}
					active={paraFmt.alignment === 'right'}
					isToggle
				>
					{icons.alignRight}
				</TBtn>
				<TBtn
					title="Align justify"
					ariaLabel="Justify"
					onClick={alignJustify}
					active={paraFmt.alignment === 'justify'}
					isToggle
				>
					{icons.alignJustify}
				</TBtn>
			</div>

			<Separator />

			{/* Lists and indentation */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="Lists" style={{ display: 'contents' }}>
				<TBtn
					title="Bulleted list"
					ariaLabel="Bulleted list"
					onClick={toggleBullet}
					active={paraFmt.numbering?.numId === 1}
					isToggle
				>
					{icons.bulletList}
				</TBtn>
				<TBtn
					title="Numbered list"
					ariaLabel="Numbered list"
					onClick={toggleNumbered}
					active={paraFmt.numbering?.numId === 2}
					isToggle
				>
					{icons.numberList}
				</TBtn>
				<TBtn title="Decrease indent" ariaLabel="Decrease indent" onClick={handleIndentDecrease}>
					{icons.indentDecrease}
				</TBtn>
				<TBtn title="Increase indent" ariaLabel="Increase indent" onClick={handleIndentIncrease}>
					{icons.indentIncrease}
				</TBtn>

				{/* Line & paragraph spacing */}
				<LineSpacingDropdown
					onLineSpacing={handleLineSpacing}
					onSpaceBefore={handleSpaceBefore}
					onSpaceAfter={handleSpaceAfter}
				/>
			</div>

			<Separator />

			{/* Extra formatting */}
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset not appropriate inside toolbar layout */}
			<div role="group" aria-label="Extra formatting" style={{ display: 'contents' }}>
				<TBtn
					title="Strikethrough"
					ariaLabel="Strikethrough"
					onClick={strikethrough}
					active={!!runFmt.strikethrough}
					isToggle
				>
					{icons.strikethrough}
				</TBtn>
				<TBtn
					title="Superscript"
					ariaLabel="Superscript"
					onClick={superscript}
					active={!!runFmt.superscript}
					isToggle
				>
					{icons.superscript}
				</TBtn>
				<TBtn
					title="Subscript"
					ariaLabel="Subscript"
					onClick={subscript}
					active={!!runFmt.subscript}
					isToggle
				>
					{icons.subscript}
				</TBtn>
				<TBtn title="Clear formatting" ariaLabel="Clear formatting" onClick={clearFormatting}>
					{icons.clearFormat}
				</TBtn>
			</div>
		</div>
	);
}
