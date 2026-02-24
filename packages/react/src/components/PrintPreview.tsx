'use client';

import type { JPEditor } from '@jpoffice/engine';
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { usePrintPreview } from '../hooks/usePrintPreview';

export interface PrintPreviewProps {
	editor: JPEditor;
	onClose: () => void;
}

// ── Styles ──────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
	position: 'fixed',
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	zIndex: 10000,
	display: 'flex',
	flexDirection: 'column',
	backgroundColor: 'rgba(0, 0, 0, 0.7)',
	fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const toolbarStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	height: 48,
	minHeight: 48,
	backgroundColor: '#323232',
	color: '#ffffff',
	padding: '0 12px',
	gap: 8,
	flexShrink: 0,
	userSelect: 'none',
};

const toolbarGroupStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
};

const toolbarButtonStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 32,
	height: 32,
	border: 'none',
	borderRadius: 4,
	backgroundColor: 'transparent',
	color: '#ffffff',
	cursor: 'pointer',
	fontSize: 16,
	padding: 0,
};

const toolbarButtonHoverBg = 'rgba(255, 255, 255, 0.15)';

const printButtonStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	height: 32,
	border: 'none',
	borderRadius: 4,
	backgroundColor: '#1a73e8',
	color: '#ffffff',
	cursor: 'pointer',
	fontSize: 13,
	fontWeight: 600,
	padding: '0 16px',
	gap: 6,
};

const contentAreaStyle: CSSProperties = {
	flex: 1,
	display: 'flex',
	overflow: 'hidden',
};

const sidebarStyle: CSSProperties = {
	width: 160,
	minWidth: 160,
	backgroundColor: '#2a2a2a',
	overflowY: 'auto',
	overflowX: 'hidden',
	padding: '12px 8px',
	display: 'flex',
	flexDirection: 'column',
	gap: 8,
	borderRight: '1px solid #444',
};

const thumbnailButtonStyle = (isActive: boolean): CSSProperties => ({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	gap: 4,
	cursor: 'pointer',
	padding: 4,
	borderRadius: 4,
	border: isActive ? '2px solid #1a73e8' : '2px solid transparent',
	backgroundColor: isActive ? 'rgba(26, 115, 232, 0.1)' : 'transparent',
	width: '100%',
	font: 'inherit',
	color: 'inherit',
});

const thumbnailImageStyle: CSSProperties = {
	width: '100%',
	height: 'auto',
	display: 'block',
	boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
	borderRadius: 2,
	backgroundColor: '#ffffff',
};

const thumbnailLabelStyle: CSSProperties = {
	color: '#aaa',
	fontSize: 11,
	textAlign: 'center',
};

const mainViewStyle: CSSProperties = {
	flex: 1,
	overflow: 'auto',
	display: 'flex',
	alignItems: 'flex-start',
	justifyContent: 'center',
	padding: '24px 16px',
};

const pageContainerStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	gap: 16,
};

const pageImageStyle: CSSProperties = {
	display: 'block',
	boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
	borderRadius: 2,
	backgroundColor: '#ffffff',
};

const spinnerContainerStyle: CSSProperties = {
	display: 'flex',
	flex: 1,
	alignItems: 'center',
	justifyContent: 'center',
	color: '#ffffff',
	fontSize: 16,
	gap: 12,
};

const zoomLabelStyle: CSSProperties = {
	color: '#ffffff',
	fontSize: 13,
	minWidth: 44,
	textAlign: 'center',
};

const pageNavLabelStyle: CSSProperties = {
	color: '#ffffff',
	fontSize: 13,
	whiteSpace: 'nowrap',
};

// ── SVG Icons ───────────────────────────────────────────────

function CloseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M4 4L12 12M12 4L4 12"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function ChevronLeftIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M10 3L5 8L10 13"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ChevronRightIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M6 3L11 8L6 13"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ZoomOutIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
			<path d="M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

function ZoomInIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
			<path d="M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<path d="M7 5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

function PrintIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<rect x="4" y="1" width="8" height="4" stroke="currentColor" strokeWidth="1.2" />
			<rect x="2" y="5" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
			<rect x="4" y="9" width="8" height="5" stroke="currentColor" strokeWidth="1.2" fill="white" />
			<line x1="6" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1" />
			<line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

function Spinner() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			style={{ animation: 'jpoffice-pp-spin 1s linear infinite' }}
		>
			<circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
			<path d="M12 2a10 10 0 019.8 8" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
		</svg>
	);
}

// ── ToolbarButton ───────────────────────────────────────────

function ToolbarButton({
	onClick,
	title,
	disabled,
	children,
}: {
	onClick: () => void;
	title: string;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		if (!e.currentTarget.disabled) {
			e.currentTarget.style.backgroundColor = toolbarButtonHoverBg;
		}
	}, []);

	const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		e.currentTarget.style.backgroundColor = 'transparent';
	}, []);

	return (
		<button
			type="button"
			style={{
				...toolbarButtonStyle,
				opacity: disabled ? 0.4 : 1,
				cursor: disabled ? 'default' : 'pointer',
			}}
			onClick={onClick}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			title={title}
			disabled={disabled}
			aria-label={title}
		>
			{children}
		</button>
	);
}

// ── PrintPreview Component ──────────────────────────────────

