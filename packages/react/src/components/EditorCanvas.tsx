'use client';

import { InputManager } from '@jpoffice/engine';
import type { JPEditor } from '@jpoffice/engine';
import type { LayoutResult } from '@jpoffice/layout';
import type { JPSelection } from '@jpoffice/model';
import { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef } from 'react';

export interface EditorCanvasProps {
	editor: JPEditor;
	layout: LayoutResult | null;
	selection: JPSelection;
	readOnly?: boolean;
}

export function EditorCanvas({ editor, layout, selection, readOnly }: EditorCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const rendererRef = useRef<CanvasRenderer | null>(null);
	const inputManagerRef = useRef<InputManager | null>(null);
	const scrollYRef = useRef(0);

	// Initialize renderer and input manager
	useEffect(() => {
		const canvas = canvasRef.current;
		const textarea = textareaRef.current;
		if (!canvas) return;

		const renderer = new CanvasRenderer();
		renderer.attach(canvas);
		rendererRef.current = renderer;

		if (textarea && !readOnly) {
			const inputManager = new InputManager(editor);
			inputManager.attach(textarea);
			inputManagerRef.current = inputManager;
		}

		return () => {
			renderer.destroy();
			rendererRef.current = null;
			if (inputManagerRef.current) {
				inputManagerRef.current.detach();
				inputManagerRef.current = null;
			}
		};
	}, [editor, readOnly]);

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

		// Initial size
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

	// Update selection and re-render
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.setSelection(selection);
		renderer.render();
	}, [selection]);

	// Handle mouse click → hit test → set selection
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const renderer = rendererRef.current;
			if (!renderer) return;

			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const hitResult = renderer.hitTest(x, y);
			if (hitResult?.point) {
				editor.setSelection({
					anchor: hitResult.point,
					focus: hitResult.point,
				});
			}

			// Focus the hidden textarea for keyboard capture
			textareaRef.current?.focus();
		},
		[editor],
	);

	// Handle scroll
	const handleScroll = useCallback(() => {
		const container = containerRef.current;
		const renderer = rendererRef.current;
		if (!container || !renderer) return;

		scrollYRef.current = container.scrollTop;
		renderer.setScrollY(container.scrollTop);
		renderer.render();
	}, []);

	const totalHeight = rendererRef.current?.getTotalHeight() ?? 0;

	return (
		<div
			ref={containerRef}
			onScroll={handleScroll}
			style={{
				position: 'relative',
				flex: 1,
				overflow: 'auto',
				backgroundColor: '#f0f0f0',
			}}
		>
			<canvas
				ref={canvasRef}
				onMouseDown={handleMouseDown}
				style={{
					position: 'sticky',
					top: 0,
					left: 0,
					display: 'block',
					cursor: 'text',
				}}
			/>
			{/* Spacer div to provide scrollable height */}
			{totalHeight > 0 && (
				<div
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
		</div>
	);
}
