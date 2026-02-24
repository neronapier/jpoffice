import type { JPEditor } from '../editor';

/**
 * Hit-test result from touch coordinates.
 */
export interface TouchHitTestResult {
	path: number[];
	offset: number;
}

/**
 * Options for the TouchManager.
 */
export interface TouchManagerOptions {
	/** Delay in ms before a long press is recognized. Default: 500. */
	longPressDelay?: number;
	/** Max time in ms between two taps to count as a double tap. Default: 300. */
	doubleTapDelay?: number;
	/** Movement threshold in px to cancel a long press. Default: 10. */
	moveThreshold?: number;
	/** Callback to convert canvas-relative coordinates to a document position. */
	hitTest?: (x: number, y: number) => TouchHitTestResult | null;
}

/**
 * TouchManager handles touch interactions on the editor canvas.
 * Translates touch gestures into editor commands:
 * - Single tap: set cursor position
 * - Double tap: select word at position
 * - Long press: trigger context menu callback
 * - Pinch: zoom gesture callback
 * - Touch move during selection: extend selection
 *
 * Client-side only -- never instantiated during SSR.
 */
export class TouchManager {
	private editor: JPEditor;
	private element: HTMLElement | null = null;

	// Options
	private longPressDelay: number;
	private doubleTapDelay: number;
	private moveThreshold: number;
	private hitTestFn: ((x: number, y: number) => TouchHitTestResult | null) | null;

	// Touch tracking state
	private touchStartX = 0;
	private touchStartY = 0;
	private touchStartTime = 0;
	private longPressTimer: ReturnType<typeof setTimeout> | null = null;
	private lastTapTime = 0;
	private lastTapX = 0;
	private lastTapY = 0;
	private isSelecting = false;
	private selectionAnchor: TouchHitTestResult | null = null;

	// Pinch state
	private initialPinchDistance = 0;
	private isPinching = false;

	/** Callback fired on long press at the given canvas-relative coordinates. */
	onContextMenu?: (x: number, y: number) => void;

	/** Callback fired when selection changes via touch. */
	onSelectionChange?: () => void;

	/** Callback fired during a pinch gesture with the scale ratio. */
	onPinchZoom?: (scale: number) => void;

	constructor(editor: JPEditor, options?: TouchManagerOptions) {
		this.editor = editor;
		this.longPressDelay = options?.longPressDelay ?? 500;
		this.doubleTapDelay = options?.doubleTapDelay ?? 300;
		this.moveThreshold = options?.moveThreshold ?? 10;
		this.hitTestFn = options?.hitTest ?? null;
	}

	/**
	 * Attach touch event listeners to a DOM element (typically the canvas container).
	 */
	attach(element: HTMLElement): void {
		this.detach();
		this.element = element;

		element.addEventListener('touchstart', this.onTouchStart, { passive: false });
		element.addEventListener('touchmove', this.onTouchMove, { passive: false });
		element.addEventListener('touchend', this.onTouchEnd, { passive: false });
		element.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
	}

	/**
	 * Detach all touch event listeners.
	 */
	detach(): void {
		if (!this.element) return;

		this.element.removeEventListener('touchstart', this.onTouchStart);
		this.element.removeEventListener('touchmove', this.onTouchMove);
		this.element.removeEventListener('touchend', this.onTouchEnd);
		this.element.removeEventListener('touchcancel', this.onTouchCancel);
		this.element = null;

		this.cancelLongPress();
		this.resetState();
	}

	/**
	 * Update the hit-test callback at runtime.
	 */
	setHitTest(fn: (x: number, y: number) => TouchHitTestResult | null): void {
		this.hitTestFn = fn;
	}

	// ── Internal helpers ────────────────────────────────────────

	private cancelLongPress(): void {
		if (this.longPressTimer !== null) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
	}

	private resetState(): void {
		this.isSelecting = false;
		this.selectionAnchor = null;
		this.isPinching = false;
		this.initialPinchDistance = 0;
	}

	private getCanvasCoords(touch: Touch): { x: number; y: number } {
		if (!this.element) return { x: touch.clientX, y: touch.clientY };
		const rect = this.element.getBoundingClientRect();
		return {
			x: touch.clientX - rect.left,
			y: touch.clientY - rect.top,
		};
	}

