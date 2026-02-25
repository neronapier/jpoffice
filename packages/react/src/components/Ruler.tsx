'use client';

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

export interface RulerProps {
	pageWidth: number; // px
	marginLeft: number; // px
	marginRight: number; // px
	indentLeft?: number; // px (relative to margin)
	indentRight?: number; // px (relative to margin)
	indentFirstLine?: number; // px (relative to left indent)
	unit?: 'cm' | 'in';
	className?: string;
	style?: CSSProperties;
	/** Called when a margin boundary is dragged. Values in px from page edge. */
	onMarginLeftChange?: (px: number) => void;
	onMarginRightChange?: (px: number) => void;
	/** Called when an indent marker is dragged. Values in px relative to margin. */
	onIndentLeftChange?: (px: number) => void;
	onIndentRightChange?: (px: number) => void;
	onIndentFirstLineChange?: (px: number) => void;
}

const RULER_HEIGHT = 24;
const PX_PER_IN = 96;
const PX_PER_CM = PX_PER_IN / 2.54;
const MARKER_SIZE = 6;
const MARKER_HIT = 10;
/** Minimum margin from page edge in px (~0.3 in) */
const MIN_MARGIN = 28;
/** Minimum content area width in px (~1 in) */
const MIN_CONTENT = 96;

type DragTarget = 'marginLeft' | 'marginRight' | 'indentLeft' | 'indentRight' | 'firstLine' | null;

const rulerStyle: CSSProperties = {
	position: 'relative',
	backgroundColor: '#fff',
	borderBottom: '1px solid #dadce0',
	overflow: 'hidden',
	userSelect: 'none',
	flexShrink: 0,
};

/**
 * Horizontal ruler with draggable margin boundaries and indent markers.
 *
 * - **Margin handles** (gray/white boundary): control the page margins,
 *   affecting the rendering width of text on ALL pages in the section.
 * - **Indent markers** (blue triangles): control paragraph indentation
 *   within the margins for the current paragraph.
 */
