'use client';

import type { CSSProperties } from 'react';
import { useCommand } from '../hooks/useCommand';
import { useEditor } from '../hooks/useEditor';

const btnStyle: CSSProperties = {
	padding: '4px 10px',
	border: '1px solid #ccc',
	borderRadius: 3,
	backgroundColor: '#fff',
	cursor: 'pointer',
	fontSize: 14,
	lineHeight: '20px',
	minWidth: 32,
};

const separatorStyle: CSSProperties = {
	width: 1,
	height: 24,
	backgroundColor: '#ddd',
	margin: '0 4px',
};

function ToolbarButton({
	label,
	commandId,
	fontWeight,
	fontStyle,
	textDecoration,
}: {
	label: string;
	commandId: string;
	fontWeight?: string;
	fontStyle?: string;
	textDecoration?: string;
}) {
	const { execute } = useCommand(commandId);
	return (
		<button
			type="button"
			style={{ ...btnStyle, fontWeight, fontStyle, textDecoration }}
			onMouseDown={(e) => {
				e.preventDefault(); // Don't steal focus from textarea
				execute();
			}}
			title={label}
		>
			{label}
		</button>
	);
}

export function Toolbar() {
	const editor = useEditor();
	const { execute: undo } = useCommand('history.undo');
	const { execute: redo } = useCommand('history.redo');

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 2,
				padding: '6px 12px',
				borderBottom: '1px solid #ddd',
				backgroundColor: '#fafafa',
				flexShrink: 0,
			}}
		>
			<ToolbarButton label="B" commandId="format.bold" fontWeight="bold" />
			<ToolbarButton label="I" commandId="format.italic" fontStyle="italic" />
			<ToolbarButton label="U" commandId="format.underline" textDecoration="underline" />
			<div style={separatorStyle} />
			<button
				type="button"
				style={btnStyle}
				onMouseDown={(e) => {
					e.preventDefault();
					undo();
				}}
				disabled={!editor.canUndo()}
				title="Undo (Ctrl+Z)"
			>
				↩
			</button>
			<button
				type="button"
				style={btnStyle}
				onMouseDown={(e) => {
					e.preventDefault();
					redo();
				}}
				disabled={!editor.canRedo()}
				title="Redo (Ctrl+Y)"
			>
				↪
			</button>
		</div>
	);
}