	private distanceBetweenTouches(t1: Touch, t2: Touch): number {
		const dx = t1.clientX - t2.clientX;
		const dy = t1.clientY - t2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private distance(x1: number, y1: number, x2: number, y2: number): number {
		const dx = x1 - x2;
		const dy = y1 - y2;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private performHitTest(x: number, y: number): TouchHitTestResult | null {
		if (!this.hitTestFn) return null;
		return this.hitTestFn(x, y);
	}

	// ── Event handlers ──────────────────────────────────────────

	private onTouchStart = (e: TouchEvent): void => {
		// Pinch gesture (2 fingers)
		if (e.touches.length === 2) {
			e.preventDefault();
			this.cancelLongPress();
			this.isPinching = true;
			this.isSelecting = false;
			this.initialPinchDistance = this.distanceBetweenTouches(e.touches[0], e.touches[1]);
			return;
		}

		// Single finger
		if (e.touches.length !== 1) return;

		const touch = e.touches[0];
		this.touchStartX = touch.clientX;
		this.touchStartY = touch.clientY;
		this.touchStartTime = Date.now();

		// Start long-press timer
		this.cancelLongPress();
		this.longPressTimer = setTimeout(() => {
			this.longPressTimer = null;
			const coords = this.getCanvasCoords(touch);
			this.onContextMenu?.(coords.x, coords.y);
		}, this.longPressDelay);

		e.preventDefault();
	};

	private onTouchMove = (e: TouchEvent): void => {
		// Pinch zoom
		if (this.isPinching && e.touches.length === 2) {
			e.preventDefault();
			const currentDistance = this.distanceBetweenTouches(e.touches[0], e.touches[1]);
			if (this.initialPinchDistance > 0) {
				const scale = currentDistance / this.initialPinchDistance;
				this.onPinchZoom?.(scale);
			}
			return;
		}

		if (e.touches.length !== 1) return;

		const touch = e.touches[0];
		const moved = this.distance(touch.clientX, touch.clientY, this.touchStartX, this.touchStartY);

		// Cancel long press if the finger moved beyond threshold
		if (moved > this.moveThreshold) {
			this.cancelLongPress();
		}

		// If we are in selection-extending mode, extend the selection
		if (this.isSelecting && this.selectionAnchor) {
			e.preventDefault();
			const coords = this.getCanvasCoords(touch);
			const hit = this.performHitTest(coords.x, coords.y);
			if (hit) {
				this.editor.setSelection({
					anchor: { path: this.selectionAnchor.path, offset: this.selectionAnchor.offset },
					focus: { path: hit.path, offset: hit.offset },
				});
				this.onSelectionChange?.();
			}
		}
	};

	private onTouchEnd = (e: TouchEvent): void => {
		this.cancelLongPress();

		// End pinch
		if (this.isPinching) {
			this.isPinching = false;
			this.initialPinchDistance = 0;
			return;
		}

		// End selection drag
		if (this.isSelecting) {
			this.isSelecting = false;
			this.selectionAnchor = null;
			return;
		}

		// Process tap
		if (e.changedTouches.length !== 1) return;

		const touch = e.changedTouches[0];
		const elapsed = Date.now() - this.touchStartTime;
		const moved = this.distance(touch.clientX, touch.clientY, this.touchStartX, this.touchStartY);

		// Ignore if the finger moved too much (it was a scroll/drag, not a tap)
		if (moved > this.moveThreshold) return;

		// Ignore if it took too long (long press was already handled)
		if (elapsed > this.longPressDelay) return;

		const coords = this.getCanvasCoords(touch);
		const now = Date.now();

		// Double-tap detection
		const timeSinceLastTap = now - this.lastTapTime;
		const distFromLastTap = this.distance(
			touch.clientX,
			touch.clientY,
			this.lastTapX,
			this.lastTapY,
		);

		if (timeSinceLastTap < this.doubleTapDelay && distFromLastTap < this.moveThreshold * 3) {
			// Double tap: select word
			this.handleDoubleTap(coords.x, coords.y);
			// Reset last tap so a third tap doesn't re-trigger
			this.lastTapTime = 0;
			this.lastTapX = 0;
			this.lastTapY = 0;
			return;
		}

		// Single tap: set cursor
		this.handleSingleTap(coords.x, coords.y);

		// Record tap for double-tap detection
		this.lastTapTime = now;
		this.lastTapX = touch.clientX;
		this.lastTapY = touch.clientY;
	};

	private onTouchCancel = (): void => {
		this.cancelLongPress();
		this.resetState();
	};

	// ── Gesture actions ─────────────────────────────────────────

	private handleSingleTap(x: number, y: number): void {
		const hit = this.performHitTest(x, y);
		if (!hit) return;

		this.editor.setSelection({
			anchor: { path: hit.path, offset: hit.offset },
			focus: { path: hit.path, offset: hit.offset },
		});

		// Enable selection extending on the next touch-move if the user starts dragging
		this.isSelecting = true;
		this.selectionAnchor = hit;

		this.onSelectionChange?.();
	}

	private handleDoubleTap(x: number, y: number): void {
		const hit = this.performHitTest(x, y);
		if (!hit) return;

		// Select word at position: dispatch the selectWord command
		// We execute the command that the selection plugin provides
		try {
			this.editor.executeCommand('selection.selectWord', {
				path: hit.path,
				offset: hit.offset,
			});
		} catch {
			// Fallback: just place cursor if selectWord command is not available
			this.editor.setSelection({
				anchor: { path: hit.path, offset: hit.offset },
				focus: { path: hit.path, offset: hit.offset },
			});
		}

		this.onSelectionChange?.();
	}
}
