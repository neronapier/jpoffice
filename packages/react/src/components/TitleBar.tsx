'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';

export interface TitleBarProps {
	title?: string;
	onTitleChange?: (newTitle: string) => void;
	onShare?: () => void;
	className?: string;
	style?: CSSProperties;
}

const barStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	height: 56,
	padding: '0 12px 0 16px',
	backgroundColor: '#fff',
	flexShrink: 0,
	gap: 4,
};

const iconBtnStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 32,
	height: 32,
	border: 'none',
	borderRadius: '50%',
	backgroundColor: 'transparent',
	cursor: 'pointer',
	color: '#5f6368',
	padding: 0,
	flexShrink: 0,
};

const titleInputStyle: CSSProperties = {
	fontSize: 18,
	fontWeight: 400,
	color: '#202124',
	fontFamily: "'Google Sans', Roboto, sans-serif",
	border: '1px solid transparent',
	outline: 'none',
	padding: '2px 6px',
	borderRadius: 4,
	background: 'transparent',
	minWidth: 100,
	maxWidth: 300,
};

const shareBtnStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 8,
	backgroundColor: '#c2e7ff',
	color: '#001d35',
	border: 'none',
	borderRadius: 24,
	padding: '8px 20px',
	fontSize: 14,
	fontWeight: 500,
	cursor: 'pointer',
	fontFamily: "'Google Sans', Roboto, sans-serif",
	flexShrink: 0,
};

const statusTextStyle: CSSProperties = {
	fontSize: 12,
	color: '#5f6368',
	marginLeft: 4,
	whiteSpace: 'nowrap',
};

const svgIcon = (d: string, size = 20) => (
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

// Google Docs document icon
function DocIcon() {
	return (
		<svg width="28" height="28" viewBox="0 0 48 48" role="img" aria-label="Document">
			<path
				fill="#2196F3"
				d="M37 45H11c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h19l10 10v29c0 1.66-1.34 3-3 3z"
			/>
			<path fill="#BBDEFB" d="M40 13H30V3z" />
			<path fill="#E1F5FE" d="M15 23h18v2H15zm0 4h18v2H15zm0 4h18v2H15zm0-12h18v2H15z" />
		</svg>
	);
}

const lockIcon = svgIcon(
	'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z',
	16,
);
const starIcon = svgIcon(
	'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
	18,
);
const folderIcon = svgIcon(
	'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
	18,
);
const historyIcon = svgIcon(
	'M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
);
const commentIcon = svgIcon(
	'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z',
);
const videoIcon = svgIcon(
	'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
);

export function TitleBar({
	title = 'Untitled document',
	onTitleChange,
	onShare,
	className,
	style,
}: TitleBarProps) {
	const [localTitle, setLocalTitle] = useState(title);

	const handleTitleBlur = useCallback(() => {
		if (onTitleChange && localTitle !== title) {
			onTitleChange(localTitle);
		}
	}, [localTitle, title, onTitleChange]);

	return (
		<div className={className} style={{ ...barStyle, ...style }}>
			{/* Doc icon */}
			<div style={{ flexShrink: 0, marginRight: 4, cursor: 'pointer' }}>
				<DocIcon />
			</div>

			{/* Title + actions */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
				{/* Title row */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					<input
						type="text"
						value={localTitle}
						onChange={(e) => setLocalTitle(e.target.value)}
						onBlur={handleTitleBlur}
						style={titleInputStyle}
						onMouseEnter={(e) => {
							e.currentTarget.style.border = '1px solid #dadce0';
						}}
						onMouseLeave={(e) => {
							if (document.activeElement !== e.currentTarget) {
								e.currentTarget.style.border = '1px solid transparent';
							}
						}}
						onFocus={(e) => {
							e.currentTarget.style.border = '1px solid #1a73e8';
						}}
					/>
					<button
						type="button"
						title="Star"
						style={iconBtnStyle}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#f1f3f4';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
						}}
					>
						{starIcon}
					</button>
					<button
						type="button"
						title="Move to folder"
						style={iconBtnStyle}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#f1f3f4';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
						}}
					>
						{folderIcon}
					</button>
					<span style={statusTextStyle}>Saved</span>
				</div>
			</div>

			{/* Right side actions */}
			<div
				style={{
					marginLeft: 'auto',
					display: 'flex',
					alignItems: 'center',
					gap: 4,
				}}
			>
				<button
					type="button"
					title="Version history"
					style={iconBtnStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{historyIcon}
				</button>
				<button
					type="button"
					title="Open comment history"
					style={iconBtnStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{commentIcon}
				</button>
				<button
					type="button"
					title="Join a call"
					style={iconBtnStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{videoIcon}
				</button>

				{/* Share button */}
				<button
					type="button"
					onClick={onShare}
					style={shareBtnStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#a8daf8';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = '#c2e7ff';
					}}
				>
					{lockIcon}
					Share
				</button>

				{/* Avatar */}
				<div
					style={{
						width: 32,
						height: 32,
						borderRadius: '50%',
						backgroundColor: '#1a73e8',
						color: '#fff',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: 14,
						fontWeight: 500,
						cursor: 'pointer',
						flexShrink: 0,
						marginLeft: 4,
					}}
				>
					U
				</div>
			</div>
		</div>
	);
}
