'use client';

/**
 * ShapePicker displays a dropdown grid of shape thumbnails.
 * Clicking a shape inserts it into the document.
 */

import type { JPEditor } from '@jpoffice/engine';
import { useCallback } from 'react';
import type { CSSProperties, ReactElement } from 'react';

/* ------------------------------------------------------------------ */
/*  Shape definitions                                                  */
/* ------------------------------------------------------------------ */

const SHAPES = [
	{ type: 'rectangle', label: 'Rectangle' },
	{ type: 'rounded-rectangle', label: 'Rounded Rect' },
	{ type: 'ellipse', label: 'Ellipse' },
	{ type: 'triangle', label: 'Triangle' },
	{ type: 'diamond', label: 'Diamond' },
	{ type: 'pentagon', label: 'Pentagon' },
	{ type: 'hexagon', label: 'Hexagon' },
	{ type: 'star', label: 'Star' },
	{ type: 'arrow-right', label: 'Arrow Right' },
	{ type: 'arrow-left', label: 'Arrow Left' },
	{ type: 'arrow-up', label: 'Arrow Up' },
	{ type: 'arrow-down', label: 'Arrow Down' },
	{ type: 'callout', label: 'Callout' },
	{ type: 'cloud', label: 'Cloud' },
	{ type: 'heart', label: 'Heart' },
	{ type: 'line', label: 'Line' },
] as const;

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const pickerStyle: CSSProperties = {
	position: 'absolute',
	top: '100%',
	left: 0,
	marginTop: 4,
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
	padding: 8,
	display: 'grid',
	gridTemplateColumns: 'repeat(4, 1fr)',
	gap: 4,
	zIndex: 50,
	width: 200,
};

const shapeBtnStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	border: '1px solid transparent',
	background: 'transparent',
	cursor: 'pointer',
	borderRadius: 4,
	padding: '6px 4px',
	fontSize: 10,
	color: '#3c4043',
	gap: 2,
};

const shapeIconStyle: CSSProperties = {
	width: 28,
	height: 28,
	background: '#e8f0fe',
	borderRadius: 3,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: 14,
};

/* ------------------------------------------------------------------ */
/*  Shape icon SVG-like representations                                */
/* ------------------------------------------------------------------ */

const SHAPE_ICONS: Record<string, string> = {
	rectangle: '\u25A0',
	'rounded-rectangle': '\u25A2',
	ellipse: '\u25CF',
	triangle: '\u25B2',
	diamond: '\u25C6',
	pentagon: '\u2B1F',
	hexagon: '\u2B22',
	star: '\u2605',
	'arrow-right': '\u27A1',
	'arrow-left': '\u2B05',
	'arrow-up': '\u2B06',
	'arrow-down': '\u2B07',
	callout: '\u{1F4AC}',
	cloud: '\u2601',
	heart: '\u2665',
	line: '\u2015',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ShapePickerProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShapePicker({ editor, onClose }: ShapePickerProps): ReactElement {
	const handleInsert = useCallback(
		(shapeType: string) => {
			try {
				editor.executeCommand('shape.insert', {
					shapeType,
					x: 914400, // 1 inch from left (EMU)
					y: 914400, // 1 inch from top
					width: 1828800, // 2 inches wide
					height: 914400, // 1 inch tall
				});
			} catch {
				/* command not registered */
			}
			onClose();
		},
		[editor, onClose],
	);

	return (
		<div style={pickerStyle}>
			{SHAPES.map((shape) => (
				<button
					key={shape.type}
					type="button"
					style={shapeBtnStyle}
					onClick={() => handleInsert(shape.type)}
					onMouseEnter={(e) => {
						(e.currentTarget as HTMLButtonElement).style.background = '#f1f3f4';
						(e.currentTarget as HTMLButtonElement).style.borderColor = '#dadce0';
					}}
					onMouseLeave={(e) => {
						(e.currentTarget as HTMLButtonElement).style.background = 'transparent';
						(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
					}}
					title={shape.label}
				>
					<span style={shapeIconStyle}>{SHAPE_ICONS[shape.type] ?? '\u25A0'}</span>
					<span>{shape.label}</span>
				</button>
			))}
		</div>
	);
}
