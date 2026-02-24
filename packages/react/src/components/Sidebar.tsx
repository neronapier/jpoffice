'use client';

import type { CSSProperties } from 'react';

export interface SidebarProps {
	visible?: boolean;
	onClose?: () => void;
	className?: string;
	style?: CSSProperties;
}

const containerStyle: CSSProperties = {
	width: 256,
	backgroundColor: '#fff',
	borderRight: '1px solid #dadce0',
	display: 'flex',
	flexDirection: 'column',
	flexShrink: 0,
	overflow: 'hidden',
};

const headerBtnStyle: CSSProperties = {
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

const backArrow = svgIcon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z');
const addIcon = svgIcon('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z');
const docTabIcon = svgIcon(
	'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
	18,
);
const moreIcon = svgIcon(
	'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
	18,
);

export function Sidebar({ visible = true, onClose, className, style }: SidebarProps) {
	if (!visible) return null;

	return (
		<div className={className} style={{ ...containerStyle, ...style }}>
			{/* Back button */}
			<div style={{ padding: '8px 12px' }}>
				<button
					type="button"
					title="Close sidebar"
					onClick={onClose}
					style={headerBtnStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{backArrow}
				</button>
			</div>

			{/* Document tabs header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '4px 16px',
				}}
			>
				<span
					style={{
						fontSize: 14,
						fontWeight: 500,
						color: '#202124',
					}}
				>
					Document tabs
				</span>
				<button
					type="button"
					title="Add tab"
					style={{ ...headerBtnStyle, width: 24, height: 24 }}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{addIcon}
				</button>
			</div>

			{/* Tab entry */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					padding: '8px 16px',
					backgroundColor: '#e8f0fe',
					borderLeft: '3px solid #1a73e8',
					cursor: 'pointer',
				}}
			>
				<span style={{ color: '#5f6368', flexShrink: 0 }}>{docTabIcon}</span>
				<span
					style={{
						fontSize: 13,
						color: '#1a73e8',
						fontWeight: 500,
						flex: 1,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					Tab 1
				</span>
				<button
					type="button"
					title="Tab options"
					style={{
						...headerBtnStyle,
						width: 24,
						height: 24,
						flexShrink: 0,
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#d3e3fd';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					{moreIcon}
				</button>
			</div>

			{/* Headings placeholder */}
			<div
				style={{
					padding: '24px 16px',
					fontSize: 13,
					color: '#80868b',
					textAlign: 'center',
					fontStyle: 'italic',
					lineHeight: 1.5,
				}}
			>
				Headings you add to the document will appear here.
			</div>
		</div>
	);
}
