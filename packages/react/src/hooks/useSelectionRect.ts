'use client';

import type { JPEditor } from '@jpoffice/engine';
import type { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SelectionRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Returns the bounding rectangle of the current text selection in canvas coordinates.
 * Returns null if no text is selected (collapsed selection).
 * Updates when selection changes.
 *
 * @param editor The JPEditor instance (or null if not ready).
 * @param rendererRef Optional ref to the CanvasRenderer for precise pixel positioning.
 */
export function useSelectionRect(
	editor: JPEditor | null,
	rendererRef?: React.RefObject<CanvasRenderer | null>,
): SelectionRect | null {
	const [rect, setRect] = useState<SelectionRect | null>(null);
	const prevRectRef = useRef<SelectionRect | null>(null);

	const computeRect = useCallback(() => {
		if (!editor) {
			if (prevRectRef.current !== null) {
				prevRectRef.current = null;
				setRect(null);
			}
			return;
		}

		const selection = editor.getSelection();
		if (!selection) {
			if (prevRectRef.current !== null) {
				prevRectRef.current = null;
				setRect(null);
			}
			return;
		}

		// Check collapsed
		const { anchor, focus } = selection;
		const isCollapsed =
			anchor.path.length === focus.path.length &&
			anchor.path.every((v, i) => v === focus.path[i]) &&
			anchor.offset === focus.offset;

		if (isCollapsed) {
			if (prevRectRef.current !== null) {
				prevRectRef.current = null;
				setRect(null);
			}
			return;
		}

		// Use renderer to get precise rectangle
		const renderer = rendererRef?.current;
		if (renderer) {
			const selRect = renderer.getSelectionRect(selection);
			if (selRect) {
				// Only update state if rect changed
				const prev = prevRectRef.current;
				if (
					!prev ||
					prev.x !== selRect.x ||
					prev.y !== selRect.y ||
					prev.width !== selRect.width ||
					prev.height !== selRect.height
				) {
					prevRectRef.current = selRect;
					setRect(selRect);
				}
				return;
			}
		}

		// Fallback: no renderer available or rect not found
		if (prevRectRef.current !== null) {
			prevRectRef.current = null;
			setRect(null);
		}
	}, [editor, rendererRef]);

	useEffect(() => {
		if (!editor) return;
		// Compute immediately
		computeRect();
		// Subscribe to state changes
		const unsubscribe = editor.subscribe(() => {
			computeRect();
		});
		return unsubscribe;
	}, [editor, computeRect]);

	return rect;
}
