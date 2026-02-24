'use client';

/**
 * StylesPanel displays a sidebar listing all document styles.
 * Each style shows a preview of its formatting, and the currently
 * active style is highlighted. Clicking a style applies it.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { StyleInfo } from '@jpoffice/engine';
import type { CSSProperties } from 'react';
import { useStyles } from '../hooks/useStyles';

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
	padding: '4px 0',
};

const styleItemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	padding: '8px 16px',
	cursor: 'pointer',
	borderBottom: '1px solid #f1f3f4',
	transition: 'background 0.1s',
};

const styleItemActiveStyle: CSSProperties = {
	...styleItemStyle,
	background: '#e8f0fe',
};

const stylePreviewStyle: CSSProperties = {
	flex: 1,
	minWidth: 0,
};

const styleNameStyle: CSSProperties = {
	fontSize: 13,
	color: '#202124',
	marginBottom: 2,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
};

const styleMetaStyle: CSSProperties = {
	fontSize: 11,
	color: '#80868b',
};

const styleTypeBadgeStyle: CSSProperties = {
	fontSize: 10,
	padding: '1px 6px',
	borderRadius: 3,
	background: '#f1f3f4',
	color: '#5f6368',
	marginLeft: 8,
	flexShrink: 0,
};

const inUseDotStyle: CSSProperties = {
	width: 6,
	height: 6,
	borderRadius: '50%',
	background: '#34a853',
	marginRight: 8,
	flexShrink: 0,
};

const notInUseDotStyle: CSSProperties = {
	...inUseDotStyle,
	background: 'transparent',
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

export interface StylesPanelProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildPreviewStyle(info: StyleInfo): CSSProperties {
	const props = info.properties;
	const result: CSSProperties = {};
	if (props.fontFamily) result.fontFamily = props.fontFamily;
	if (props.fontSize) result.fontSize = Math.min(props.fontSize / 2, 20);
	if (props.bold) result.fontWeight = 'bold';
	if (props.italic) result.fontStyle = 'italic';
	if (props.underline && props.underline !== 'none') result.textDecoration = 'underline';
	if (props.color) result.color = props.color.startsWith('#') ? props.color : `#${props.color}`;
	return result;
}

function formatDescription(info: StyleInfo): string {
	const parts: string[] = [];
	const p = info.properties;
	if (p.fontFamily) parts.push(p.fontFamily);
	if (p.fontSize) parts.push(`${p.fontSize / 2}pt`);
	if (p.bold) parts.push('Bold');
	if (p.italic) parts.push('Italic');
	if (p.alignment) parts.push(p.alignment.charAt(0).toUpperCase() + p.alignment.slice(1));
	return parts.join(', ') || 'Default';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StylesPanel({ editor, onClose }: StylesPanelProps) {
	const { styles, currentStyle, applyStyle } = useStyles(editor);

	// Separate paragraph and character styles
	const paragraphStyles = styles.filter((s) => s.type === 'paragraph');
	const characterStyles = styles.filter((s) => s.type === 'character');

	const renderStyleItem = (info: StyleInfo) => {
		const isActive = info.id === currentStyle;
		return (
			<button
				key={info.id}
				type="button"
				style={isActive ? styleItemActiveStyle : styleItemStyle}
				onClick={() => applyStyle(info.id, info.type)}
				onMouseEnter={(e) => {
					if (!isActive) {
						(e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa';
					}
				}}
				onMouseLeave={(e) => {
					if (!isActive) {
						(e.currentTarget as HTMLButtonElement).style.background = '';
					}
				}}
			>
				<div style={info.inUse ? inUseDotStyle : notInUseDotStyle} />
				<div style={stylePreviewStyle}>
					<div style={{ ...styleNameStyle, ...buildPreviewStyle(info) }}>{info.name}</div>
					<div style={styleMetaStyle}>{formatDescription(info)}</div>
				</div>
				<span style={styleTypeBadgeStyle}>{info.type === 'paragraph' ? 'P' : 'C'}</span>
			</button>
		);
	};

	return (
		<div style={panelStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<h3 style={headerTitleStyle}>Styles</h3>
				<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
					&times;
				</button>
			</div>

			{/* Body */}
			<div style={bodyStyle}>
				{paragraphStyles.length === 0 && characterStyles.length === 0 ? (
					<div style={emptyStyle}>No styles available.</div>
				) : (
					<>
						{paragraphStyles.length > 0 && (
							<>
								<div
									style={{
										padding: '8px 16px 4px',
										fontSize: 11,
										fontWeight: 600,
										color: '#80868b',
										textTransform: 'uppercase',
										letterSpacing: 0.5,
									}}
								>
									Paragraph Styles
								</div>
								{paragraphStyles.map(renderStyleItem)}
							</>
						)}
						{characterStyles.length > 0 && (
							<>
								<div
									style={{
										padding: '12px 16px 4px',
										fontSize: 11,
										fontWeight: 600,
										color: '#80868b',
										textTransform: 'uppercase',
										letterSpacing: 0.5,
									}}
								>
									Character Styles
								</div>
								{characterStyles.map(renderStyleItem)}
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
}
