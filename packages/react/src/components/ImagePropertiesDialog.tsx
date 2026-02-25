'use client';

/**
 * ImagePropertiesDialog provides a modal for editing image size, wrap type,
 * and alt text. Pattern follows PageSetupDialog.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { JPPath } from '@jpoffice/model';
import { cmToEmu, emuToCm, findNode, isImage } from '@jpoffice/model';
import { useCallback, useEffect, useRef, useState } from 'react';
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
	width: 440,
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

const rowStyle: CSSProperties = {
	display: 'flex',
	gap: 12,
	marginBottom: 8,
};

const fieldStyle: CSSProperties = {
	flex: 1,
	display: 'flex',
	flexDirection: 'column',
	gap: 4,
};

const labelStyle: CSSProperties = {
	fontSize: 12,
	color: '#5f6368',
};

const inputStyle: CSSProperties = {
	border: '1px solid #dadce0',
	borderRadius: 4,
	padding: '6px 8px',
	fontSize: 13,
	color: '#202124',
	outline: 'none',
	width: '100%',
	boxSizing: 'border-box',
};

const selectStyle: CSSProperties = {
	...inputStyle,
	appearance: 'auto' as const,
};

const footerStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'flex-end',
	gap: 8,
	padding: '12px 20px',
	borderTop: '1px solid #e0e0e0',
	flexShrink: 0,
};

const btnBase: CSSProperties = {
	padding: '8px 20px',
	borderRadius: 4,
	fontSize: 13,
	fontWeight: 500,
	cursor: 'pointer',
	border: 'none',
};

const cancelBtnStyle: CSSProperties = {
	...btnBase,
	background: '#f1f3f4',
	color: '#3c4043',
};

const applyBtnStyle: CSSProperties = {
	...btnBase,
	background: '#1a73e8',
	color: '#fff',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ImagePropertiesDialogProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const WRAP_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: 'inline', label: 'En línea con el texto' },
	{ value: 'square', label: 'Cuadrado' },
	{ value: 'tight', label: 'Estrecho' },
	{ value: 'behind', label: 'Detrás del texto' },
	{ value: 'inFront', label: 'Delante del texto' },
];

export function ImagePropertiesDialog({ editor, onClose }: ImagePropertiesDialogProps) {
	const [widthMm, setWidthMm] = useState(50);
	const [heightMm, setHeightMm] = useState(50);
	const [lockAspect, setLockAspect] = useState(true);
	const [wrapType, setWrapType] = useState('inline');
	const [altText, setAltText] = useState('');
	const [aspect, setAspect] = useState(1);
	const imagePathRef = useRef<JPPath | null>(null);

	// Load current image properties by finding the image node in the document
	useEffect(() => {
		try {
			const doc = editor.getDocument();
			// Find the first image node in the document tree
			const found = findNode(doc, (n) => isImage(n));
			if (!found) return;
			const [node, path] = found;
			imagePathRef.current = path;
			const props = (node as unknown as { properties: Record<string, unknown> }).properties;
			if (props.width) {
				const w = emuToCm(props.width as number) * 10; // cm to mm
				setWidthMm(Math.round(w * 10) / 10);
			}
			if (props.height) {
				const h = emuToCm(props.height as number) * 10; // cm to mm
				setHeightMm(Math.round(h * 10) / 10);
			}
			if (props.width && props.height) {
				setAspect((props.width as number) / (props.height as number));
			}
			if (props.wrapType) setWrapType(props.wrapType as string);
			if (props.altText) setAltText(props.altText as string);
		} catch {
			/* ignore if path is invalid */
		}
	}, [editor]);

	const handleWidthChange = useCallback(
		(val: string) => {
			const w = Number.parseFloat(val);
			if (Number.isNaN(w)) return;
			setWidthMm(w);
			if (lockAspect && aspect > 0) {
				setHeightMm(Math.round((w / aspect) * 10) / 10);
			}
		},
		[lockAspect, aspect],
	);

	const handleHeightChange = useCallback(
		(val: string) => {
			const h = Number.parseFloat(val);
			if (Number.isNaN(h)) return;
			setHeightMm(h);
			if (lockAspect && aspect > 0) {
				setWidthMm(Math.round(h * aspect * 10) / 10);
			}
		},
		[lockAspect, aspect],
	);

	const handleApply = useCallback(() => {
		const path = imagePathRef.current;
		if (!path) {
			onClose();
			return;
		}

		try {
			editor.executeCommand('image.resize', {
				path,
				width: Math.round(cmToEmu(widthMm / 10)), // mm to cm
				height: Math.round(cmToEmu(heightMm / 10)), // mm to cm
			});
		} catch { /* command not registered */ }

		try {
			editor.executeCommand('image.setWrap', { path, wrapType });
		} catch { /* command not registered */ }

		try {
			editor.executeCommand('image.setAltText', { path, altText });
		} catch { /* command not registered */ }

		onClose();
	}, [editor, widthMm, heightMm, wrapType, altText, onClose]);

	return (
		<div
			role="presentation"
			style={overlayStyle}
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
			onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
		>
			<div role="dialog" aria-label="Propiedades de imagen" style={dialogStyle}>
				{/* Header */}
				<div style={headerStyle}>
					<h2 style={headerTitleStyle}>Propiedades de imagen</h2>
					<button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Cerrar">
						×
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					<div style={{ ...sectionTitleStyle, marginTop: 0 }}>Tamaño</div>
					<div style={rowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>Ancho (mm)</label>
							<input
								type="number"
								style={inputStyle}
								value={widthMm}
								min={1}
								step={0.1}
								onChange={(e) => handleWidthChange(e.target.value)}
							/>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>Alto (mm)</label>
							<input
								type="number"
								style={inputStyle}
								value={heightMm}
								min={1}
								step={0.1}
								onChange={(e) => handleHeightChange(e.target.value)}
							/>
						</div>
					</div>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3c4043', marginBottom: 8 }}>
						<input
							type="checkbox"
							checked={lockAspect}
							onChange={(e) => setLockAspect(e.target.checked)}
						/>
						Bloquear relación de aspecto
					</label>

					<div style={sectionTitleStyle}>Ajuste de texto</div>
					<select
						style={selectStyle}
						value={wrapType}
						onChange={(e) => setWrapType(e.target.value)}
					>
						{WRAP_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>

					<div style={sectionTitleStyle}>Texto alternativo</div>
					<textarea
						style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
						value={altText}
						onChange={(e) => setAltText(e.target.value)}
						placeholder="Describe esta imagen para lectores de pantalla..."
					/>
				</div>

				{/* Footer */}
				<div style={footerStyle}>
					<button type="button" style={cancelBtnStyle} onClick={onClose}>
						Cancelar
					</button>
					<button type="button" style={applyBtnStyle} onClick={handleApply}>
						Aplicar
					</button>
				</div>
			</div>
		</div>
	);
}
