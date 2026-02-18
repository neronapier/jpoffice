'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';

export interface RulerProps {
	pageWidth: number; // px
	marginLeft: number; // px
	marginRight: number; // px
	indentLeft?: number; // px
	indentRight?: number; // px
	indentFirstLine?: number; // px
	unit?: 'cm' | 'in';
	className?: string;
	style?: CSSProperties;
}

const RULER_HEIGHT = 24;
const PX_PER_IN = 96;
const PX_PER_CM = PX_PER_IN / 2.54;

const rulerStyle: CSSProperties = {
	position: 'relative',
	backgroundColor: '#f8f8f8',
	borderBottom: '1px solid #ddd',
	overflow: 'hidden',
	userSelect: 'none',
	flexShrink: 0,
};

/**
 * Horizontal ruler component with measurement marks and margin indicators.
 * Rendered as inline SVG for accessibility and CSS styling.
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
}: RulerProps) {
	const pxPerUnit = unit === 'cm' ? PX_PER_CM : PX_PER_IN;
	const unitLabel = unit === 'cm' ? 'cm' : 'in';
	const minorStep = unit === 'cm' ? PX_PER_CM / 2 : PX_PER_IN / 4;

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

	return (
		<div className={className} style={{ ...rulerStyle, height: RULER_HEIGHT, ...style }}>
			<svg
				width={pageWidth}
				height={RULER_HEIGHT}
				style={{ display: 'block', margin: '0 auto' }}
				role="img"
				aria-label={`Ruler (${unitLabel})`}
			>
				{/* Margin shading */}
				<rect x={0} y={0} width={marginLeft} height={RULER_HEIGHT} fill="#e8e8e8" />
				<rect
					x={pageWidth - marginRight}
					y={0}
					width={marginRight}
					height={RULER_HEIGHT}
					fill="#e8e8e8"
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

				{/* Indent markers (triangles) */}
				{/* Left indent marker (bottom triangle) */}
				<polygon
					points={trianglePoints(marginLeft + indentLeft, RULER_HEIGHT - 2, 'down')}
					fill="#4a90d9"
					opacity={0.8}
				/>
				{/* First line indent marker (top triangle) */}
				<polygon
					points={trianglePoints(marginLeft + indentFirstLine, 2, 'up')}
					fill="#4a90d9"
					opacity={0.8}
				/>
				{/* Right indent marker */}
				<polygon
					points={trianglePoints(pageWidth - marginRight - indentRight, RULER_HEIGHT - 2, 'down')}
					fill="#4a90d9"
					opacity={0.8}
				/>
			</svg>
		</div>
	);
}

function trianglePoints(cx: number, cy: number, direction: 'up' | 'down'): string {
	const size = 5;
	if (direction === 'down') {
		return `${cx - size},${cy - size} ${cx + size},${cy - size} ${cx},${cy}`;
	}
	return `${cx - size},${cy + size} ${cx + size},${cy + size} ${cx},${cy}`;
}
