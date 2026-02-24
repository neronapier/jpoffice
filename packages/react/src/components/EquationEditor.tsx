'use client';

/**
 * EquationEditor provides a modal dialog for inserting or editing
 * LaTeX math equations. Includes a text area for LaTeX input,
 * a symbol palette organized by category, and display mode toggle.
 */

import { LATEX_SYMBOL_GROUPS } from '@jpoffice/engine';
import type { LatexSymbol, LatexSymbolGroup } from '@jpoffice/engine';
import { useCallback, useState } from 'react';
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
	width: 520,
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

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: 13,
	fontWeight: 500,
	color: '#3c4043',
	marginBottom: 6,
};

const textareaStyle: CSSProperties = {
	width: '100%',
	minHeight: 80,
	border: '1px solid #dadce0',
	borderRadius: 4,
	padding: '10px 12px',
	fontSize: 14,
	fontFamily: "'Courier New', Courier, monospace",
	outline: 'none',
	boxSizing: 'border-box',
	resize: 'vertical',
	lineHeight: 1.5,
};

const displayRowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 16,
	marginTop: 12,
	marginBottom: 16,
};

const radioLabelStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 6,
	fontSize: 13,
	color: '#3c4043',
	cursor: 'pointer',
};

const symbolSectionStyle: CSSProperties = {
	marginTop: 8,
};

const symbolGroupHeaderStyle: CSSProperties = {
	fontSize: 12,
	fontWeight: 600,
	color: '#5f6368',
	marginBottom: 6,
	marginTop: 12,
};

const symbolGridStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: 2,
};

const symbolBtnStyle: CSSProperties = {
	width: 34,
	height: 34,
	border: '1px solid #e0e0e0',
	background: '#fff',
	borderRadius: 4,
	cursor: 'pointer',
	fontSize: 16,
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	color: '#202124',
	padding: 0,
};

const previewStyle: CSSProperties = {
	marginTop: 12,
	padding: '12px 16px',
	background: '#f8f9fa',
	borderRadius: 4,
	border: '1px solid #e0e0e0',
	fontFamily: "'Courier New', Courier, monospace",
	fontSize: 14,
	color: '#3c4043',
	lineHeight: 1.5,
	minHeight: 40,
	wordBreak: 'break-all',
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

const insertBtnStyle: CSSProperties = {
	border: 'none',
	background: '#1a73e8',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 500,
	color: '#fff',
	padding: '8px 20px',
	borderRadius: 4,
};

const insertBtnDisabledStyle: CSSProperties = {
	...insertBtnStyle,
	background: '#dadce0',
	color: '#80868b',
	cursor: 'default',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface EquationEditorProps {
	onInsert: (latex: string, display: 'inline' | 'block') => void;
	onClose: () => void;
	/** Optional initial LaTeX string for editing an existing equation. */
	initialLatex?: string;
	/** Optional initial display mode. */
	initialDisplay?: 'inline' | 'block';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EquationEditor({
	onInsert,
	onClose,
	initialLatex = '',
	initialDisplay = 'inline',
}: EquationEditorProps) {
	const [latex, setLatex] = useState(initialLatex);
	const [display, setDisplay] = useState<'inline' | 'block'>(initialDisplay);

	const handleInsert = useCallback(() => {
		const trimmed = latex.trim();
		if (!trimmed) return;
		onInsert(trimmed, display);
	}, [latex, display, onInsert]);

	const handleSymbolClick = useCallback((symbolLatex: string) => {
		setLatex((prev) => {
			// Insert at end (with a space if needed)
			const prefix = prev && !prev.endsWith(' ') ? `${prev} ` : prev;
			return `${prefix}${symbolLatex}`;
		});
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				handleInsert();
			}
		},
		[onClose, handleInsert],
	);

	const isValid = latex.trim().length > 0;

	return (
		<div style={overlayStyle} onClick={onClose} onKeyDown={handleKeyDown}>
			<div
				style={dialogStyle}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div style={headerStyle}>
					<h3 style={headerTitleStyle}>Insert Equation</h3>
					<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
						&times;
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{/* LaTeX input */}
					<label style={labelStyle}>
						LaTeX Expression
						<textarea
							style={textareaStyle}
							value={latex}
							onChange={(e) => setLatex(e.target.value)}
							placeholder="e.g., \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
						/>
					</label>

					{/* Display mode */}
					<div style={displayRowStyle}>
						<span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500 }}>Display:</span>
						<label style={radioLabelStyle}>
							<input
								type="radio"
								name="display"
								value="inline"
								checked={display === 'inline'}
								onChange={() => setDisplay('inline')}
							/>
							Inline
						</label>
						<label style={radioLabelStyle}>
							<input
								type="radio"
								name="display"
								value="block"
								checked={display === 'block'}
								onChange={() => setDisplay('block')}
							/>
							Block
						</label>
					</div>

					{/* Preview */}
					{latex.trim() && (
						<>
							<span style={labelStyle}>Preview (raw LaTeX)</span>
							<div style={previewStyle}>{latex}</div>
						</>
					)}

					{/* Symbol palette */}
					<div style={symbolSectionStyle}>
						<span style={labelStyle}>Symbol Palette</span>
						{LATEX_SYMBOL_GROUPS.map((group: LatexSymbolGroup) => (
							<div key={group.name}>
								<div style={symbolGroupHeaderStyle}>{group.name}</div>
								<div style={symbolGridStyle}>
									{group.symbols.map((sym: LatexSymbol) => (
										<button
											key={sym.latex}
											type="button"
											style={symbolBtnStyle}
											title={sym.latex}
											onClick={() => handleSymbolClick(sym.latex)}
											onMouseEnter={(e) => {
												(e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe';
											}}
											onMouseLeave={(e) => {
												(e.currentTarget as HTMLButtonElement).style.background = '#fff';
											}}
										>
											{sym.label}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Footer */}
				<div style={footerStyle}>
					<button type="button" style={cancelBtnStyle} onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						style={isValid ? insertBtnStyle : insertBtnDisabledStyle}
						onClick={handleInsert}
						disabled={!isValid}
					>
						{initialLatex ? 'Update' : 'Insert'}
					</button>
				</div>
			</div>
		</div>
	);
}
