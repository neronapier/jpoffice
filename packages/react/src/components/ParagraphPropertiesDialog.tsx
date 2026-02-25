'use client';

/**
 * ParagraphPropertiesDialog provides a modal for editing paragraph formatting:
 * indents, spacing, line spacing, and line/page break options.
 * Pattern follows PageSetupDialog.
 */

import type { JPEditor } from '@jpoffice/engine';
import { getParagraphsInRange } from '@jpoffice/engine';
import type { JPParagraph } from '@jpoffice/model';
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
	width: 480,
	maxHeight: '85vh',
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

const checkboxRow: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 6,
	fontSize: 13,
	color: '#3c4043',
	marginBottom: 6,
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

export interface ParagraphPropertiesDialogProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helper: twips to pt for spacing display                            */
/* ------------------------------------------------------------------ */

function twipsToPt(twips: number): number {
	return twips / 20;
}

function ptToTwips(pt: number): number {
	return Math.round(pt * 20);
}

// mm conversion via twips: 1mm ≈ 56.7 twips
function twipsToMm(twips: number): number {
	return Math.round((twips / 56.692913) * 10) / 10;
}

function mmToTwips(mm: number): number {
	return Math.round(mm * 56.692913);
}

/* ------------------------------------------------------------------ */
/*  Line spacing types                                                 */
/* ------------------------------------------------------------------ */

type LineSpacingType = 'single' | '1.5' | 'double' | 'exactly' | 'atLeast' | 'multiple';

function getLineSpacingType(spacing: JPParagraph['properties']['spacing']): LineSpacingType {
	const line = spacing?.line;
	if (!line) return 'single';
	const rule = spacing?.lineRule;
	if (rule === 'exact') return 'exactly';
	if (rule === 'atLeast') return 'atLeast';
	// Auto: interpret as multiple of 240
	if (line === 240) return 'single';
	if (line === 360) return '1.5';
	if (line === 480) return 'double';
	return 'multiple';
}

