'use client';

/**
 * ShapeSelectionOverlay renders selection handles around the currently
 * selected shape, allowing the user to move and resize it via drag.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { LayoutShape } from '@jpoffice/layout';
import { isLayoutShape } from '@jpoffice/layout';
import type { JPPath } from '@jpoffice/model';
import { pxToEmu } from '@jpoffice/model';
import type { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject, ReactElement } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SelectedShape {
	shape: LayoutShape;
	pageIndex: number;
}

type DragState =
	| { kind: 'idle' }
	| {
			kind: 'move';
			startClientX: number;
			startClientY: number;
			currentClientX: number;
			currentClientY: number;
	  }
	| {
			kind: 'resize';
			handle: HandlePosition;
			startClientX: number;
			startClientY: number;
			currentClientX: number;
			currentClientY: number;
	  };

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const overlayStyle: CSSProperties = {
	position: 'absolute',
	inset: 0,
	pointerEvents: 'none',
	zIndex: 51,
};

const HANDLE_SIZE = 8;

const handleStyle: CSSProperties = {
	position: 'absolute',
	width: HANDLE_SIZE,
	height: HANDLE_SIZE,
	background: '#fff',
	border: '1px solid #1a73e8',
	borderRadius: 1,
	pointerEvents: 'auto',
	cursor: 'default',
};

const HANDLE_CURSORS: Record<HandlePosition, string> = {
	nw: 'nwse-resize',
	n: 'ns-resize',
	ne: 'nesw-resize',
	e: 'ew-resize',
	se: 'nwse-resize',
	s: 'ns-resize',
	sw: 'nesw-resize',
	w: 'ew-resize',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ShapeSelectionOverlayProps {
	editor: JPEditor;
	rendererRef: MutableRefObject<CanvasRenderer | null>;
	zoom: number;
}

/* ------------------------------------------------------------------ */
/*  Helper: find shape at canvas coords                                */
/* ------------------------------------------------------------------ */

