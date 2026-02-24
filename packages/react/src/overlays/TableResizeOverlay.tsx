'use client';

import type { JPEditor } from '@jpoffice/engine';
import type { JPPath, JPTableGridCol } from '@jpoffice/model';
import { getNodeAtPath, pxToTwips } from '@jpoffice/model';
import type { CanvasRenderer, ColumnBorderResult, RowBorderResult } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';

type DragState =
	| { kind: 'idle' }
	| { kind: 'hover-col'; result: ColumnBorderResult }
	| { kind: 'hover-row'; result: RowBorderResult }
	| {
			kind: 'drag-col';
			result: ColumnBorderResult;
			startX: number;
			tablePath: JPPath;
			originalGrid: readonly JPTableGridCol[];
			currentCanvasX: number;
	  }
	| {
			kind: 'drag-row';
			result: RowBorderResult;
			startY: number;
			tablePath: JPPath;
			originalRowHeight: number;
			currentCanvasY: number;
	  };

export interface TableResizeOverlayProps {
	editor: JPEditor;
	rendererRef: MutableRefObject<CanvasRenderer | null>;
	zoom: number; // fraction, e.g. 1.0
}

const overlayStyle: CSSProperties = {
	position: 'absolute',
	inset: 0,
	pointerEvents: 'none',
	zIndex: 50,
};

const MIN_COL_WIDTH_TWIPS = 300; // ~20px minimum