function getLineSpacingValue(spacing: JPParagraph['properties']['spacing']): number {
	const type = getLineSpacingType(spacing);
	const line = spacing?.line ?? 240;
	if (type === 'exactly' || type === 'atLeast') return twipsToPt(line);
	if (type === 'multiple') return line / 240;
	return line / 240;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ParagraphPropertiesDialog({ editor, onClose }: ParagraphPropertiesDialogProps) {
	// Indent values in mm
	const [indentLeft, setIndentLeft] = useState(0);
	const [indentRight, setIndentRight] = useState(0);
	const [specialType, setSpecialType] = useState<'none' | 'firstLine' | 'hanging'>('none');
	const [specialValue, setSpecialValue] = useState(0);

	// Spacing in pt
	const [spacingBefore, setSpacingBefore] = useState(0);
	const [spacingAfter, setSpacingAfter] = useState(0);
	const [lineSpacingType, setLineSpacingType] = useState<LineSpacingType>('single');
	const [lineSpacingValue, setLineSpacingValue] = useState(1);

	// Page break options
	const [pageBreakBefore, setPageBreakBefore] = useState(false);
	const [keepNext, setKeepNext] = useState(false);
	const [keepLines, setKeepLines] = useState(false);
	const [widowControl, setWidowOrphan] = useState(true);

	// Load current paragraph properties
	useEffect(() => {
		try {
			const sel = editor.getSelection();
			if (!sel) return;
			const doc = editor.getDocument();
			const paragraphs = getParagraphsInRange(doc, sel);
			if (paragraphs.length === 0) return;
			const props = paragraphs[0].node.properties;

			// Indents
			const indent = props.indent;
			if (indent?.left) setIndentLeft(twipsToMm(indent.left));
			if (indent?.right) setIndentRight(twipsToMm(indent.right));
			if (indent?.firstLine) {
				setSpecialType('firstLine');
				setSpecialValue(twipsToMm(indent.firstLine));
			} else if (indent?.hanging) {
				setSpecialType('hanging');
				setSpecialValue(twipsToMm(indent.hanging));
			}

			// Spacing
			const spacing = props.spacing;
			if (spacing?.before) setSpacingBefore(twipsToPt(spacing.before));
			if (spacing?.after) setSpacingAfter(twipsToPt(spacing.after));
			setLineSpacingType(getLineSpacingType(spacing));
			setLineSpacingValue(getLineSpacingValue(spacing));

			// Page break options
			if (props.pageBreakBefore) setPageBreakBefore(true);
			if (props.keepNext) setKeepNext(true);
			if (props.keepLines) setKeepLines(true);
			if (props.widowControl !== false) setWidowOrphan(true);
		} catch {
			/* ignore */
		}
	}, [editor]);

	const handleLineSpacingTypeChange = useCallback((type: LineSpacingType) => {
		setLineSpacingType(type);
		switch (type) {
			case 'single': setLineSpacingValue(1); break;
			case '1.5': setLineSpacingValue(1.5); break;
			case 'double': setLineSpacingValue(2); break;
			case 'exactly': setLineSpacingValue(12); break;
			case 'atLeast': setLineSpacingValue(12); break;
			case 'multiple': setLineSpacingValue(1); break;
		}
	}, []);

	const handleApply = useCallback(() => {
		const sel = editor.getSelection();
		if (!sel) { onClose(); return; }
		const doc = editor.getDocument();
		const paragraphs = getParagraphsInRange(doc, sel);

		editor.batch(() => {
			for (const para of paragraphs) {
				const oldProps = para.node.properties;

				// Build indent
				let indent: JPParagraph['properties']['indent'] = {
					left: mmToTwips(indentLeft),
					right: mmToTwips(indentRight),
				};
				if (specialType === 'firstLine') {
					indent = { ...indent, firstLine: mmToTwips(specialValue), hanging: undefined };
				} else if (specialType === 'hanging') {
					indent = { ...indent, hanging: mmToTwips(specialValue), firstLine: undefined };
				}

				// Build spacing
				let lineRule: 'auto' | 'exact' | 'atLeast' = 'auto';
				let line = 240;
				switch (lineSpacingType) {
					case 'single': line = 240; break;
					case '1.5': line = 360; break;
					case 'double': line = 480; break;
					case 'exactly':
						lineRule = 'exact';
						line = ptToTwips(lineSpacingValue);
						break;
					case 'atLeast':
						lineRule = 'atLeast';
						line = ptToTwips(lineSpacingValue);
						break;
					case 'multiple':
						line = Math.round(lineSpacingValue * 240);
						break;
				}

				const spacing: JPParagraph['properties']['spacing'] = {
					before: ptToTwips(spacingBefore),
					after: ptToTwips(spacingAfter),
					line,
					lineRule,
				};

				const newProps: Partial<JPParagraph['properties']> = {
					indent,
					spacing,
					pageBreakBefore: pageBreakBefore || undefined,
					keepNext: keepNext || undefined,
					keepLines: keepLines || undefined,
					widowControl,
				};

				editor.apply({
					type: 'set_properties',
					path: para.path,
					properties: newProps,
					oldProperties: {
						indent: oldProps.indent,
						spacing: oldProps.spacing,
						pageBreakBefore: oldProps.pageBreakBefore,
						keepNext: oldProps.keepNext,
						keepLines: oldProps.keepLines,
						widowControl: oldProps.widowControl,
					},
				});
			}
		});

		onClose();
	}, [
		editor, onClose, indentLeft, indentRight, specialType, specialValue,
		spacingBefore, spacingAfter, lineSpacingType, lineSpacingValue,
		pageBreakBefore, keepNext, keepLines, widowControl,
	]);

	return (
		<div
			role="presentation"
			style={overlayStyle}
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
			onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
		>
			<div role="dialog" aria-label="Propiedades de párrafo" style={dialogStyle}>
				{/* Header */}
				<div style={headerStyle}>
					<h2 style={headerTitleStyle}>Párrafo</h2>
					<button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Cerrar">
						×
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{/* Indents */}
					<div style={{ ...sectionTitleStyle, marginTop: 0 }}>Sangrías</div>
					<div style={rowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>Izquierda (mm)</label>
							<input
								type="number"
								style={inputStyle}
								value={indentLeft}
								min={0}
								step={1}
								onChange={(e) => setIndentLeft(Number(e.target.value) || 0)}
							/>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>Derecha (mm)</label>
							<input
								type="number"
								style={inputStyle}
								value={indentRight}
								min={0}
								step={1}
								onChange={(e) => setIndentRight(Number(e.target.value) || 0)}
							/>
						</div>
					</div>
					<div style={rowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>Especial</label>
							<select
								style={selectStyle}
								value={specialType}
								onChange={(e) => setSpecialType(e.target.value as 'none' | 'firstLine' | 'hanging')}
							>
								<option value="none">(ninguno)</option>
								<option value="firstLine">Primera línea</option>
								<option value="hanging">Francesa</option>
							</select>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>Valor (mm)</label>
							<input
								type="number"
								style={inputStyle}
								value={specialValue}
								min={0}
								step={1}
								disabled={specialType === 'none'}
								onChange={(e) => setSpecialValue(Number(e.target.value) || 0)}
							/>
						</div>
					</div>

					{/* Spacing */}
					<div style={sectionTitleStyle}>Espaciado</div>
					<div style={rowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>Antes (pt)</label>
							<input
								type="number"
								style={inputStyle}
								value={spacingBefore}
								min={0}
								step={1}
								onChange={(e) => setSpacingBefore(Number(e.target.value) || 0)}
							/>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>Después (pt)</label>
							<input
								type="number"
								style={inputStyle}
								value={spacingAfter}
								min={0}
								step={1}
								onChange={(e) => setSpacingAfter(Number(e.target.value) || 0)}
							/>
						</div>
					</div>
					<div style={rowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>Interlineado</label>
							<select
								style={selectStyle}
								value={lineSpacingType}
								onChange={(e) => handleLineSpacingTypeChange(e.target.value as LineSpacingType)}
							>
								<option value="single">Sencillo</option>
								<option value="1.5">1.5 líneas</option>
								<option value="double">Doble</option>
								<option value="exactly">Exacto</option>
								<option value="atLeast">Mínimo</option>
								<option value="multiple">Múltiple</option>
							</select>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								{lineSpacingType === 'exactly' || lineSpacingType === 'atLeast' ? 'Valor (pt)' : 'Valor'}
							</label>
							<input
								type="number"
								style={inputStyle}
								value={lineSpacingValue}
								min={0.5}
								step={lineSpacingType === 'exactly' || lineSpacingType === 'atLeast' ? 1 : 0.5}
								disabled={lineSpacingType === 'single' || lineSpacingType === '1.5' || lineSpacingType === 'double'}
								onChange={(e) => setLineSpacingValue(Number(e.target.value) || 1)}
							/>
						</div>
					</div>

					{/* Line and page breaks */}
					<div style={sectionTitleStyle}>Saltos de línea y de página</div>
					<label style={checkboxRow}>
						<input type="checkbox" checked={pageBreakBefore} onChange={(e) => setPageBreakBefore(e.target.checked)} />
						Salto de página anterior
					</label>
					<label style={checkboxRow}>
						<input type="checkbox" checked={keepNext} onChange={(e) => setKeepNext(e.target.checked)} />
						Conservar con el siguiente
					</label>
					<label style={checkboxRow}>
						<input type="checkbox" checked={keepLines} onChange={(e) => setKeepLines(e.target.checked)} />
						Conservar líneas juntas
					</label>
					<label style={checkboxRow}>
						<input type="checkbox" checked={widowControl} onChange={(e) => setWidowOrphan(e.target.checked)} />
						Control de viudas y huérfanas
					</label>
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