function findShapeAtCanvasCoords(
	renderer: CanvasRenderer,
	canvasX: number,
	canvasY: number,
): SelectedShape | null {
	const layout = renderer.getLayoutResult();
	if (!layout) return null;

	// Convert canvas coords to virtual coords
	const vx = canvasX / renderer.getZoom();
	const vy = canvasY / renderer.getZoom() + renderer.getScrollY() / renderer.getZoom();

	const pages = layout.pages;
	const cssWidth = (renderer.getCanvas()?.width ?? 0) / (renderer.getDpr() * renderer.getZoom());

	for (let pi = 0; pi < pages.length; pi++) {
		const page = pages[pi];
		const pageY = renderer.pageRenderer.getPageY(pages, pi);
		const pageX = (cssWidth - page.width) / 2;

		// Check if point is within this page
		if (vy < pageY || vy > pageY + page.height) continue;
		if (vx < pageX || vx > pageX + page.width) continue;

		// Check shapes (reverse order = top shapes first)
		for (let bi = page.blocks.length - 1; bi >= 0; bi--) {
			const block = page.blocks[bi];
			if (!isLayoutShape(block)) continue;

			const sx = pageX + block.rect.x;
			const sy = pageY + block.rect.y;
			if (vx >= sx && vx <= sx + block.rect.width && vy >= sy && vy <= sy + block.rect.height) {
				return { shape: block, pageIndex: pi };
			}
		}
	}

	return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShapeSelectionOverlay({
	editor,
	rendererRef,
	zoom,
}: ShapeSelectionOverlayProps): ReactElement | null {
	const [selected, setSelected] = useState<SelectedShape | null>(null);
	const [dragState, setDragState] = useState<DragState>({ kind: 'idle' });
	const stateRef = useRef({ selected, dragState });
	stateRef.current = { selected, dragState };

	const overlayRef = useRef<HTMLDivElement>(null);

	/* ---- Click detection: select/deselect shape ---- */
	const handleMouseDown = useCallback(
		(e: MouseEvent) => {
			const renderer = rendererRef.current;
			if (!renderer) return;
			const canvas = renderer.getCanvas();
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const canvasX = e.clientX - rect.left;
			const canvasY = e.clientY - rect.top;

			const hit = findShapeAtCanvasCoords(renderer, canvasX, canvasY);
			if (hit) {
				e.preventDefault();
				e.stopPropagation();
				setSelected(hit);
				// Start move drag
				setDragState({
					kind: 'move',
					startClientX: e.clientX,
					startClientY: e.clientY,
					currentClientX: e.clientX,
					currentClientY: e.clientY,
				});
			} else {
				// Click outside shape → deselect
				if (stateRef.current.selected) {
					setSelected(null);
					setDragState({ kind: 'idle' });
				}
			}
		},
		[rendererRef],
	);

	/* ---- Handle resize start ---- */
	const handleResizeStart = useCallback((handle: HandlePosition, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragState({
			kind: 'resize',
			handle,
			startClientX: e.clientX,
			startClientY: e.clientY,
			currentClientX: e.clientX,
			currentClientY: e.clientY,
		});
	}, []);

	/* ---- Mouse move during drag ---- */
	const handleMouseMove = useCallback((e: MouseEvent) => {
		const { dragState: ds } = stateRef.current;
		if (ds.kind === 'idle') return;
		setDragState({ ...ds, currentClientX: e.clientX, currentClientY: e.clientY });
	}, []);

	/* ---- Mouse up: apply move/resize ---- */
	const handleMouseUp = useCallback(() => {
		const { selected: sel, dragState: ds } = stateRef.current;
		if (!sel || ds.kind === 'idle') return;

		const deltaPxX = (ds.currentClientX - ds.startClientX) / zoom;
		const deltaPxY = (ds.currentClientY - ds.startClientY) / zoom;

		// Only apply if there was actual movement
		if (Math.abs(deltaPxX) > 1 || Math.abs(deltaPxY) > 1) {
			const shape = sel.shape;
			const path = shape.nodePath as JPPath;

			if (ds.kind === 'move') {
				const newX = pxToEmu(shape.rect.x + deltaPxX);
				const newY = pxToEmu(shape.rect.y + deltaPxY);
				try {
					editor.executeCommand('shape.move', { path, x: newX, y: newY });
				} catch {
					/* command may not be registered */
				}
			} else if (ds.kind === 'resize') {
				const { newWidth, newHeight } = computeResize(
					shape.rect.width,
					shape.rect.height,
					deltaPxX,
					deltaPxY,
					ds.handle,
				);
				try {
					editor.executeCommand('shape.resize', {
						path,
						width: pxToEmu(Math.max(newWidth, 10)),
						height: pxToEmu(Math.max(newHeight, 10)),
					});
				} catch {
					/* command may not be registered */
				}

				// If resize from nw/n/ne/w/sw/s moves the origin, also move
				const { dx, dy } = computeOriginShift(
					shape.rect.width,
					shape.rect.height,
					deltaPxX,
					deltaPxY,
					ds.handle,
				);
				if (dx !== 0 || dy !== 0) {
					try {
						editor.executeCommand('shape.move', {
							path,
							x: pxToEmu(shape.rect.x + dx),
							y: pxToEmu(shape.rect.y + dy),
						});
					} catch {
						/* command may not be registered */
					}
				}
			}
		}

		setDragState({ kind: 'idle' });
	}, [editor, zoom]);

	/* ---- Delete key ---- */
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const { selected: sel } = stateRef.current;
			if (!sel) return;
			if (e.key === 'Delete' || e.key === 'Backspace') {
				e.preventDefault();
				try {
					editor.executeCommand('shape.delete', { path: sel.shape.nodePath });
				} catch {
					/* command may not be registered */
				}
				setSelected(null);
				setDragState({ kind: 'idle' });
			}
		},
		[editor],
	);

	/* ---- Attach listeners ---- */
	useEffect(() => {
		const container = overlayRef.current?.parentElement;
		if (!container) return;

		container.addEventListener('mousedown', handleMouseDown, true);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			container.removeEventListener('mousedown', handleMouseDown, true);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown]);

	/* ---- Render handles ---- */
	if (!selected) {
		return <div ref={overlayRef} style={overlayStyle} />;
	}

	const renderer = rendererRef.current;
	if (!renderer) {
		return <div ref={overlayRef} style={overlayStyle} />;
	}

	const layout = renderer.getLayoutResult();
	if (!layout) {
		return <div ref={overlayRef} style={overlayStyle} />;
	}

	const pages = layout.pages;
	const cssWidth = (renderer.getCanvas()?.width ?? 0) / (renderer.getDpr() * renderer.getZoom());
	const page = pages[selected.pageIndex];
	if (!page) {
		return <div ref={overlayRef} style={overlayStyle} />;
	}

	const pageVirtualY = renderer.pageRenderer.getPageY(pages, selected.pageIndex);
	const pageVirtualX = (cssWidth - page.width) / 2;

	const shape = selected.shape;

	// Apply drag offset for visual feedback
	let sx = shape.rect.x;
	let sy = shape.rect.y;
	let sw = shape.rect.width;
	let sh = shape.rect.height;

	if (dragState.kind === 'move') {
		const dx = (dragState.currentClientX - dragState.startClientX) / zoom;
		const dy = (dragState.currentClientY - dragState.startClientY) / zoom;
		sx += dx;
		sy += dy;
	} else if (dragState.kind === 'resize') {
		const dx = (dragState.currentClientX - dragState.startClientX) / zoom;
		const dy = (dragState.currentClientY - dragState.startClientY) / zoom;
		const resized = computeResize(shape.rect.width, shape.rect.height, dx, dy, dragState.handle);
		const shifted = computeOriginShift(
			shape.rect.width,
			shape.rect.height,
			dx,
			dy,
			dragState.handle,
		);
		sx += shifted.dx;
		sy += shifted.dy;
		sw = Math.max(resized.newWidth, 10);
		sh = Math.max(resized.newHeight, 10);
	}

	// Convert to canvas CSS coords
	const topLeft = renderer.virtualToCanvas(pageVirtualX + sx, pageVirtualY + sy);
	const bottomRight = renderer.virtualToCanvas(pageVirtualX + sx + sw, pageVirtualY + sy + sh);

	const boxLeft = topLeft.cx;
	const boxTop = topLeft.cy;
	const boxWidth = bottomRight.cx - topLeft.cx;
	const boxHeight = bottomRight.cy - topLeft.cy;

	const half = HANDLE_SIZE / 2;

	const handles: Array<{ pos: HandlePosition; left: number; top: number }> = [
		{ pos: 'nw', left: boxLeft - half, top: boxTop - half },
		{ pos: 'n', left: boxLeft + boxWidth / 2 - half, top: boxTop - half },
		{ pos: 'ne', left: boxLeft + boxWidth - half, top: boxTop - half },
		{ pos: 'e', left: boxLeft + boxWidth - half, top: boxTop + boxHeight / 2 - half },
		{ pos: 'se', left: boxLeft + boxWidth - half, top: boxTop + boxHeight - half },
		{ pos: 's', left: boxLeft + boxWidth / 2 - half, top: boxTop + boxHeight - half },
		{ pos: 'sw', left: boxLeft - half, top: boxTop + boxHeight - half },
		{ pos: 'w', left: boxLeft - half, top: boxTop + boxHeight / 2 - half },
	];

	const isDragging = dragState.kind !== 'idle';

	return (
		<div
			ref={overlayRef}
			style={{
				...overlayStyle,
				pointerEvents: isDragging ? 'auto' : 'none',
			}}
		>
			{/* Selection border */}
			<div
				style={{
					position: 'absolute',
					left: boxLeft,
					top: boxTop,
					width: boxWidth,
					height: boxHeight,
					border: '1px solid #1a73e8',
					pointerEvents: 'none',
				}}
			/>
			{/* Resize handles */}
			{handles.map((h) => (
				<div
					key={h.pos}
					style={{
						...handleStyle,
						left: h.left,
						top: h.top,
						cursor: HANDLE_CURSORS[h.pos],
					}}
					onMouseDown={(e) => handleResizeStart(h.pos, e)}
				/>
			))}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Resize math helpers                                                */
/* ------------------------------------------------------------------ */

function computeResize(
	width: number,
	height: number,
	dx: number,
	dy: number,
	handle: HandlePosition,
): { newWidth: number; newHeight: number } {
	let newWidth = width;
	let newHeight = height;

	switch (handle) {
		case 'e':
			newWidth = width + dx;
			break;
		case 'w':
			newWidth = width - dx;
			break;
		case 's':
			newHeight = height + dy;
			break;
		case 'n':
			newHeight = height - dy;
			break;
		case 'se':
			newWidth = width + dx;
			newHeight = height + dy;
			break;
		case 'sw':
			newWidth = width - dx;
			newHeight = height + dy;
			break;
		case 'ne':
			newWidth = width + dx;
			newHeight = height - dy;
			break;
		case 'nw':
			newWidth = width - dx;
			newHeight = height - dy;
			break;
	}

	return { newWidth, newHeight };
}

function computeOriginShift(
	width: number,
	height: number,
	dx: number,
	dy: number,
	handle: HandlePosition,
): { dx: number; dy: number } {
	const resized = computeResize(width, height, dx, dy, handle);
	let shiftX = 0;
	let shiftY = 0;

	// Handles that move the left edge
	if (handle === 'w' || handle === 'nw' || handle === 'sw') {
		shiftX = width - resized.newWidth;
	}
	// Handles that move the top edge
	if (handle === 'n' || handle === 'nw' || handle === 'ne') {
		shiftY = height - resized.newHeight;
	}

	return { dx: shiftX, dy: shiftY };
}