export function PrintPreview({ editor, onClose }: PrintPreviewProps) {
	const { state, close, setPage, setZoom, print, renderPages } = usePrintPreview(editor);
	const mainViewRef = useRef<HTMLDivElement>(null);
	const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

	// Open the print preview on mount
	useEffect(() => {
		renderPages();
	}, [renderPages]);

	// Internal close handler that syncs hook state and notifies parent
	const handleClose = useCallback(() => {
		close();
		onClose();
	}, [close, onClose]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'Escape':
					e.preventDefault();
					handleClose();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					setPage(state.currentPage - 1);
					break;
				case 'ArrowRight':
					e.preventDefault();
					setPage(state.currentPage + 1);
					break;
				case '+':
				case '=':
					e.preventDefault();
					setZoom(state.zoom + 0.25);
					break;
				case '-':
					e.preventDefault();
					setZoom(state.zoom - 0.25);
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleClose, setPage, setZoom, state.currentPage, state.zoom]);

	// Scroll to current page in main view when page changes
	useEffect(() => {
		if (mainViewRef.current && state.pageImages.length > 0) {
			const pageElements = mainViewRef.current.querySelectorAll('[data-page-index]');
			const target = pageElements[state.currentPage];
			if (target) {
				target.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
		// Scroll thumbnail into view
		const thumbEl = thumbnailRefs.current.get(state.currentPage);
		if (thumbEl) {
			thumbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, [state.currentPage, state.pageImages.length]);

	const handlePrintButtonHover = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		e.currentTarget.style.backgroundColor = '#1557b0';
	}, []);

	const handlePrintButtonLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		e.currentTarget.style.backgroundColor = '#1a73e8';
	}, []);

	const handleThumbnailRef = useCallback((index: number, el: HTMLButtonElement | null) => {
		if (el) {
			thumbnailRefs.current.set(index, el);
		} else {
			thumbnailRefs.current.delete(index);
		}
	}, []);

	const handlePageImageKeyDown = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				setPage(index);
			}
		},
		[setPage],
	);

	const zoomPercent = Math.round(state.zoom * 100);

	return (
		<dialog open style={overlayStyle} aria-label="Print Preview">
			{/* CSS animation for spinner */}
			<style>
				{
					'@keyframes jpoffice-pp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
				}
			</style>

			{/* Top toolbar */}
			<div style={toolbarStyle}>
				{/* Left: Close */}
				<div style={toolbarGroupStyle}>
					<ToolbarButton onClick={handleClose} title="Close (Escape)">
						<CloseIcon />
					</ToolbarButton>
					<span style={{ color: '#ccc', fontSize: 14, fontWeight: 500 }}>Print Preview</span>
				</div>

				{/* Center: Page navigation + Zoom */}
				<div style={toolbarGroupStyle}>
					<ToolbarButton
						onClick={() => setPage(state.currentPage - 1)}
						title="Previous page"
						disabled={state.currentPage <= 0}
					>
						<ChevronLeftIcon />
					</ToolbarButton>
					<span style={pageNavLabelStyle}>
						Page {state.totalPages > 0 ? state.currentPage + 1 : 0} of {state.totalPages}
					</span>
					<ToolbarButton
						onClick={() => setPage(state.currentPage + 1)}
						title="Next page"
						disabled={state.currentPage >= state.totalPages - 1}
					>
						<ChevronRightIcon />
					</ToolbarButton>

					{/* Separator */}
					<div
						style={{
							width: 1,
							height: 24,
							backgroundColor: '#555',
							margin: '0 4px',
						}}
					/>

					<ToolbarButton
						onClick={() => setZoom(state.zoom - 0.25)}
						title="Zoom out (-)"
						disabled={state.zoom <= 0.5}
					>
						<ZoomOutIcon />
					</ToolbarButton>
					<span style={zoomLabelStyle}>{zoomPercent}%</span>
					<ToolbarButton
						onClick={() => setZoom(state.zoom + 0.25)}
						title="Zoom in (+)"
						disabled={state.zoom >= 2.0}
					>
						<ZoomInIcon />
					</ToolbarButton>
				</div>

				{/* Right: Print */}
				<div style={toolbarGroupStyle}>
					<button
						type="button"
						style={{
							...printButtonStyle,
							opacity: state.loading || state.pageImages.length === 0 ? 0.6 : 1,
						}}
						onClick={print}
						onMouseEnter={handlePrintButtonHover}
						onMouseLeave={handlePrintButtonLeave}
						disabled={state.loading || state.pageImages.length === 0}
						title="Print"
						aria-label="Print document"
					>
						<PrintIcon />
						Print
					</button>
				</div>
			</div>

			{/* Content: Sidebar + Main view */}
			<div style={contentAreaStyle}>
				{/* Thumbnail sidebar */}
				{state.pageImages.length > 0 && (
					<nav style={sidebarStyle} aria-label="Page thumbnails">
						{state.pageImages.map((src, index) => (
							<button
								type="button"
								key={`page-thumb-${String(index)}`}
								ref={(el) => handleThumbnailRef(index, el)}
								style={thumbnailButtonStyle(index === state.currentPage)}
								onClick={() => setPage(index)}
								aria-label={`Go to page ${index + 1}`}
								aria-current={index === state.currentPage ? 'page' : undefined}
							>
								<img
									src={src}
									alt={`Page ${index + 1} thumbnail`}
									style={thumbnailImageStyle}
									draggable={false}
								/>
								<span style={thumbnailLabelStyle}>{index + 1}</span>
							</button>
						))}
					</nav>
				)}

				{/* Main page view */}
				{state.loading ? (
					<div style={spinnerContainerStyle}>
						<Spinner />
						<span>Rendering pages...</span>
					</div>
				) : (
					<div style={mainViewStyle} ref={mainViewRef}>
						{state.pageImages.length > 0 && (
							<div style={pageContainerStyle}>
								{state.pageImages.map((src, index) => (
									<img
										key={`page-img-${String(index)}`}
										data-page-index={index}
										src={src}
										alt={`Page ${index + 1}`}
										style={{
											...pageImageStyle,
											width: `calc(${String(state.zoom * 100)}%)`,
											maxWidth: state.zoom > 1 ? 'none' : '100%',
											height: 'auto',
											transformOrigin: 'top center',
										}}
										draggable={false}
										onClick={() => setPage(index)}
										onKeyDown={(e) => handlePageImageKeyDown(e, index)}
									/>
								))}
							</div>
						)}
						{state.pageImages.length === 0 && !state.loading && (
							<div style={spinnerContainerStyle}>
								<span>No pages to display</span>
							</div>
						)}
					</div>
				)}
			</div>
		</dialog>
	);
}
