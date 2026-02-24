'use client';

import type { JPEditor } from '@jpoffice/engine';
import { LayoutEngine } from '@jpoffice/layout';
import type { LayoutPage, LayoutResult } from '@jpoffice/layout';
import { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PrintPreviewState {
	readonly isOpen: boolean;
	readonly currentPage: number;
	readonly totalPages: number;
	readonly zoom: number;
	readonly pageImages: readonly string[];
	readonly loading: boolean;
}

export interface UsePrintPreviewReturn {
	state: PrintPreviewState;
	open: () => void;
	close: () => void;
	setPage: (page: number) => void;
	setZoom: (zoom: number) => void;
	print: () => void;
	renderPages: () => Promise<void>;
}

const INITIAL_STATE: PrintPreviewState = {
	isOpen: false,
	currentPage: 0,
	totalPages: 0,
	zoom: 1.0,
	pageImages: [],
	loading: false,
};

/**
 * Render a single layout page to a data URL image using an offscreen canvas.
 */
function renderPageToDataURL(page: LayoutPage, layoutResult: LayoutResult, dpr: number): string {
	const width = page.width;
	const height = page.height;

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);

	const renderer = new CanvasRenderer({ dpr });
	renderer.attach(canvas);
	renderer.resize(width, height);
	renderer.setLayout(layoutResult);
	renderer.setSelection(null);
	renderer.setScrollY(0);
	renderer.setZoom(1.0);

	// Render the specific page by temporarily constructing a layout result
	// with only this page, but we need to account for the page positioning.
	// Instead, we render directly by calling the renderer's page-level methods.
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		renderer.destroy();
		return '';
	}

	ctx.save();
	ctx.scale(dpr, dpr);

	// White background
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);

	// Render header
	if (page.header) {
		renderHeaderFooterBlocks(
			ctx,
			renderer,
			page.header.blocks,
			page.contentArea.x,
			page.header.rect.y,
		);
	}

	// Content blocks
	const contentX = page.contentArea.x;
	const contentY = page.contentArea.y;

	for (const block of page.blocks) {
		if ('lines' in block && Array.isArray(block.lines)) {
			// Paragraph
			for (const line of block.lines) {
				renderer.textRenderer.renderLine(
					ctx,
					line,
					contentX + block.rect.x,
					contentY + block.rect.y,
				);
			}
		} else if ('rows' in block) {
			// Table
			renderer.tableRenderer.renderTable(
				ctx,
				block as Parameters<typeof renderer.tableRenderer.renderTable>[1],
				contentX,
				contentY,
			);
		} else if ('src' in block) {
			// Image
			renderer.imageRenderer.renderImage(
				ctx,
				block as Parameters<typeof renderer.imageRenderer.renderImage>[1],
				contentX,
				contentY,
				() => {},
			);
		}
	}

	// Render behind-text and in-front-of-text floats
	if (page.floats) {
		for (const float of page.floats) {
			renderer.imageRenderer.renderImage(
				ctx,
				{
					kind: 'image',
					rect: { x: float.x, y: float.y, width: float.width, height: float.height },
					nodePath: [],
					src: float.src,
					mimeType: float.mimeType,
				},
				0,
				0,
				() => {},
			);
		}
	}

	// Render footer
	if (page.footer) {
		renderHeaderFooterBlocks(
			ctx,
			renderer,
			page.footer.blocks,
			page.contentArea.x,
			page.footer.rect.y,
		);
	}

	ctx.restore();

	const dataURL = canvas.toDataURL('image/png');
	renderer.destroy();
	return dataURL;
}

