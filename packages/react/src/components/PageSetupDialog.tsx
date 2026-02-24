'use client';

/**
 * PageSetupDialog provides a modal for configuring page layout properties:
 * page size presets, custom dimensions, margins, and orientation.
 * Changes are applied to the current section via the PageSetupPlugin.
 */

import type { JPEditor } from '@jpoffice/engine';
import { PAGE_PRESETS, type PageSetupPlugin, mmToTwips, twipsToMm } from '@jpoffice/engine';
import type { PagePresetName } from '@jpoffice/engine';
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

const orientationRowStyle: CSSProperties = {
	display: 'flex',
	gap: 16,
	marginBottom: 12,
};

const radioLabelStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 6,
	fontSize: 13,
	color: '#3c4043',
	cursor: 'pointer',
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Round mm to one decimal place for display. */
function roundMm(val: number): number {
	return Math.round(val * 10) / 10;
}

const PRESET_KEYS = Object.keys(PAGE_PRESETS) as PagePresetName[];

function findPresetForSize(width: number, height: number): PagePresetName | 'custom' {
	for (const key of PRESET_KEYS) {
		const p = PAGE_PRESETS[key];
		if ((p.width === width && p.height === height) || (p.width === height && p.height === width)) {
			return key;
		}
	}
	return 'custom';
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PageSetupDialogProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PageSetupDialog({ editor, onClose }: PageSetupDialogProps) {
	const plugin = editor.getPlugin('jpoffice.pageSetup') as PageSetupPlugin | undefined;

	// Get current page setup
	const currentSetup = plugin?.getCurrentPageSetup(editor) ?? null;

	// Local form state (in mm for display)
	const [preset, setPreset] = useState<PagePresetName | 'custom'>(() => {
		if (!currentSetup) return 'a4';
		return findPresetForSize(currentSetup.pageSize.width, currentSetup.pageSize.height);
	});

	const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
		currentSetup?.orientation ?? 'portrait',
	);

	const [widthMm, setWidthMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.pageSize.width ?? 11906)),
	);
	const [heightMm, setHeightMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.pageSize.height ?? 16838)),
	);

	const [marginTopMm, setMarginTopMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.margins.top ?? 1440)),
	);
	const [marginBottomMm, setMarginBottomMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.margins.bottom ?? 1440)),
	);
	const [marginLeftMm, setMarginLeftMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.margins.left ?? 1440)),
	);
	const [marginRightMm, setMarginRightMm] = useState(() =>
		roundMm(twipsToMm(currentSetup?.margins.right ?? 1440)),
	);

	// When preset changes, update dimensions
	const handlePresetChange = useCallback(
		(key: string) => {
			if (key === 'custom') {
				setPreset('custom');
				return;
			}
			const presetKey = key as PagePresetName;
			const p = PAGE_PRESETS[presetKey];
			if (!p) return;
			setPreset(presetKey);
			if (orientation === 'landscape') {
				setWidthMm(roundMm(twipsToMm(p.height)));
				setHeightMm(roundMm(twipsToMm(p.width)));
			} else {
				setWidthMm(roundMm(twipsToMm(p.width)));
				setHeightMm(roundMm(twipsToMm(p.height)));
			}
		},
		[orientation],
	);

	// When orientation changes, swap width/height
	const handleOrientationChange = useCallback(
		(newOrientation: 'portrait' | 'landscape') => {
			if (newOrientation === orientation) return;
			setOrientation(newOrientation);
			setWidthMm(heightMm);
			setHeightMm(widthMm);
		},
		[orientation, widthMm, heightMm],
	);

	const handleApply = useCallback(() => {
		if (!editor) return;

		// Apply page size
		const widthTwips = Math.round(mmToTwips(widthMm));
		const heightTwips = Math.round(mmToTwips(heightMm));
		editor.executeCommand('pageSetup.setPageSize', {
			width: widthTwips,
			height: heightTwips,
		});

		// Apply orientation
		editor.executeCommand('pageSetup.setOrientation', { orientation });

		// Apply margins
		editor.executeCommand('pageSetup.setMargins', {
			top: Math.round(mmToTwips(marginTopMm)),
			bottom: Math.round(mmToTwips(marginBottomMm)),
			left: Math.round(mmToTwips(marginLeftMm)),
			right: Math.round(mmToTwips(marginRightMm)),
		});

		onClose();
	}, [
		editor,
		widthMm,
		heightMm,
		orientation,
		marginTopMm,
		marginBottomMm,
		marginLeftMm,
		marginRightMm,
		onClose,
	]);

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
					<h3 style={headerTitleStyle}>Page Setup</h3>
					<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
						&times;
					</button>
				</div>

				{/* Body */}
				<div style={bodyStyle}>
					{/* Page Size */}
					<div style={{ ...sectionTitleStyle, marginTop: 0 }}>Page Size</div>
					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Preset
								<select
									style={selectStyle}
									value={preset}
									onChange={(e) => handlePresetChange(e.target.value)}
								>
									{PRESET_KEYS.map((key) => (
										<option key={key} value={key}>
											{PAGE_PRESETS[key].name}
										</option>
									))}
									<option value="custom">Custom</option>
								</select>
							</label>
						</div>
					</div>
					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Width (mm)
								<input
									type="number"
									style={inputStyle}
									value={widthMm}
									onChange={(e) => {
										setWidthMm(Number(e.target.value));
										setPreset('custom');
									}}
									min={50}
									max={600}
									step={0.1}
								/>
							</label>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Height (mm)
								<input
									type="number"
									style={inputStyle}
									value={heightMm}
									onChange={(e) => {
										setHeightMm(Number(e.target.value));
										setPreset('custom');
									}}
									min={50}
									max={600}
									step={0.1}
								/>
							</label>
						</div>
					</div>

					{/* Orientation */}
					<div style={sectionTitleStyle}>Orientation</div>
					<div style={orientationRowStyle}>
						<label style={radioLabelStyle}>
							<input
								type="radio"
								name="orientation"
								value="portrait"
								checked={orientation === 'portrait'}
								onChange={() => handleOrientationChange('portrait')}
							/>
							Portrait
						</label>
						<label style={radioLabelStyle}>
							<input
								type="radio"
								name="orientation"
								value="landscape"
								checked={orientation === 'landscape'}
								onChange={() => handleOrientationChange('landscape')}
							/>
							Landscape
						</label>
					</div>

					{/* Margins */}
					<div style={sectionTitleStyle}>Margins (mm)</div>
					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Top
								<input
									type="number"
									style={inputStyle}
									value={marginTopMm}
									onChange={(e) => setMarginTopMm(Number(e.target.value))}
									min={0}
									max={200}
									step={0.1}
								/>
							</label>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Bottom
								<input
									type="number"
									style={inputStyle}
									value={marginBottomMm}
									onChange={(e) => setMarginBottomMm(Number(e.target.value))}
									min={0}
									max={200}
									step={0.1}
								/>
							</label>
						</div>
					</div>
					<div style={fieldRowStyle}>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Left
								<input
									type="number"
									style={inputStyle}
									value={marginLeftMm}
									onChange={(e) => setMarginLeftMm(Number(e.target.value))}
									min={0}
									max={200}
									step={0.1}
								/>
							</label>
						</div>
						<div style={fieldStyle}>
							<label style={labelStyle}>
								Right
								<input
									type="number"
									style={inputStyle}
									value={marginRightMm}
									onChange={(e) => setMarginRightMm(Number(e.target.value))}
									min={0}
									max={200}
									step={0.1}
								/>
							</label>
						</div>
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
