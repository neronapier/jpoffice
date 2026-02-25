'use client';

/**
 * ImageResizeOverlay renders selection handles around the currently
 * selected image, allowing the user to resize it via drag.
 * Follows the same pattern as ShapeSelectionOverlay.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { LayoutImage } from '@jpoffice/layout';
import { pxToEmu } from '@jpoffice/model';
import type { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject, ReactElement } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SelectedImage {
	image: LayoutImage;
	pageIndex: number;
}

type DragState =
	| { kind: 'idle' }
	| {
			kind: 'resize';
			handle: HandlePosition;
			startClientX: number;
			startClientY: number;
			currentClientX: number;
			currentClientY: number;
			shiftKey: boolean;
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

export interface ImageResizeOverlayProps {
	editor: JPEditor;
	rendererRef: MutableRefObject<CanvasRenderer | null>;
	zoom: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ImageResizeOverlay({
	editor,
	rendererRef,
	zoom,
}: ImageResizeOverlayProps): ReactElement | null {
	const [selected, setSelected] = useState<SelectedImage | null>(null);
	const [dragState, setDragState] = useState<DragState>({ kind: 'idle' });
	const stateRef = useRef({ selected, dragState });
	stateRef.current = { selected, dragState };

	const overlayRef = useRef<HTMLDivElement>(null);

	/* ---- Click detection: select/deselect image ---- */
	const handleMouseDown = useCallback(
		(e: MouseEvent) => {
			const renderer = rendererRef.current;
			if (!renderer) return;
			const canvas = renderer.getCanvas();
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const canvasX = e.clientX - rect.left;
			const canvasY = e.clientY - rect.top;

			const hit = renderer.findImageAtCanvasCoords(canvasX, canvasY);
			if (hit) {
				e.preventDefault();
				e.stopPropagation();
				setSelected({ image: hit.image, pageIndex: hit.pageIndex });
				setDragState({ kind: 'idle' });
			} else {
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
			shiftKey: e.shiftKey,
		});
	}, []);

	/* ---- Mouse move during drag ---- */
	const handleMouseMove = useCallback((e: MouseEvent) => {
		const { dragState: ds } = stateRef.current;
		if (ds.kind === 'idle') return;
		setDragState({ ...ds, currentClientX: e.clientX, currentClientY: e.clientY, shiftKey: e.shiftKey });
	}, []);

	/* ---- Mouse up: apply resize ---- */
	const handleMouseUp = useCallback(() => {
		const { selected: sel, dragState: ds } = stateRef.current;
		if (!sel || ds.kind === 'idle') return;

		const dx = (ds.currentClientX - ds.startClientX) / zoom;
		const dy = (ds.currentClientY - ds.startClientY) / zoom;

		if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
			const image = sel.image;
			const { newWidth, newHeight } = computeResize(
				image.rect.width,
				image.rect.height,
				dx,
				dy,
				ds.handle,
				ds.shiftKey,
			);

			const finalW = Math.max(newWidth, 10);
			const finalH = Math.max(newHeight, 10);

			try {
				editor.executeCommand('image.resize', {
					path: image.nodePath,
					width: Math.round(pxToEmu(finalW)),
					height: Math.round(pxToEmu(finalH)),
				});
			} catch {
				/* command may not be registered */
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
					editor.executeCommand('image.delete', { path: sel.image.nodePath });
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

	const image = selected.image;

	// Apply drag offset for visual feedback
	let iw = image.rect.width;
	let ih = image.rect.height;

	if (dragState.kind === 'resize') {
		const dx = (dragState.currentClientX - dragState.startClientX) / zoom;
		const dy = (dragState.currentClientY - dragState.startClientY) / zoom;
		const resized = computeResize(image.rect.width, image.rect.height, dx, dy, dragState.handle, dragState.shiftKey);
		iw = Math.max(resized.newWidth, 10);
		ih = Math.max(resized.newHeight, 10);
	}

	// Image origin might shift when resizing from top/left handles
	let ix = image.rect.x;
	let iy = image.rect.y;
	if (dragState.kind === 'resize') {
		const dx = (dragState.currentClientX - dragState.startClientX) / zoom;
		const dy = (dragState.currentClientY - dragState.startClientY) / zoom;
		const shifted = computeOriginShift(image.rect.width, image.rect.height, dx, dy, dragState.handle, dragState.shiftKey);
		ix += shifted.dx;
		iy += shifted.dy;
	}

	// Convert to canvas CSS coords
	const topLeft = renderer.virtualToCanvas(pageVirtualX + ix, pageVirtualY + iy);
	const bottomRight = renderer.virtualToCanvas(pageVirtualX + ix + iw, pageVirtualY + iy + ih);

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
	shiftKey: boolean,
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

	// Shift key: maintain aspect ratio
	if (shiftKey && width > 0 && height > 0) {
		const aspect = width / height;
		if (handle === 'e' || handle === 'w') {
			newHeight = newWidth / aspect;
		} else if (handle === 'n' || handle === 's') {
			newWidth = newHeight * aspect;
		} else {
			// Corner handles — use the larger change
			const wRatio = newWidth / width;
			const hRatio = newHeight / height;
			if (Math.abs(wRatio - 1) > Math.abs(hRatio - 1)) {
				newHeight = newWidth / aspect;
			} else {
				newWidth = newHeight * aspect;
			}
		}
	}

	return { newWidth, newHeight };
}

function computeOriginShift(
	width: number,
	height: number,
	dx: number,
	dy: number,
	handle: HandlePosition,
	shiftKey: boolean,
): { dx: number; dy: number } {
	const resized = computeResize(width, height, dx, dy, handle, shiftKey);
	let shiftX = 0;
	let shiftY = 0;

	if (handle === 'w' || handle === 'nw' || handle === 'sw') {
		shiftX = width - resized.newWidth;
	}
	if (handle === 'n' || handle === 'nw' || handle === 'ne') {
		shiftY = height - resized.newHeight;
	}

	return { dx: shiftX, dy: shiftY };
}
