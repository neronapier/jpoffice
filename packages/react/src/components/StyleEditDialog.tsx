'use client';

/**
 * StyleEditDialog provides a modal for creating or editing document styles.
 * Supports name, type, basedOn, font properties, and alignment.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { StyleInfo, StyleProperties } from '@jpoffice/engine';
import { useCallback, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

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

const toggleRowStyle: CSSProperties = {
	display: 'flex',
	gap: 8,
	marginBottom: 12,
};

const toggleBtnStyle: CSSProperties = {
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 600,
	padding: '6px 14px',
	borderRadius: 4,
	minWidth: 36,
};

const toggleBtnActiveStyle: CSSProperties = {
	...toggleBtnStyle,
	background: '#e8f0fe',
	borderColor: '#1a73e8',
	color: '#1a73e8',
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

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface StyleEditDialogProps {
	editor: JPEditor;
	/** When editing an existing style, pass its info. Null = create new. */
	editStyle: StyleInfo | null;
	/** All styles for basedOn dropdown */
	allStyles: readonly StyleInfo[];
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StyleEditDialog({
	editor,
	editStyle,
	allStyles,
	onClose,
}: StyleEditDialogProps): ReactElement {
	const isEditing = editStyle !== null;

	// Form state
	const [name, setName] = useState(editStyle?.name ?? '');
	const [type, setType] = useState<'paragraph' | 'character'>(editStyle?.type ?? 'paragraph');
	const [basedOn, setBasedOn] = useState(editStyle?.basedOn ?? '');
	const [fontFamily, setFontFamily] = useState(editStyle?.properties.fontFamily ?? '');
	const [fontSize, setFontSize] = useState(editStyle?.properties.fontSize ?? 0);
	const [bold, setBold] = useState(editStyle?.properties.bold ?? false);
	const [italic, setItalic] = useState(editStyle?.properties.italic ?? false);
	const [underline, setUnderline] = useState(
		editStyle?.properties.underline ? editStyle.properties.underline !== 'none' : false,
	);
	const [color, setColor] = useState(editStyle?.properties.color ?? '');
	const [alignment, setAlignment] = useState(editStyle?.properties.alignment ?? '');

	const handleApply = useCallback(() => {
		if (!name.trim()) return;

		const properties: Partial<StyleProperties> = {
			...(fontFamily ? { fontFamily } : {}),
			...(fontSize > 0 ? { fontSize } : {}),
			bold,
			italic,
			underline: underline ? 'single' : 'none',
			...(color ? { color } : {}),
			...(alignment ? { alignment } : {}),
		};

		if (isEditing) {
			editor.executeCommand('styles.modify', {
				styleId: editStyle.id,
				properties,
			});
		} else {
			editor.executeCommand('styles.create', {
				name: name.trim(),
				type,
				basedOn: basedOn || undefined,
				properties,
			});
		}

		onClose();
	}, [
		editor,
		isEditing,
		editStyle,
		name,
		type,
		basedOn,
		fontFamily,
		fontSize,
		bold,
		italic,
		underline,
		color,
		alignment,
		onClose,
	]);

	const handleOverlayClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) onClose();
		},
		[onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		},
		[onClose],
	);

	// Filter available basedOn styles by same type
	const baseOptions = allStyles.filter((s) => s.type === type);

	return (
		<div
			style={overlayStyle}
			onClick={handleOverlayClick}
			onKeyDown={handleKeyDown}
			role="presentation"
		>
			<div
				style={dialogStyle}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="presentation"
			>
				{/* Header */}
				<div style={headerStyle}>
					<h3 style={headerTitleStyle}>{isEditing ? 'Edit Style' : 'New Style'}</h3>
					<button type="button" style={closeBtnStyle} onClick={onClose}>
						&times;
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{/* General */}
					<div style={{ ...sectionTitleStyle, marginTop: 0 }}>General</div>

					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Name
								<input
									style={inputStyle}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Style name"
									disabled={isEditing && editStyle.builtIn}
								/>
							</label>
						</div>
						{!isEditing && (
							<div style={fieldStyle}>
								<label style={labelStyle}>
									Type
									<select
										style={selectStyle}
										value={type}
										onChange={(e) => setType(e.target.value as 'paragraph' | 'character')}
									>
										<option value="paragraph">Paragraph</option>
										<option value="character">Character</option>
									</select>
								</label>
							</div>
						)}
					</div>

					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Based on
								<select
									style={selectStyle}
									value={basedOn}
									onChange={(e) => setBasedOn(e.target.value)}
								>
									<option value="">None</option>
									{baseOptions.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
							</label>
						</div>
					</div>

					{/* Font */}
					<div style={sectionTitleStyle}>Font</div>

					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Font Family
								<input
									style={inputStyle}
									value={fontFamily}
									onChange={(e) => setFontFamily(e.target.value)}
									placeholder="e.g. Arial"
								/>
							</label>
						</div>
						<div style={{ ...fieldStyle, maxWidth: 100 }}>
							<label style={labelStyle}>
								Size (hp)
								<input
									style={inputStyle}
									type="number"
									min={0}
									step={2}
									value={fontSize || ''}
									onChange={(e) => setFontSize(Number(e.target.value))}
									placeholder="22"
								/>
							</label>
						</div>
					</div>

					<div style={toggleRowStyle}>
						<button
							type="button"
							style={bold ? toggleBtnActiveStyle : toggleBtnStyle}
							onClick={() => setBold(!bold)}
							title="Bold"
						>
							B
						</button>
						<button
							type="button"
							style={italic ? toggleBtnActiveStyle : toggleBtnStyle}
							onClick={() => setItalic(!italic)}
							title="Italic"
						>
							<i>I</i>
						</button>
						<button
							type="button"
							style={underline ? toggleBtnActiveStyle : toggleBtnStyle}
							onClick={() => setUnderline(!underline)}
							title="Underline"
						>
							<u>U</u>
						</button>
					</div>

					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Color
								<input
									style={{ ...inputStyle, maxWidth: 120 }}
									type="color"
									value={color || '#000000'}
									onChange={(e) => setColor(e.target.value)}
								/>
							</label>
						</div>
					</div>

					{/* Paragraph options (only for paragraph styles) */}
					{type === 'paragraph' && (
						<>
							<div style={sectionTitleStyle}>Paragraph</div>
							<div style={fieldRowStyle}>
								<div style={fieldStyle}>
									<label style={labelStyle}>
										Alignment
										<select
											style={selectStyle}
											value={alignment}
											onChange={(e) => setAlignment(e.target.value)}
										>
											<option value="">Default</option>
											<option value="left">Left</option>
											<option value="center">Center</option>
											<option value="right">Right</option>
											<option value="justify">Justify</option>
										</select>
									</label>
								</div>
							</div>
						</>
					)}
				</div>

				{/* Footer */}
				<div style={footerStyle}>
					<button type="button" style={cancelBtnStyle} onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						style={{
							...applyBtnStyle,
							opacity: name.trim() ? 1 : 0.5,
						}}
						onClick={handleApply}
						disabled={!name.trim()}
					>
						{isEditing ? 'Save' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	);
}
