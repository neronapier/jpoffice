'use client';

/**
 * TablePropertiesDialog provides a modal for editing table properties:
 * border style/width/color, cell shading, and table alignment.
 * Changes are applied via the editor's set_properties operation on the
 * table node at the current cursor position.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { JPBorderDef, JPBorderStyle, JPShading, JPTableBorders } from '@jpoffice/model';
import { useCallback, useEffect, useState } from 'react';
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
	width: 500,
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
	padding: '16px 20px',
};

const sectionTitleStyle: CSSProperties = {
	fontSize: 13,
	fontWeight: 600,
	color: '#3c4043',
	marginBottom: 10,
	marginTop: 16,
};

const fieldRowStyle: CSSProperties = {
	display: 'flex',
	gap: 12,
	marginBottom: 12,
};

const fieldStyle: CSSProperties = {
	flex: 1,
};

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: 12,
	color: '#5f6368',
	marginBottom: 4,
};

const inputStyle: CSSProperties = {
	width: '100%',
	border: '1px solid #dadce0',
	borderRadius: 4,
	padding: '8px 10px',
	fontSize: 13,
	outline: 'none',
	boxSizing: 'border-box',
};

const selectStyle: CSSProperties = {
	...inputStyle,
	cursor: 'pointer',
};

const colorInputStyle: CSSProperties = {
	width: '100%',
	height: 36,
	border: '1px solid #dadce0',
	borderRadius: 4,
	padding: 2,
	cursor: 'pointer',
	boxSizing: 'border-box',
	background: '#fff',
};

const previewBoxStyle: CSSProperties = {
	marginTop: 12,
	padding: 16,
	border: '2px solid #000',
	borderRadius: 4,
	background: '#fff',
	textAlign: 'center',
	fontSize: 13,
	color: '#5f6368',
	minHeight: 60,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
};

const footerStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'flex-end',
	gap: 8,
	padding: '12px 20px',
	borderTop: '1px solid #e0e0e0',
	flexShrink: 0,
};

const cancelBtnStyle: CSSProperties = {
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	color: '#3c4043',
	padding: '8px 20px',
	borderRadius: 4,
};

const applyBtnStyle: CSSProperties = {
	border: 'none',
	background: '#1a73e8',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	color: '#fff',
	padding: '8px 20px',
	borderRadius: 4,
};

const alignmentRowStyle: CSSProperties = {
	display: 'flex',
	gap: 8,
	marginBottom: 12,
};

const alignBtnBase: CSSProperties = {
	flex: 1,
	padding: '8px 0',
	border: '1px solid #dadce0',
	background: '#fff',
	borderRadius: 4,
	cursor: 'pointer',
	fontSize: 13,
	color: '#3c4043',
	fontWeight: 500,
};

const alignBtnActiveStyle: CSSProperties = {
	...alignBtnBase,
	background: '#e8f0fe',
	borderColor: '#1a73e8',
	color: '#1a73e8',
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BORDER_STYLES: { value: JPBorderStyle; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'single', label: 'Single' },
	{ value: 'double', label: 'Double' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' },
	{ value: 'thick', label: 'Thick' },
	{ value: 'dashDot', label: 'Dash-Dot' },
	{ value: 'wave', label: 'Wave' },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TablePropertiesDialogProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TablePropertiesDialog({ editor, onClose }: TablePropertiesDialogProps) {
	// Border state
	const [borderStyle, setBorderStyle] = useState<JPBorderStyle>('single');
	const [borderWidth, setBorderWidth] = useState(4); // eighths of a point
	const [borderColor, setBorderColor] = useState('#000000');

	// Shading state
	const [shadingFill, setShadingFill] = useState('#ffffff');

	// Alignment
	const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');

	// Try to load current table properties
	useEffect(() => {
		try {
			const sel = editor.getSelection();
			if (!sel) return;

			// Walk up from selection to find table node
			const doc = editor.getDocument();
			const path = sel.anchor.path;

			// Simple heuristic: look for a table ancestor
			// In JPOffice tree: doc > body > section > [table|paragraph] > ...
			// Tables at path length 3 from root
			if (path.length >= 4) {
				let node: {
					type?: string;
					children?: readonly unknown[];
					properties?: Record<string, unknown>;
				} = doc;
				for (let i = 0; i < Math.min(path.length, 4); i++) {
					if (node.children && path[i] < node.children.length) {
						node = node.children[path[i]] as typeof node;
					}
					if (node.type === 'table') {
						const props = node.properties as Record<string, unknown> | undefined;
						if (props) {
							const borders = props.borders as JPTableBorders | undefined;
							if (borders?.top) {
								setBorderStyle(borders.top.style);
								setBorderWidth(borders.top.width);
								setBorderColor(
									borders.top.color.startsWith('#') ? borders.top.color : `#${borders.top.color}`,
								);
							}
							const shading = props.shading as JPShading | undefined;
							if (shading) {
								setShadingFill(shading.fill.startsWith('#') ? shading.fill : `#${shading.fill}`);
							}
							const align = props.alignment as string | undefined;
							if (align === 'left' || align === 'center' || align === 'right') {
								setAlignment(align);
							}
						}
						break;
					}
				}
			}
		} catch {
			// Unable to resolve table - use defaults
		}
	}, [editor]);

	const handleApply = useCallback(() => {
		const colorHex = borderColor.replace('#', '');
		const border: JPBorderDef = {
			style: borderStyle,
			width: borderWidth,
			color: colorHex,
		};

		const borders: JPTableBorders = {
			top: border,
			bottom: border,
			left: border,
			right: border,
			insideH: border,
			insideV: border,
		};

		const shadingFillHex = shadingFill.replace('#', '');
		const shading: JPShading = { fill: shadingFillHex };

		// Apply to table via table.setProperties command if available,
		// otherwise use the generic editor command
		try {
			editor.executeCommand('table.setProperties', {
				borders,
				shading,
				alignment,
			});
		} catch {
			// If the command isn't registered, try a direct approach
			// This is a fallback - the table plugin should handle this
		}

		onClose();
	}, [editor, borderStyle, borderWidth, borderColor, shadingFill, alignment, onClose]);

	// Preview border style for visual feedback
	const previewBorderCss = (() => {
		if (borderStyle === 'none') return 'none';
		const widthPx = Math.max(1, Math.round(borderWidth / 4));
		let cssStyle = 'solid';
		if (borderStyle === 'dashed' || borderStyle === 'dashDot') cssStyle = 'dashed';
		if (borderStyle === 'dotted') cssStyle = 'dotted';
		if (borderStyle === 'double') cssStyle = 'double';
		return `${widthPx}px ${cssStyle} ${borderColor}`;
	})();

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
					<h3 style={headerTitleStyle}>Table Properties</h3>
					<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
						&times;
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{/* Border Style */}
					<div style={{ ...sectionTitleStyle, marginTop: 0 }}>Borders</div>
					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Style
								<select
									style={selectStyle}
									value={borderStyle}
									onChange={(e) => setBorderStyle(e.target.value as JPBorderStyle)}
								>
									{BORDER_STYLES.map((bs) => (
										<option key={bs.value} value={bs.value}>
											{bs.label}
										</option>
									))}
								</select>
							</label>
						</div>
						<div style={{ ...fieldStyle, maxWidth: 100 }}>
							<label style={labelStyle}>
								Width (1/8 pt)
								<input
									type="number"
									style={inputStyle}
									value={borderWidth}
									onChange={(e) => setBorderWidth(Number(e.target.value))}
									min={0}
									max={96}
									step={1}
								/>
							</label>
						</div>
						<div style={{ ...fieldStyle, maxWidth: 80 }}>
							<label style={labelStyle}>
								Color
								<input
									type="color"
									style={colorInputStyle}
									value={borderColor}
									onChange={(e) => setBorderColor(e.target.value)}
								/>
							</label>
						</div>
					</div>

					{/* Cell Shading */}
					<div style={sectionTitleStyle}>Cell Shading</div>
					<div style={fieldRowStyle}>
						<div style={{ ...fieldStyle, maxWidth: 120 }}>
							<label style={labelStyle}>
								Fill Color
								<input
									type="color"
									style={colorInputStyle}
									value={shadingFill}
									onChange={(e) => setShadingFill(e.target.value)}
								/>
							</label>
						</div>
						<div style={fieldStyle}>
							<span style={labelStyle}>Preview</span>
							<div
								style={{
									width: '100%',
									height: 36,
									background: shadingFill,
									border: '1px solid #dadce0',
									borderRadius: 4,
								}}
							/>
						</div>
					</div>

					{/* Alignment */}
					<div style={sectionTitleStyle}>Table Alignment</div>
					<div style={alignmentRowStyle}>
						<button
							type="button"
							style={alignment === 'left' ? alignBtnActiveStyle : alignBtnBase}
							onClick={() => setAlignment('left')}
						>
							Left
						</button>
						<button
							type="button"
							style={alignment === 'center' ? alignBtnActiveStyle : alignBtnBase}
							onClick={() => setAlignment('center')}
						>
							Center
						</button>
						<button
							type="button"
							style={alignment === 'right' ? alignBtnActiveStyle : alignBtnBase}
							onClick={() => setAlignment('right')}
						>
							Right
						</button>
					</div>

					{/* Border Preview */}
					<div style={sectionTitleStyle}>Preview</div>
					<div
						style={{
							...previewBoxStyle,
							border: previewBorderCss,
							background: shadingFill,
						}}
					>
						Table Preview
					</div>
				</div>

				{/* Footer */}
				<div style={footerStyle}>
					<button type="button" style={cancelBtnStyle} onClick={onClose}>
						Cancel
					</button>
					<button type="button" style={applyBtnStyle} onClick={handleApply}>
						Apply
					</button>
				</div>
			</div>
		</div>
	);
}