export function TableResizeOverlay({ editor, rendererRef, zoom }: TableResizeOverlayProps) {
	const [dragState, setDragState] = useState<DragState>({ kind: 'idle' });
	const stateRef = useRef<DragState>(dragState);
	stateRef.current = dragState;

	const overlayRef = useRef<HTMLDivElement>(null);

	// Cursor management
	useEffect(() => {
		const container = overlayRef.current?.parentElement;
		if (!container) return;

		switch (dragState.kind) {
			case 'hover-col':
			case 'drag-col':
				container.style.cursor = 'col-resize';
				break;
			case 'hover-row':
			case 'drag-row':
				container.style.cursor = 'row-resize';
				break;
			default:
				container.style.cursor = '';
				break;
		}

		return () => {
			container.style.cursor = '';
		};
	}, [dragState.kind]);

	// Hover detection - listen on the parent container
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			const renderer = rendererRef.current;
			if (!renderer) return;
			const state = stateRef.current;

			// During drag, update position
			if (state.kind === 'drag-col') {
				setDragState({ ...state, currentCanvasX: e.clientX });
				return;
			}
			if (state.kind === 'drag-row') {
				setDragState({ ...state, currentCanvasY: e.clientY });
				return;
			}

			const canvas = renderer.getCanvas();
			if (!canvas) return;
			const canvasRect = canvas.getBoundingClientRect();
			const canvasX = e.clientX - canvasRect.left;
			const canvasY = e.clientY - canvasRect.top;

			// Check column borders first, then row borders
			const colResult = renderer.findColumnBorderAtCoords(canvasX, canvasY, 5);
			if (colResult) {
				setDragState({ kind: 'hover-col', result: colResult });
				return;
			}

			const rowResult = renderer.findRowBorderAtCoords(canvasX, canvasY, 5);
			if (rowResult) {
				setDragState({ kind: 'hover-row', result: rowResult });
				return;
			}

			if (state.kind !== 'idle') {
				setDragState({ kind: 'idle' });
			}
		},
		[rendererRef],
	);

	const handleMouseDown = useCallback(
		(e: MouseEvent) => {
			const state = stateRef.current;
			const renderer = rendererRef.current;
			if (!renderer) return;

			if (state.kind === 'hover-col') {
				e.preventDefault();
				e.stopPropagation();
				const { table } = state.result;
				const tableTyped = table as unknown as { path: JPPath };
				const doc = editor.getDocument();

				// Read grid from the model (not layout) for accurate twips values
				let grid: readonly JPTableGridCol[];
				try {
					const tableNode = getNodeAtPath(doc, tableTyped.path);
					grid = (tableNode as unknown as { grid: readonly JPTableGridCol[] }).grid;
				} catch {
					// Fallback: estimate from layout widths
					grid = table.rows[0]?.cells.map((cell) => ({
						width: Math.round(pxToTwips(cell.width)),
					})) ?? [];
				}

				setDragState({
					kind: 'drag-col',
					result: state.result,
					startX: e.clientX,
					tablePath: tableTyped.path,
					originalGrid: grid,
					currentCanvasX: e.clientX,
				});
			} else if (state.kind === 'hover-row') {
				e.preventDefault();
				e.stopPropagation();
				const { table, rowIndex } = state.result;
				const tableTyped = table as unknown as { path: JPPath };
				const originalRowHeight = table.rows[rowIndex]?.height ?? 0;

				setDragState({
					kind: 'drag-row',
					result: state.result,
					startY: e.clientY,
					tablePath: tableTyped.path,
					originalRowHeight: Math.round(pxToTwips(originalRowHeight)),
					currentCanvasY: e.clientY,
				});
			}
		},
		[editor, rendererRef],
	);

	const handleMouseUp = useCallback(() => {
		const state = stateRef.current;

		if (state.kind === 'drag-col') {
			const deltaClientX = state.currentCanvasX - state.startX;
			const deltaPx = deltaClientX / zoom;
			const deltaTwips = Math.round(pxToTwips(deltaPx));
			const { columnIndex } = state.result;
			const grid = state.originalGrid;

			const changes: Array<{ columnIndex: number; width: number }> = [];

			// Resize left column
			const oldLeft = grid[columnIndex]?.width ?? 2400;
			const newLeft = Math.max(oldLeft + deltaTwips, MIN_COL_WIDTH_TWIPS);

			changes.push({ columnIndex, width: newLeft });

			// If not the rightmost column, adjust adjacent column
			if (columnIndex < grid.length - 1) {
				const oldRight = grid[columnIndex + 1]?.width ?? 2400;
				const actualDelta = newLeft - oldLeft;
				const newRight = Math.max(oldRight - actualDelta, MIN_COL_WIDTH_TWIPS);
				changes.push({ columnIndex: columnIndex + 1, width: newRight });
			}

			try {
				editor.executeCommand('table.resizeColumnsAtPath', {
					tablePath: state.tablePath,
					changes,
				});
			} catch (err) {
				console.warn('[JPOffice] Column resize failed:', err);
			}

			setDragState({ kind: 'idle' });
		} else if (state.kind === 'drag-row') {
			const deltaClientY = state.currentCanvasY - state.startY;
			const deltaPx = deltaClientY / zoom;
			const deltaTwips = Math.round(pxToTwips(deltaPx));
			const newHeight = Math.max(state.originalRowHeight + deltaTwips, 200); // min ~13px

			try {
				editor.executeCommand('table.setRowHeightAtPath', {
					tablePath: state.tablePath,
					rowIndex: state.result.rowIndex,
					height: newHeight,
					rule: 'atLeast',
				});
			} catch (err) {
				console.warn('[JPOffice] Row resize failed:', err);
			}

			setDragState({ kind: 'idle' });
		}
	}, [editor, zoom]);

	// Attach mouse listeners to the container
	useEffect(() => {
		const container = overlayRef.current?.parentElement;
		if (!container) return;

		container.addEventListener('mousemove', handleMouseMove);
		container.addEventListener('mousedown', handleMouseDown, true);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			container.removeEventListener('mousemove', handleMouseMove);
			container.removeEventListener('mousedown', handleMouseDown, true);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [handleMouseMove, handleMouseDown, handleMouseUp]);

	// Render hover/drag indicators
	const renderIndicator = () => {
		const renderer = rendererRef.current;
		if (!renderer) return null;
		const canvas = renderer.getCanvas();
		if (!canvas) return null;

		if (dragState.kind === 'hover-col') {
			const { borderVirtualX, pageVirtualY, table } = dragState.result;
			const { cx, cy: lineTop } = renderer.virtualToCanvas(borderVirtualX, pageVirtualY + table.y);
			const { cy: lineBottom } = renderer.virtualToCanvas(
				borderVirtualX,
				pageVirtualY + table.y + table.height,
			);

			return (
				<div
					style={{
						position: 'absolute',
						left: cx - 1,
						top: lineTop,
						width: 2,
						height: lineBottom - lineTop,
						backgroundColor: 'rgba(26, 115, 232, 0.5)',
						pointerEvents: 'none',
					}}
				/>
			);
		}

		if (dragState.kind === 'hover-row') {
			const { borderVirtualY, pageVirtualX, table } = dragState.result;
			const { cx: lineLeft, cy } = renderer.virtualToCanvas(
				pageVirtualX + table.x,
				borderVirtualY,
			);
			const { cx: lineRight } = renderer.virtualToCanvas(
				pageVirtualX + table.x + table.width,
				borderVirtualY,
			);

			return (
				<div
					style={{
						position: 'absolute',
						left: lineLeft,
						top: cy - 1,
						width: lineRight - lineLeft,
						height: 2,
						backgroundColor: 'rgba(26, 115, 232, 0.5)',
						pointerEvents: 'none',
					}}
				/>
			);
		}

		if (dragState.kind === 'drag-col') {
			const { pageVirtualY, table } = dragState.result;
			const canvasRect = canvas.getBoundingClientRect();
			const dragX = dragState.currentCanvasX - canvasRect.left;
			const { cy: lineTop } = renderer.virtualToCanvas(0, pageVirtualY + table.y);
			const { cy: lineBottom } = renderer.virtualToCanvas(
				0,
				pageVirtualY + table.y + table.height,
			);

			return (
				<div
					style={{
						position: 'absolute',
						left: dragX - 1,
						top: lineTop,
						width: 2,
						height: lineBottom - lineTop,
						borderLeft: '2px dashed #1a73e8',
						pointerEvents: 'none',
					}}
				/>
			);
		}

		if (dragState.kind === 'drag-row') {
			const { pageVirtualX, table } = dragState.result;
			const canvasRect = canvas.getBoundingClientRect();
			const dragY = dragState.currentCanvasY - canvasRect.top;
			const { cx: lineLeft } = renderer.virtualToCanvas(pageVirtualX + table.x, 0);
			const { cx: lineRight } = renderer.virtualToCanvas(
				pageVirtualX + table.x + table.width,
				0,
			);

			return (
				<div
					style={{
						position: 'absolute',
						left: lineLeft,
						top: dragY - 1,
						width: lineRight - lineLeft,
						height: 2,
						borderTop: '2px dashed #1a73e8',
						pointerEvents: 'none',
					}}
				/>
			);
		}

		return null;
	};

	const isDragging = dragState.kind === 'drag-col' || dragState.kind === 'drag-row';

	return (
		<div
			ref={overlayRef}
			style={{
				...overlayStyle,
				pointerEvents: isDragging ? 'auto' : 'none',
			}}
		>
			{renderIndicator()}
		</div>
	);
}
