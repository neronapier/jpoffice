import type { DragDropPlugin } from '@jpoffice/engine';
import type { JPEditor } from '@jpoffice/engine';
import type { JPPoint } from '@jpoffice/model';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hit-test function signature: given clientX/clientY, returns the document
 * point under the cursor, or null if outside the content area.
 */
export type HitTestFn = (clientX: number, clientY: number) => JPPoint | null;

export interface UseDragDropOptions {
	/** The JPEditor instance. */
	editor: JPEditor | null;
	/** Ref to the canvas element to attach drag events to. */
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	/** Hit-test function that converts client coordinates to document points. */
	hitTest: HitTestFn;
	/** Whether the editor is in read-only mode. */
	readOnly?: boolean;
}

export interface UseDragDropReturn {
	/** Whether a drag-and-drop operation is currently in progress over the canvas. */
	isDragging: boolean;
	/** The current drop position in client coordinates, or null. */
	dropPosition: { x: number; y: number } | null;
}

/**
 * React hook that manages drag-and-drop interactions on the editor canvas.
 *
 * Attaches dragenter, dragover, dragleave, and drop event listeners to the
 * canvas element. On drop, reads DataTransfer items (text/plain, text/html,
 * or image files) and dispatches appropriate editor commands via the
 * DragDropPlugin.
 */
export function useDragDrop({
	editor,
	canvasRef,
	hitTest,
	readOnly,
}: UseDragDropOptions): UseDragDropReturn {
	const [isDragging, setIsDragging] = useState(false);
	const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null);

	// Track drag enter/leave count to handle nested elements
	const dragCounterRef = useRef(0);

	// Keep refs to avoid stale closures
	const editorRef = useRef(editor);
	editorRef.current = editor;
	const hitTestRef = useRef(hitTest);
	hitTestRef.current = hitTest;
	const readOnlyRef = useRef(readOnly);
	readOnlyRef.current = readOnly;

	const getPlugin = useCallback((): DragDropPlugin | undefined => {
		return editorRef.current?.getPlugin('jpoffice.dragDrop') as DragDropPlugin | undefined;
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const handleDragEnter = (e: DragEvent) => {
			e.preventDefault();
			dragCounterRef.current++;
			if (dragCounterRef.current === 1) {
				setIsDragging(true);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
			if (readOnlyRef.current) return;

			// Set dropEffect based on whether Ctrl is held (copy vs move)
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = e.ctrlKey || e.metaKey ? 'copy' : 'move';
			}

			setDropPosition({ x: e.clientX, y: e.clientY });
		};

		const handleDragLeave = (e: DragEvent) => {
			e.preventDefault();
			dragCounterRef.current--;
			if (dragCounterRef.current <= 0) {
				dragCounterRef.current = 0;
				setIsDragging(false);
				setDropPosition(null);
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();

			// Reset drag state
			dragCounterRef.current = 0;
			setIsDragging(false);
			setDropPosition(null);

			const currentEditor = editorRef.current;
			if (!currentEditor || readOnlyRef.current) return;

			const dt = e.dataTransfer;
			if (!dt) return;

			// Hit-test to find drop position in document
			const point = hitTestRef.current(e.clientX, e.clientY);
			if (!point) return;

			// Check for image files first
			const files = Array.from(dt.files);
			const imageFile = files.find((f) => f.type.startsWith('image/'));

			if (imageFile) {
				const reader = new FileReader();
				reader.onload = () => {
					const dataUrl = reader.result as string;
					try {
						currentEditor.executeCommand('dragdrop.drop', {
							position: point,
							data: dataUrl,
							dataType: 'image',
							copy: true,
							mimeType: imageFile.type,
						});
					} catch {
						console.warn('[JPOffice] DragDrop: failed to handle image drop');
					}
				};
				reader.readAsDataURL(imageFile);
				return;
			}

			// Check for HTML content
			const html = dt.getData('text/html');
			if (html) {
				try {
					currentEditor.executeCommand('dragdrop.drop', {
						position: point,
						data: html,
						dataType: 'html',
						copy: e.ctrlKey || e.metaKey,
					});
				} catch {
					console.warn('[JPOffice] DragDrop: failed to handle HTML drop');
				}
				return;
			}

			// Plain text fallback
			const text = dt.getData('text/plain');
			if (text) {
				const plugin = getPlugin();
				const isInternal = plugin?.isDragging() ?? false;
				const copy = e.ctrlKey || e.metaKey;

				try {
					if (isInternal) {
						// Internal drag: startDrag was already called
						currentEditor.executeCommand('dragdrop.drop', {
							position: point,
							data: text,
							dataType: 'text',
							copy,
						});
					} else {
						// External text drop
						currentEditor.executeCommand('dragdrop.drop', {
							position: point,
							data: text,
							dataType: 'text',
							copy: true, // external drops are always "copy"
						});
					}
				} catch {
					console.warn('[JPOffice] DragDrop: failed to handle text drop');
				}
			}
		};

		canvas.addEventListener('dragenter', handleDragEnter);
		canvas.addEventListener('dragover', handleDragOver);
		canvas.addEventListener('dragleave', handleDragLeave);
		canvas.addEventListener('drop', handleDrop);

		return () => {
			canvas.removeEventListener('dragenter', handleDragEnter);
			canvas.removeEventListener('dragover', handleDragOver);
			canvas.removeEventListener('dragleave', handleDragLeave);
			canvas.removeEventListener('drop', handleDrop);
			dragCounterRef.current = 0;
		};
	}, [canvasRef, getPlugin]);

	return { isDragging, dropPosition };
}
