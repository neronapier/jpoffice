'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EditorMode } from '../JPOfficeEditor';

export interface ModePanelProps {
	mode: EditorMode;
	onModeChange: (mode: EditorMode) => void;
	className?: string;
	style?: CSSProperties;
}

export type ModeButtonsProps = ModePanelProps;

const pillStyle: CSSProperties = {
	position: 'absolute',
	top: 16,
	right: 16,
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	backgroundColor: '#fff',
	borderRadius: 24,
	boxShadow: '0 1px 3px 1px rgba(60,64,67,0.15)',
	padding: '4px 0',
	zIndex: 10,
	gap: 0,
};

const pillBtnStyle: CSSProperties = {
	width: 40,
	height: 40,
	border: 'none',
	borderRadius: 20,
	cursor: 'pointer',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	padding: 0,
	backgroundColor: 'transparent',
	color: '#5f6368',
	transition: 'background-color 0.15s',
};

const dropdownStyle: CSSProperties = {
	position: 'absolute',
	top: 0,
	right: 52,
	backgroundColor: '#fff',
	borderRadius: 8,
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
	padding: 4,
	minWidth: 200,
	zIndex: 20,
};

const dropdownItemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 10,
	padding: '8px 12px',
	border: 'none',
	background: 'none',
	borderRadius: 6,
	cursor: 'pointer',
	width: '100%',
	fontSize: 13,
	color: '#202124',
	textAlign: 'left',
};

const MODES: { key: EditorMode; label: string; description: string }[] = [
	{ key: 'editing', label: 'Editing', description: 'Edit directly' },
	{ key: 'suggesting', label: 'Suggesting', description: 'Suggest changes' },
	{ key: 'viewing', label: 'Viewing', description: 'View only' },
];

const mIcon = (d: string) => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
		<path d={d} />
	</svg>
);

const pencilSvg = mIcon(
	'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z',
);
const commentPlusSvg = mIcon(
	'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10zM11 7v3H8v2h3v3h2v-3h3v-2h-3V7h-2z',
);
const emojiSvg = mIcon(
	'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
);
const imageSvg = mIcon(
	'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
);

function getModeIcon(mode: EditorMode) {
	switch (mode) {
		case 'editing':
			return pencilSvg;
		case 'suggesting':
			return mIcon('M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z');
		case 'viewing':
			return mIcon(
				'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
			);
	}
}

function getModeColor(mode: EditorMode): string {
	switch (mode) {
		case 'editing':
			return '#1a73e8';
		case 'suggesting':
			return '#e8710a';
		case 'viewing':
			return '#5f6368';
	}
}

export function ModePanel({ mode, onModeChange, className, style }: ModePanelProps) {
	const [open, setOpen] = useState(false);

	const toggleDropdown = useCallback(() => {
		setOpen((prev) => !prev);
	}, []);

	const selectMode = useCallback(
		(m: EditorMode) => {
			onModeChange(m);
			setOpen(false);
		},
		[onModeChange],
	);

	return (
		<div className={className} style={{ ...pillStyle, ...style }}>
			{/* Mode selector */}
			<div style={{ position: 'relative' }}>
				<button
					type="button"
					title={`Mode: ${mode}`}
					onClick={toggleDropdown}
					style={{
						...pillBtnStyle,
						color: getModeColor(mode),
						backgroundColor: open ? '#e8f0fe' : 'transparent',
					}}
				>
					{getModeIcon(mode)}
				</button>
				{open && (
					<div style={dropdownStyle}>
						{MODES.map((m) => (
							<button
								key={m.key}
								type="button"
								onClick={() => selectMode(m.key)}
								style={{
									...dropdownItemStyle,
									backgroundColor: mode === m.key ? '#e8f0fe' : 'transparent',
									fontWeight: mode === m.key ? 600 : 400,
								}}
								onMouseEnter={(e) => {
									if (mode !== m.key) e.currentTarget.style.backgroundColor = '#f1f3f4';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.backgroundColor =
										mode === m.key ? '#e8f0fe' : 'transparent';
								}}
							>
								<span style={{ color: getModeColor(m.key) }}>{getModeIcon(m.key)}</span>
								<span>
									<div>{m.label}</div>
									<div style={{ fontSize: 11, color: '#80868b' }}>{m.description}</div>
								</span>
							</button>
						))}
					</div>
				)}
			</div>

			{/* Add comment */}
			<button
				type="button"
				title="Add comment (Ctrl+Alt+M)"
				style={pillBtnStyle}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = '#f1f3f4';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = 'transparent';
				}}
			>
				{commentPlusSvg}
			</button>

			{/* Emoji reaction */}
			<button
				type="button"
				title="Add emoji reaction"
				style={pillBtnStyle}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = '#f1f3f4';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = 'transparent';
				}}
			>
				{emojiSvg}
			</button>

			{/* Suggest edits with image */}
			<button
				type="button"
				title="Suggest edits"
				style={pillBtnStyle}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = '#f1f3f4';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = 'transparent';
				}}
			>
				{imageSvg}
			</button>
		</div>
	);
}

// Backward compatibility alias
export const ModeButtons = ModePanel;
