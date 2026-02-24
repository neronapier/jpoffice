'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';

const MAX_ROWS = 10;
const MAX_COLS = 10;
const CELL_SIZE = 22;
const GAP = 2;

const containerStyle: CSSProperties = {
	position: 'absolute',
	top: '100%',
	left: 0,
	zIndex: 1000,
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	padding: 8,
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
};

const gridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(${MAX_COLS}, ${CELL_SIZE}px)`,
	gap: GAP,
};

const labelStyle: CSSProperties = {
	textAlign: 'center',
	fontSize: 12,
	color: '#5f6368',
	marginTop: 6,
	fontFamily: "'Google Sans Text', Roboto, sans-serif",
};

export interface TableSizePickerProps {
	onSelect: (rows: number, cols: number) => void;
	onClose: () => void;
}

export function TableSizePicker({ onSelect, onClose }: TableSizePickerProps) {
	const [hoveredRow, setHoveredRow] = useState(0);
	const [hoveredCol, setHoveredCol] = useState(0);

	const handleClick = useCallback(() => {
		if (hoveredRow > 0 && hoveredCol > 0) {
			onSelect(hoveredRow, hoveredCol);
			onClose();
		}
	}, [hoveredRow, hoveredCol, onSelect, onClose]);

	const cells: { r: number; c: number }[] = [];
	for (let r = 1; r <= MAX_ROWS; r++) {
		for (let c = 1; c <= MAX_COLS; c++) {
			cells.push({ r, c });
		}
	}

	return (
		<>
			{/* Backdrop to close on click-outside */}
			<div
				style={{ position: 'fixed', inset: 0, zIndex: 999 }}
				onMouseDown={(e) => {
					e.preventDefault();
					onClose();
				}}
			/>
			<div style={containerStyle} aria-label="Table size picker">
				<div
					style={gridStyle}
					onMouseLeave={() => {
						setHoveredRow(0);
						setHoveredCol(0);
					}}
				>
					{cells.map(({ r, c }) => {
						const highlighted = r <= hoveredRow && c <= hoveredCol;
						return (
							<div
								key={`${r}-${c}`}
								style={{
									width: CELL_SIZE,
									height: CELL_SIZE,
									backgroundColor: highlighted ? '#1a73e8' : '#f1f3f4',
									border: highlighted ? '1px solid #1557b0' : '1px solid #dadce0',
									borderRadius: 2,
									cursor: 'pointer',
									boxSizing: 'border-box',
								}}
								onMouseEnter={() => {
									setHoveredRow(r);
									setHoveredCol(c);
								}}
								onMouseDown={(e) => {
									e.preventDefault();
									handleClick();
								}}
							/>
						);
					})}
				</div>
				<div style={labelStyle}>
					{hoveredRow > 0 && hoveredCol > 0
						? `${hoveredCol} \u00d7 ${hoveredRow}`
						: 'Insert table'}
				</div>
			</div>
		</>
	);
}
