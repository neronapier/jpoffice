'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const overlayStyle: CSSProperties = {
	position: 'fixed',
	inset: 0,
	backgroundColor: 'rgba(0, 0, 0, 0.3)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 2000,
};

const dialogStyle: CSSProperties = {
	backgroundColor: '#fff',
	borderRadius: 8,
	padding: '24px',
	width: 400,
	boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
	fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
};

const titleStyle: CSSProperties = {
	fontSize: 16,
	fontWeight: 500,
	color: '#202124',
	marginBottom: 20,
};

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: 12,
	color: '#5f6368',
	marginBottom: 4,
	fontWeight: 500,
};

const inputStyle: CSSProperties = {
	width: '100%',
	padding: '8px 12px',
	fontSize: 14,
	border: '1px solid #dadce0',
	borderRadius: 4,
	outline: 'none',
	boxSizing: 'border-box',
	color: '#202124',
	marginBottom: 16,
};

const buttonRowStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'flex-end',
	gap: 8,
	marginTop: 8,
};

const btnBaseStyle: CSSProperties = {
	padding: '8px 24px',
	fontSize: 14,
	fontWeight: 500,
	borderRadius: 4,
	cursor: 'pointer',
	border: 'none',
};

const cancelBtnStyle: CSSProperties = {
	...btnBaseStyle,
	backgroundColor: 'transparent',
	color: '#1a73e8',
};

const applyBtnStyle: CSSProperties = {
	...btnBaseStyle,
	backgroundColor: '#1a73e8',
	color: '#fff',
};

const applyBtnDisabledStyle: CSSProperties = {
	...applyBtnStyle,
	backgroundColor: '#dadce0',
	color: '#80868b',
	cursor: 'default',
};

export interface LinkDialogProps {
	open: boolean;
	initialText?: string;
	initialUrl?: string;
	onApply: (url: string, text: string) => void;
	onCancel: () => void;
}

export function LinkDialog({ open, initialText, initialUrl, onApply, onCancel }: LinkDialogProps) {
	const [url, setUrl] = useState(initialUrl ?? '');
	const [text, setText] = useState(initialText ?? '');
	const urlRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setUrl(initialUrl ?? '');
			setText(initialText ?? '');
			setTimeout(() => urlRef.current?.focus(), 0);
		}
	}, [open, initialText, initialUrl]);

	const canApply = url.trim().length > 0;

	const handleApply = useCallback(() => {
		if (canApply) {
			onApply(url.trim(), text.trim() || url.trim());
		}
	}, [url, text, canApply, onApply]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && canApply) {
				e.preventDefault();
				handleApply();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				onCancel();
			}
		},
		[canApply, handleApply, onCancel],
	);

	if (!open) return null;

	return (
		<div
			style={overlayStyle}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) {
					e.preventDefault();
					onCancel();
				}
			}}
		>
			<div style={dialogStyle} onKeyDown={handleKeyDown}>
				<div style={titleStyle}>Insert link</div>

				<label htmlFor="link-dialog-text" style={labelStyle}>
					Text to display
				</label>
				<input
					id="link-dialog-text"
					type="text"
					style={inputStyle}
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="Text"
				/>

				<label htmlFor="link-dialog-url" style={labelStyle}>
					Link
				</label>
				<input
					id="link-dialog-url"
					ref={urlRef}
					type="text"
					style={inputStyle}
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="Paste or type a link"
				/>

				<div style={buttonRowStyle}>
					<button type="button" style={cancelBtnStyle} onClick={onCancel}>
						Cancel
					</button>
					<button
						type="button"
						style={canApply ? applyBtnStyle : applyBtnDisabledStyle}
						disabled={!canApply}
						onClick={handleApply}
					>
						Apply
					</button>
				</div>
			</div>
		</div>
	);
}
