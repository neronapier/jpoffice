'use client';

import { InputManager } from '@jpoffice/engine';
import type { JPEditor } from '@jpoffice/engine';
import type { LayoutResult } from '@jpoffice/layout';
import type { JPPoint, JPSelection } from '@jpoffice/model';
import { getNodeAtPath, isText } from '@jpoffice/model';
import { CanvasRenderer } from '@jpoffice/renderer';
import type { SearchHighlight } from '@jpoffice/renderer';
import { useCallback, useEffect, useId, useRef } from 'react';

// ── Word / paragraph boundary helpers ──────────────────────

const WORD_SEPARATORS = /[\s.,;:!?'"()[\]{}<>\/\\@#$%^&*+=|~`\-–—]+/;

function findWordBoundary(text: string, offset: number, direction: 'start' | 'end'): number {
	if (direction === 'start') {
		let i = offset;
		// Skip separators backward
		while (i > 0 && WORD_SEPARATORS.test(text[i - 1])) i--;
		// Skip word chars backward
		while (i > 0 && !WORD_SEPARATORS.test(text[i - 1])) i--;
		return i;
	}
	// direction === 'end'
	let i = offset;
	// Skip word chars forward
	while (i < text.length && !WORD_SEPARATORS.test(text[i])) i++;
	// Skip separators forward
	while (i < text.length && WORD_SEPARATORS.test(text[i])) i++;
	return i;
}

// ── Auto-scroll constants ──────────────────────────────────

/** Margin from viewport edge that triggers auto-scroll during drag (px). */
const DRAG_SCROLL_MARGIN = 40;
/** Max scroll speed per frame during drag (px). */
const DRAG_SCROLL_SPEED = 12;
/** Margin to keep cursor visible after keyboard navigation (px). */
const CURSOR_SCROLL_PADDING = 60;

// ── Component ──────────────────────────────────────────────

export interface EditorCanvasProps {
	editor: JPEditor;
	layout: LayoutResult | null;
	selection: JPSelection;
	readOnly?: boolean;
	zoom?: number;
	searchHighlights?: readonly SearchHighlight[];
	searchCurrentIndex?: number;
	onContextMenu?: (e: React.MouseEvent) => void;
	/** Ref callback to expose the internal CanvasRenderer instance. */
	rendererRef?: React.MutableRefObject<CanvasRenderer | null>;
	/** Whether header/footer is currently being edited (to intercept body clicks). */
	hfEditing?: boolean;
}

export function EditorCanvas({
	editor,
	layout,
	selection,
	readOnly,
	zoom = 100,
	searchHighlights,
	searchCurrentIndex = -1,
	onContextMenu,
	rendererRef: externalRendererRef,
	hfEditing,
}: EditorCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const rendererRef = useRef<CanvasRenderer | null>(null);
	const inputManagerRef = useRef<InputManager | null>(null);
	const scrollYRef = useRef(0);

	// Accessibility: unique IDs for aria-describedby and aria-live regions
	const a11yId = useId();
	const srStatusId = `${a11yId}-sr-status`;
	const srAlertId = `${a11yId}-sr-alert`;
	const srStatusRef = useRef<HTMLDivElement>(null);
	const prevSelectionDescRef = useRef<string>('');

	// Drag state refs (avoid re-renders during drag)
	const isDraggingRef = useRef(false);
	const dragAnchorRef = useRef<JPPoint | null>(null);
	const dragScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastMouseYRef = useRef(0);

	// Click counting for double/triple click
	const clickCountRef = useRef(0);
	const lastClickTimeRef = useRef(0);
	const lastClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const MULTI_CLICK_DELAY = 500; // ms
	const MULTI_CLICK_RADIUS = 5; // px

	// Initialize renderer and input manager
	useEffect(() => {
		const canvas = canvasRef.current;
		const textarea = textareaRef.current;
		if (!canvas) return;

		const renderer = new CanvasRenderer();
		renderer.attach(canvas);
		renderer.cursorRenderer.startBlinking(() => renderer.render());
		rendererRef.current = renderer;
		if (externalRendererRef) externalRendererRef.current = renderer;

		if (textarea && !readOnly) {
			const inputManager = new InputManager(editor);
			inputManager.attach(textarea);
			inputManagerRef.current = inputManager;
			textarea.focus();
		}

		return () => {
			renderer.cursorRenderer.stopBlinking();
			renderer.destroy();
			rendererRef.current = null;
			if (externalRendererRef) externalRendererRef.current = null;
			if (inputManagerRef.current) {
				inputManagerRef.current.detach();
				inputManagerRef.current = null;
			}
		};
	}, [editor, readOnly, externalRendererRef]);

	// Handle resize
	useEffect(() => {
		const container = containerRef.current;
		const renderer = rendererRef.current;
		if (!container || !renderer) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				renderer.resize(width, height);
				renderer.render();
			}
		});
		resizeObserver.observe(container);

		const rect = container.getBoundingClientRect();
		renderer.resize(rect.width, rect.height);

		return () => resizeObserver.disconnect();
	}, []);

	// Update layout and re-render
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer || !layout) return;
		renderer.setLayout(layout);
		renderer.render();
	}, [layout]);

	// Update selection, re-render, and auto-scroll cursor into view
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.setSelection(selection);
		renderer.cursorRenderer.resetBlink();
		renderer.render();

		// Auto-scroll to keep cursor visible (skip during drag — drag has its own scroll)
		if (!isDraggingRef.current && selection) {
			scrollCursorIntoView();
		}

		// Announce cursor position change for screen readers
		if (selection && srStatusRef.current) {
			const { anchor, focus } = selection;
			const isCollapsed =
				anchor.path.length === focus.path.length &&
				anchor.path.every((v, i) => v === focus.path[i]) &&
				anchor.offset === focus.offset;

			let desc: string;
			if (isCollapsed) {
				desc = `Cursor at position ${anchor.offset}`;
			} else {
				desc = 'Text selected';
			}

			// Only announce if description actually changed
			if (desc !== prevSelectionDescRef.current) {
				prevSelectionDescRef.current = desc;
				srStatusRef.current.textContent = '';
				requestAnimationFrame(() => {
					if (srStatusRef.current) {
						srStatusRef.current.textContent = desc;
					}
				});
			}
		}
	}, [selection]);

	// Update zoom and re-render
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.setZoom(zoom / 100);
		renderer.render();
	}, [zoom]);

	// Update search highlights and re-render
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.setSearchHighlights(searchHighlights ?? [], searchCurrentIndex);
		renderer.render();
	}, [searchHighlights, searchCurrentIndex]);

	// ── Auto-scroll cursor into view ───────────────────────

	const scrollCursorIntoView = useCallback(() => {
		const renderer = rendererRef.current;
		const container = containerRef.current;
		const sel = editor.getSelection();
		if (!renderer || !container || !sel) return;

		const cursorRect = renderer.getCursorRect(sel);
		if (!cursorRect) return;

		const containerRect = container.getBoundingClientRect();
		const cursorTop = cursorRect.y;
		const cursorBottom = cursorRect.y + cursorRect.height;

		if (cursorTop < CURSOR_SCROLL_PADDING) {
			container.scrollTop += cursorTop - CURSOR_SCROLL_PADDING;
		} else if (cursorBottom > containerRect.height - CURSOR_SCROLL_PADDING) {
			container.scrollTop += cursorBottom - (containerRect.height - CURSOR_SCROLL_PADDING);
		}
	}, [editor]);

	// Focus the hidden textarea for keyboard capture
	const focusTextarea = useCallback(() => {
		const ta = textareaRef.current;
		console.log('[JPOffice:Canvas] focusTextarea called', {
			textareaExists: !!ta,
			alreadyFocused: ta === document.activeElement,
		});
		ta?.focus();
	}, []);

	// ── Hit test helper ────────────────────────────────────

	const hitTestAt = useCallback((clientX: number, clientY: number) => {
		const renderer = rendererRef.current;
		const canvas = canvasRef.current;
		if (!renderer || !canvas) return null;

		const rect = canvas.getBoundingClientRect();
		return renderer.hitTest(clientX - rect.left, clientY - rect.top);
	}, []);

	// ── Word selection ─────────────────────────────────────

	const selectWordAt = useCallback(
		(point: JPPoint) => {
			try {
				const doc = editor.getDocument();
				const node = getNodeAtPath(doc, point.path);
				if (!isText(node)) return;

				const text = node.text;
				const start = findWordBoundary(text, point.offset, 'start');
				const end = findWordBoundary(text, point.offset, 'end');
				if (start === end) return;

				editor.setSelection({
					anchor: { path: point.path, offset: start },
					focus: { path: point.path, offset: end },
				});
			} catch {
				/* invalid path */
			}
		},
		[editor],
	);

	// ── Paragraph selection ────────────────────────────────

	const selectParagraphAt = useCallback(
		(point: JPPoint) => {
			try {
				const doc = editor.getDocument();
				// Paragraph path is text path minus last 2 (run + text index)
				const paraPath = point.path.slice(0, -2);
				const paraNode = getNodeAtPath(doc, paraPath);
				if (!paraNode || !('children' in paraNode)) return;

				// Find first and last text nodes in paragraph
				let firstPath: readonly number[] | null = null;
				let lastPath: readonly number[] | null = null;
				let lastLength = 0;

				const para = paraNode as {
					children: readonly { children?: readonly { text?: string }[] }[];
				};
				for (let ri = 0; ri < para.children.length; ri++) {
					const run = para.children[ri];
					if (!run.children) continue;
					for (let ti = 0; ti < run.children.length; ti++) {
						const textNode = run.children[ti];
						if (textNode && typeof textNode.text === 'string') {
							const path = [...paraPath, ri, ti];
							if (!firstPath) firstPath = path;
							lastPath = path;
							lastLength = textNode.text.length;
						}
					}
				}

				if (firstPath && lastPath) {
					editor.setSelection({
						anchor: { path: firstPath, offset: 0 },
						focus: { path: lastPath, offset: lastLength },
					});
				}
			} catch {
				/* invalid path */
			}
		},
		[editor],
	);

	// ── Drag auto-scroll ───────────────────────────────────

	const startDragAutoScroll = useCallback(() => {
		if (dragScrollTimerRef.current) return;
		dragScrollTimerRef.current = setInterval(() => {
			const container = containerRef.current;
			if (!container || !isDraggingRef.current) return;

			const rect = container.getBoundingClientRect();
			const mouseY = lastMouseYRef.current;
			let scrollDelta = 0;

			if (mouseY < rect.top + DRAG_SCROLL_MARGIN) {
				// Mouse near top edge — scroll up
				const proximity = 1 - (mouseY - rect.top) / DRAG_SCROLL_MARGIN;
				scrollDelta = -DRAG_SCROLL_SPEED * Math.max(0, Math.min(1, proximity));
			} else if (mouseY > rect.bottom - DRAG_SCROLL_MARGIN) {
				// Mouse near bottom edge — scroll down
				const proximity = 1 - (rect.bottom - mouseY) / DRAG_SCROLL_MARGIN;
				scrollDelta = DRAG_SCROLL_SPEED * Math.max(0, Math.min(1, proximity));
			}

			if (scrollDelta !== 0) {
				container.scrollTop += scrollDelta;
			}
		}, 16); // ~60fps
	}, []);

	const stopDragAutoScroll = useCallback(() => {
		if (dragScrollTimerRef.current) {
			clearInterval(dragScrollTimerRef.current);
			dragScrollTimerRef.current = null;
		}
	}, []);

	// ── Mouse handlers ─────────────────────────────────────

	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			e.preventDefault();

			const hitResult = hitTestAt(e.clientX, e.clientY);
			console.log('[JPOffice:Canvas] mouseDown', {
				hitResult: hitResult
					? {
							pageIndex: hitResult.pageIndex,
							path: hitResult.point.path,
							offset: hitResult.point.offset,
						}
					: null,
				hasLayout: !!(rendererRef.current as Record<string, unknown> | null)?.layoutResult,
			});
			if (!hitResult?.point) {
				focusTextarea();
				return;
			}

			const now = Date.now();
			const dx = e.clientX - lastClickPosRef.current.x;
			const dy = e.clientY - lastClickPosRef.current.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Count consecutive clicks in same area within time window
			if (now - lastClickTimeRef.current < MULTI_CLICK_DELAY && dist < MULTI_CLICK_RADIUS) {
				clickCountRef.current += 1;
			} else {
				clickCountRef.current = 1;
			}
			lastClickTimeRef.current = now;
			lastClickPosRef.current = { x: e.clientX, y: e.clientY };

			const clicks = clickCountRef.current;

			if (clicks === 3) {
				// Triple-click: select paragraph
				selectParagraphAt(hitResult.point);
				clickCountRef.current = 0; // Reset so next click starts fresh
				focusTextarea();
				return;
			}

			if (clicks === 2) {
				// Double-click in header/footer zone: enter edit mode
				if (!readOnly && layout) {
					const renderer = rendererRef.current;
					if (renderer) {
						const page = layout.pages[hitResult.pageIndex];
						if (page) {
							const rect = canvasRef.current?.getBoundingClientRect();
							if (rect) {
								const canvasY = e.clientY - rect.top;
								const z = zoom / 100;
								const adjustedY = canvasY / z + renderer.getScrollY() / z;
								const pageY = renderer.pageRenderer.getPageY(layout.pages, hitResult.pageIndex);
								const localY = adjustedY - pageY;

								if (localY < page.contentArea.y) {
									// Clicked in header zone
									editor.executeCommand('headerFooter.editHeader');
									focusTextarea();
									return;
								}
								if (localY > page.contentArea.y + page.contentArea.height) {
									// Clicked in footer zone
									editor.executeCommand('headerFooter.editFooter');
									focusTextarea();
									return;
								}
							}
						}
					}
				}
				// Double-click: select word
				selectWordAt(hitResult.point);
				focusTextarea();
				return;
			}

			// Single click: if editing header/footer and clicking in body, exit edit mode
			if (hfEditing && layout) {
				const page = layout.pages[hitResult.pageIndex];
				if (page) {
					const rect = canvasRef.current?.getBoundingClientRect();
					if (rect) {
						const canvasY = e.clientY - rect.top;
						const z = zoom / 100;
						const adjustedY = canvasY / z + (rendererRef.current?.getScrollY() ?? 0) / z;
						const pageY =
							rendererRef.current?.pageRenderer.getPageY(layout.pages, hitResult.pageIndex) ?? 0;
						const localY = adjustedY - pageY;
						const inBody =
							localY >= page.contentArea.y &&
							localY <= page.contentArea.y + page.contentArea.height;
						if (inBody) {
							try {
								editor.executeCommand('headerFooter.exitEdit');
							} catch {
								/* not editing */
							}
						}
					}
				}
			}

			if (e.shiftKey) {
				// Shift+Click: extend selection from current anchor to new focus
				const currentSel = editor.getSelection();
				if (currentSel) {
					editor.setSelection({
						anchor: currentSel.anchor,
						focus: hitResult.point,
					});
				} else {
					editor.setSelection({
						anchor: hitResult.point,
						focus: hitResult.point,
					});
				}
			} else {
				// Regular click: collapse cursor
				editor.setSelection({
					anchor: hitResult.point,
					focus: hitResult.point,
				});
			}

			// Start tracking drag
			isDraggingRef.current = true;
			dragAnchorRef.current = e.shiftKey
				? (editor.getSelection()?.anchor ?? hitResult.point)
				: hitResult.point;
			lastMouseYRef.current = e.clientY;

			startDragAutoScroll();
			focusTextarea();
		},
		[
			editor,
			hitTestAt,
			focusTextarea,
			selectWordAt,
			selectParagraphAt,
			startDragAutoScroll,
			layout,
			zoom,
			readOnly,
			hfEditing,
		],
	);

	// Global mousemove / mouseup listeners during drag
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingRef.current || !dragAnchorRef.current) return;

			lastMouseYRef.current = e.clientY;

			const hitResult = hitTestAt(e.clientX, e.clientY);
			if (hitResult?.point) {
				editor.setSelection({
					anchor: dragAnchorRef.current,
					focus: hitResult.point,
				});
			}
		};

		const handleMouseUp = () => {
			isDraggingRef.current = false;
			dragAnchorRef.current = null;
			stopDragAutoScroll();
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			stopDragAutoScroll();
		};
	}, [editor, hitTestAt, stopDragAutoScroll]);

	// Handle scroll — computes visible page range for virtual scrolling
	const handleScroll = useCallback(() => {
		const container = containerRef.current;
		const renderer = rendererRef.current;
		if (!container || !renderer) return;

		scrollYRef.current = container.scrollTop;
		renderer.setScrollY(container.scrollTop);

		// Compute visible page range for efficient rendering
		const visiblePages = renderer.getVisiblePages();
		renderer.render({
			startPage: visiblePages.first,
			endPage: visiblePages.last,
		});

		// During drag, update selection as user scrolls (the visible content moves under the mouse)
		if (isDraggingRef.current && dragAnchorRef.current) {
			const hitResult = hitTestAt(lastClickPosRef.current.x, lastMouseYRef.current);
			if (hitResult?.point) {
				editor.setSelection({
					anchor: dragAnchorRef.current,
					focus: hitResult.point,
				});
			}
		}
	}, [editor, hitTestAt]);

	const totalHeight = rendererRef.current?.getTotalHeight() ?? 0;

	/** Visually hidden style for screen-reader-only elements */
	const srOnlyStyle: React.CSSProperties = {
		position: 'absolute',
		width: 1,
		height: 1,
		padding: 0,
		margin: -1,
		overflow: 'hidden',
		clip: 'rect(0, 0, 0, 0)',
		whiteSpace: 'nowrap',
		border: 0,
	};

	return (
		<div
			ref={containerRef}
			aria-label="Document editor"
			aria-describedby={srStatusId}
			onScroll={handleScroll}
			onMouseDown={(e) => {
				// Click on gray area (outside canvas) also focuses the textarea
				if (e.target === containerRef.current) {
					e.preventDefault();
					focusTextarea();
				}
			}}
			onContextMenu={onContextMenu}
			style={{
				position: 'relative',
				flex: 1,
				overflow: 'auto',
				backgroundColor: '#f9fbfd',
				cursor: 'text',
			}}
		>
			<canvas
				ref={canvasRef}
				onMouseDown={handleMouseDown}
				onContextMenu={onContextMenu}
				style={{
					position: 'sticky',
					top: 0,
					left: 0,
					display: 'block',
				}}
			/>
			{/* Spacer div to provide scrollable height */}
			{totalHeight > 0 && (
				<div
					aria-hidden="true"
					style={{
						height: totalHeight,
						position: 'absolute',
						top: 0,
						left: 0,
						width: 1,
						pointerEvents: 'none',
					}}
				/>
			)}
			{/* Hidden textarea for keyboard input */}
			{!readOnly && (
				<textarea
					ref={textareaRef}
					aria-label="Editor input"
					autoCapitalize="off"
					autoCorrect="off"
					autoComplete="off"
					spellCheck={false}
					tabIndex={0}
					style={{
						position: 'absolute',
						top: -9999,
						left: -9999,
						width: 1,
						height: 1,
						opacity: 0,
						padding: 0,
						border: 'none',
						outline: 'none',
						resize: 'none',
						overflow: 'hidden',
					}}
				/>
			)}
			{/* Screen reader: cursor position announcements */}
			<div
				ref={srStatusRef}
				id={srStatusId}
				role="status"
				aria-live="polite"
				aria-atomic="true"
				style={srOnlyStyle}
			/>
			{/* Screen reader: error/alert announcements */}
			<div
				id={srAlertId}
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
				style={srOnlyStyle}
			/>
		</div>
	);
}