export function Ruler({
	pageWidth,
	marginLeft,
	marginRight,
	indentLeft = 0,
	indentRight = 0,
	indentFirstLine = 0,
	unit = 'cm',
	className,
	style,
	onMarginLeftChange,
	onMarginRightChange,
	onIndentLeftChange,
	onIndentRightChange,
	onIndentFirstLineChange,
}: RulerProps) {
	const pxPerUnit = unit === 'cm' ? PX_PER_CM : PX_PER_IN;
	const unitLabel = unit === 'cm' ? 'cm' : 'in';
	const minorStep = unit === 'cm' ? PX_PER_CM / 2 : PX_PER_IN / 4;

	const svgRef = useRef<SVGSVGElement>(null);
	const [dragTarget, setDragTarget] = useState<DragTarget>(null);
	const dragStartXRef = useRef(0);
	const dragStartValRef = useRef(0);

	// Live values while dragging
	const [liveMarginLeft, setLiveMarginLeft] = useState(marginLeft);
	const [liveMarginRight, setLiveMarginRight] = useState(marginRight);
	const [liveIndentLeft, setLiveIndentLeft] = useState(indentLeft);
	const [liveIndentRight, setLiveIndentRight] = useState(indentRight);
	const [liveFirstLine, setLiveFirstLine] = useState(indentFirstLine);

	// Display values: use live while dragging, props otherwise
	const mL = dragTarget === 'marginLeft' ? liveMarginLeft : marginLeft;
	const mR = dragTarget === 'marginRight' ? liveMarginRight : marginRight;
	const iL = dragTarget === 'indentLeft' ? liveIndentLeft : indentLeft;
	const iR = dragTarget === 'indentRight' ? liveIndentRight : indentRight;
	const iFL = dragTarget === 'firstLine' ? liveFirstLine : indentFirstLine;

	const contentWidth = pageWidth - mL - mR;

	// Tick marks
	const marks = useMemo(() => {
		const result: { x: number; major: boolean; label?: string }[] = [];
		const totalUnits = Math.ceil(pageWidth / pxPerUnit);
		for (let i = 0; i <= totalUnits * (unit === 'cm' ? 2 : 4); i++) {
			const x = i * minorStep;
			if (x > pageWidth) break;
			const isMajor = unit === 'cm' ? i % 2 === 0 : i % 4 === 0;
			const unitNum = unit === 'cm' ? i / 2 : i / 4;
			result.push({
				x,
				major: isMajor,
				label: isMajor && unitNum > 0 ? String(unitNum) : undefined,
			});
		}
		return result;
	}, [pageWidth, pxPerUnit, unit, minorStep]);

	const clientToSvgX = useCallback((clientX: number): number => {
		const svg = svgRef.current;
		if (!svg) return 0;
		const rect = svg.getBoundingClientRect();
		return clientX - rect.left;
	}, []);

	// ── Pointer handlers ────────────────────────────────────

	const beginDrag = useCallback(
		(target: DragTarget) => (e: ReactPointerEvent<SVGElement>) => {
			e.preventDefault();
			e.stopPropagation();
			(e.target as SVGElement).setPointerCapture(e.pointerId);

			const svgX = clientToSvgX(e.clientX);
			dragStartXRef.current = svgX;
			setDragTarget(target);

			switch (target) {
				case 'marginLeft':
					dragStartValRef.current = marginLeft;
					setLiveMarginLeft(marginLeft);
					break;
				case 'marginRight':
					dragStartValRef.current = marginRight;
					setLiveMarginRight(marginRight);
					break;
				case 'indentLeft':
					dragStartValRef.current = indentLeft;
					setLiveIndentLeft(indentLeft);
					break;
				case 'indentRight':
					dragStartValRef.current = indentRight;
					setLiveIndentRight(indentRight);
					break;
				case 'firstLine':
					dragStartValRef.current = indentFirstLine;
					setLiveFirstLine(indentFirstLine);
					break;
			}
		},
		[clientToSvgX, marginLeft, marginRight, indentLeft, indentRight, indentFirstLine],
	);

	const onPointerMove = useCallback(
		(e: ReactPointerEvent<SVGSVGElement>) => {
			if (!dragTarget) return;
			const svgX = clientToSvgX(e.clientX);
			const delta = svgX - dragStartXRef.current;
			const start = dragStartValRef.current;

			switch (dragTarget) {
				case 'marginLeft': {
					const maxLeft = pageWidth - mR - MIN_CONTENT;
					setLiveMarginLeft(Math.max(MIN_MARGIN, Math.min(maxLeft, start + delta)));
					break;
				}
				case 'marginRight': {
					const maxRight = pageWidth - mL - MIN_CONTENT;
					setLiveMarginRight(Math.max(MIN_MARGIN, Math.min(maxRight, start - delta)));
					break;
				}
				case 'indentLeft': {
					const max = contentWidth - iR;
					setLiveIndentLeft(Math.max(0, Math.min(max, start + delta)));
					break;
				}
				case 'indentRight': {
					const max = contentWidth - iL;
					setLiveIndentRight(Math.max(0, Math.min(max, start - delta)));
					break;
				}
				case 'firstLine': {
					const min = -iL;
					const max = contentWidth - iL - iR;
					setLiveFirstLine(Math.max(min, Math.min(max, start + delta)));
					break;
				}
			}
		},
		[dragTarget, clientToSvgX, pageWidth, mL, mR, contentWidth, iL, iR],
	);

	const onPointerUp = useCallback(
		(e: ReactPointerEvent<SVGSVGElement>) => {
			if (!dragTarget) return;
			try {
				(e.target as SVGElement).releasePointerCapture?.(e.pointerId);
			} catch {
				/* ignore */
			}

			switch (dragTarget) {
				case 'marginLeft':
					onMarginLeftChange?.(liveMarginLeft);
					break;
				case 'marginRight':
					onMarginRightChange?.(liveMarginRight);
					break;
				case 'indentLeft':
					onIndentLeftChange?.(liveIndentLeft);
					break;
				case 'indentRight':
					onIndentRightChange?.(liveIndentRight);
					break;
				case 'firstLine':
					onIndentFirstLineChange?.(liveFirstLine);
					break;
			}
			setDragTarget(null);
		},
		[
			dragTarget,
			liveMarginLeft,
			liveMarginRight,
			liveIndentLeft,
			liveIndentRight,
			liveFirstLine,
			onMarginLeftChange,
			onMarginRightChange,
			onIndentLeftChange,
			onIndentRightChange,
			onIndentFirstLineChange,
		],
	);

	// ── Computed positions ───────────────────────────────────

	const leftIndentX = mL + iL;
	const firstLineX = mL + iL + iFL;
	const rightIndentX = pageWidth - mR - iR;

	const isDragging = dragTarget !== null;
	const grabCursor = isDragging ? 'grabbing' : 'grab';
	const marginCursor = isDragging ? 'ew-resize' : 'ew-resize';

	// Guide line X for current drag
	let guideX: number | null = null;
	if (dragTarget === 'marginLeft') guideX = mL;
	else if (dragTarget === 'marginRight') guideX = pageWidth - mR;
	else if (dragTarget === 'indentLeft') guideX = leftIndentX;
	else if (dragTarget === 'indentRight') guideX = rightIndentX;
	else if (dragTarget === 'firstLine') guideX = firstLineX;

	return (
		<div className={className} style={{ ...rulerStyle, height: RULER_HEIGHT, ...style }}>
			<svg
				ref={svgRef}
				width={pageWidth}
				height={RULER_HEIGHT}
				style={{ display: 'block', margin: '0 auto' }}
				role="img"
				aria-label={`Ruler (${unitLabel})`}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			>
				{/* Left margin shading */}
				<rect x={0} y={0} width={mL} height={RULER_HEIGHT} fill="#e0e0e0" />
				{/* Right margin shading */}
				<rect x={pageWidth - mR} y={0} width={mR} height={RULER_HEIGHT} fill="#e0e0e0" />

				{/* Margin drag handles (the border between gray and white) */}
				{/* Left margin handle */}
				<rect
					x={mL - 3}
					y={0}
					width={6}
					height={RULER_HEIGHT}
					fill="transparent"
					style={{ cursor: marginCursor }}
					onPointerDown={beginDrag('marginLeft')}
				/>
				{/* Right margin handle */}
				<rect
					x={pageWidth - mR - 3}
					y={0}
					width={6}
					height={RULER_HEIGHT}
					fill="transparent"
					style={{ cursor: marginCursor }}
					onPointerDown={beginDrag('marginRight')}
				/>

				{/* Left margin edge line */}
				<line x1={mL} y1={0} x2={mL} y2={RULER_HEIGHT} stroke="#bbb" strokeWidth={1} />
				{/* Right margin edge line */}
				<line
					x1={pageWidth - mR}
					y1={0}
					x2={pageWidth - mR}
					y2={RULER_HEIGHT}
					stroke="#bbb"
					strokeWidth={1}
				/>

				{/* Tick marks */}
				{marks.map((mark) => (
					<g key={mark.x}>
						<line
							x1={mark.x}
							y1={mark.major ? 6 : 12}
							x2={mark.x}
							y2={RULER_HEIGHT}
							stroke="#999"
							strokeWidth={mark.major ? 1 : 0.5}
						/>
						{mark.label && (
							<text
								x={mark.x}
								y={10}
								textAnchor="middle"
								fontSize={9}
								fill="#666"
								fontFamily="system-ui, sans-serif"
							>
								{mark.label}
							</text>
						)}
					</g>
				))}

				{/* Drag guide line */}
				{guideX !== null && (
					<line
						x1={guideX}
						y1={0}
						x2={guideX}
						y2={RULER_HEIGHT}
						stroke={
							dragTarget === 'marginLeft' || dragTarget === 'marginRight' ? '#e53935' : '#4a90d9'
						}
						strokeWidth={1}
						strokeDasharray="2,2"
						opacity={0.7}
					/>
				)}

				{/* ── Indent markers (blue triangles) ────────────── */}

				{/* First line indent (top triangle) */}
				<polygon
					points={trianglePoints(firstLineX, 2, 'up')}
					fill={dragTarget === 'firstLine' ? '#2a70b9' : '#4a90d9'}
					opacity={dragTarget === 'firstLine' ? 1 : 0.85}
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('firstLine')}
				/>
				<rect
					x={firstLineX - MARKER_HIT}
					y={0}
					width={MARKER_HIT * 2}
					height={RULER_HEIGHT / 2}
					fill="transparent"
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('firstLine')}
				/>

				{/* Left indent (bottom triangle) */}
				<polygon
					points={trianglePoints(leftIndentX, RULER_HEIGHT - 2, 'down')}
					fill={dragTarget === 'indentLeft' ? '#2a70b9' : '#4a90d9'}
					opacity={dragTarget === 'indentLeft' ? 1 : 0.85}
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('indentLeft')}
				/>
				<rect
					x={leftIndentX - MARKER_HIT}
					y={RULER_HEIGHT / 2}
					width={MARKER_HIT * 2}
					height={RULER_HEIGHT / 2}
					fill="transparent"
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('indentLeft')}
				/>

				{/* Right indent (bottom triangle) */}
				<polygon
					points={trianglePoints(rightIndentX, RULER_HEIGHT - 2, 'down')}
					fill={dragTarget === 'indentRight' ? '#2a70b9' : '#4a90d9'}
					opacity={dragTarget === 'indentRight' ? 1 : 0.85}
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('indentRight')}
				/>
				<rect
					x={rightIndentX - MARKER_HIT}
					y={RULER_HEIGHT / 2}
					width={MARKER_HIT * 2}
					height={RULER_HEIGHT / 2}
					fill="transparent"
					style={{ cursor: grabCursor }}
					onPointerDown={beginDrag('indentRight')}
				/>
			</svg>
		</div>
	);
}

function trianglePoints(cx: number, cy: number, direction: 'up' | 'down'): string {
	const s = MARKER_SIZE;
	if (direction === 'down') {
		return `${cx - s},${cy - s} ${cx + s},${cy - s} ${cx},${cy}`;
	}
	return `${cx - s},${cy + s} ${cx + s},${cy + s} ${cx},${cy}`;
}