function renderHeaderFooterBlocks(
	ctx: CanvasRenderingContext2D,
	renderer: CanvasRenderer,
	blocks: readonly unknown[],
	offsetX: number,
	offsetY: number,
): void {
	for (const rawBlock of blocks) {
		const block = rawBlock as { lines?: unknown[]; rect: { x: number; y: number }; rows?: unknown };
		if (block.lines) {
			for (const line of block.lines) {
				renderer.textRenderer.renderLine(
					ctx,
					line as Parameters<typeof renderer.textRenderer.renderLine>[1],
					offsetX + block.rect.x,
					offsetY + block.rect.y,
				);
			}
		} else if (block.rows) {
			renderer.tableRenderer.renderTable(
				ctx,
				rawBlock as unknown as Parameters<typeof renderer.tableRenderer.renderTable>[1],
				offsetX,
				offsetY,
			);
		}
	}
}

/**
 * Hook for managing print preview state and rendering pages to images.
 */
export function usePrintPreview(editor: JPEditor | null): UsePrintPreviewReturn {
	const [state, setState] = useState<PrintPreviewState>(INITIAL_STATE);
	const layoutEngineRef = useRef<LayoutEngine | null>(null);
	const pageImageURLsRef = useRef<string[]>([]);

	// Cleanup data URLs on unmount
	useEffect(() => {
		return () => {
			for (const url of pageImageURLsRef.current) {
				URL.revokeObjectURL(url);
			}
			pageImageURLsRef.current = [];
		};
	}, []);

	const renderPages = useCallback(async () => {
		if (!editor) return;

		setState((prev) => ({ ...prev, loading: true }));

		// Small delay to let the loading state render
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});

		try {
			if (!layoutEngineRef.current) {
				layoutEngineRef.current = new LayoutEngine();
			}

			const doc = editor.getDocument();
			const layoutResult = layoutEngineRef.current.layout(doc);
			const pages = layoutResult.pages;
			const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

			const images: string[] = [];
			for (const page of pages) {
				const dataURL = renderPageToDataURL(page, layoutResult, dpr);
				images.push(dataURL);
			}

			// Clean up old URLs
			pageImageURLsRef.current = [];

			setState((prev) => ({
				...prev,
				totalPages: pages.length,
				pageImages: images,
				currentPage: prev.currentPage >= pages.length ? 0 : prev.currentPage,
				loading: false,
			}));
		} catch (err) {
			console.error('[JPOffice] Print preview render failed:', err);
			setState((prev) => ({ ...prev, loading: false }));
		}
	}, [editor]);

	const open = useCallback(() => {
		setState((prev) => ({
			...prev,
			isOpen: true,
			currentPage: 0,
			zoom: 1.0,
		}));
		// Render pages after opening
		renderPages();
	}, [renderPages]);

	const close = useCallback(() => {
		setState(INITIAL_STATE);
		pageImageURLsRef.current = [];
	}, []);

	const setPage = useCallback((page: number) => {
		setState((prev) => {
			const clamped = Math.max(0, Math.min(page, prev.totalPages - 1));
			return { ...prev, currentPage: clamped };
		});
	}, []);

	const setZoom = useCallback((zoom: number) => {
		const clamped = Math.max(0.5, Math.min(2.0, zoom));
		setState((prev) => ({ ...prev, zoom: clamped }));
	}, []);

	const print = useCallback(() => {
		if (state.pageImages.length === 0) return;

		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			console.warn('[JPOffice] Could not open print window. Check popup blocker.');
			return;
		}

		const imagesHtml = state.pageImages
			.map(
				(src) =>
					`<img src="${src}" style="display:block;max-width:100%;height:auto;page-break-after:always;margin:0 auto;" />`,
			)
			.join('\n');

		printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Print Preview</title>
<style>
@media print {
	body { margin: 0; padding: 0; }
	img { page-break-after: always; width: 100%; height: auto; }
	img:last-child { page-break-after: avoid; }
}
@media screen {
	body { margin: 0; padding: 0; background: #f0f0f0; }
	img { display: block; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
}
</style>
</head>
<body>
${imagesHtml}
</body>
</html>`);
		printWindow.document.close();

		// Give the images a moment to load then print
		printWindow.addEventListener('load', () => {
			printWindow.print();
		});
	}, [state.pageImages]);

	return {
		state,
		open,
		close,
		setPage,
		setZoom,
		print,
		renderPages,
	};
}
