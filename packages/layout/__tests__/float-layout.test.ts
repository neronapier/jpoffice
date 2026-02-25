import { describe, expect, it } from 'vitest';
import { getLineExclusions, isBlockedByFloat, positionFloats } from '../src/float-layout';
import type { FloatingItem, PositionedFloat } from '../src/float-layout';
import type { LayoutRect } from '../src/types';

const pageContentRect: LayoutRect = {
	x: 72,
	y: 72,
	width: 468,
	height: 648,
};

function makeFloatingItem(overrides: Partial<FloatingItem> = {}): FloatingItem {
	return {
		nodeId: 'float-1',
		imageNodeId: 'img-1',
		imagePath: [0, 0, 0, 0],
		src: 'test.png',
		mimeType: 'image/png',
		widthPx: 100,
		heightPx: 80,
		drawingProps: {
			positioning: 'floating',
			floating: {
				horizontalPosition: {
					relativeTo: 'margin',
					offset: 0,
				},
				verticalPosition: {
					relativeTo: 'margin',
					offset: 0,
				},
				wrapping: { type: 'square', side: 'both' },
			},
		},
		anchorParagraphY: 100,
		...overrides,
	};
}

describe('positionFloats', () => {
	it('returns empty array for no items', () => {
		const result = positionFloats([], pageContentRect, 612, 792);
		expect(result).toEqual([]);
	});

	it('positions a float at margin offset', () => {
		const item = makeFloatingItem();
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(pageContentRect.x);
		expect(result[0].y).toBe(pageContentRect.y);
		expect(result[0].width).toBe(100);
		expect(result[0].height).toBe(80);
	});

	it('positions float with page-relative offset', () => {
		const item = makeFloatingItem({
			drawingProps: {
				positioning: 'floating',
				floating: {
					horizontalPosition: { relativeTo: 'page', offset: 914400 }, // 1 inch in EMU
					verticalPosition: { relativeTo: 'page', offset: 914400 },
					wrapping: { type: 'none' },
				},
			},
		});
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result).toHaveLength(1);
		// 914400 EMU = 96px
		expect(result[0].x).toBe(96);
		expect(result[0].y).toBe(96);
	});

	it('positions float with center alignment', () => {
		const item = makeFloatingItem({
			widthPx: 100,
			drawingProps: {
				positioning: 'floating',
				floating: {
					horizontalPosition: { relativeTo: 'page', align: 'center' },
					verticalPosition: { relativeTo: 'page', align: 'center' },
					wrapping: { type: 'none' },
				},
			},
		});
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result).toHaveLength(1);
		// Centered horizontally on page: (612 - 100) / 2 = 256
		expect(result[0].x).toBeCloseTo(256, 0);
	});

	it('clamps float to page bounds', () => {
		const item = makeFloatingItem({
			drawingProps: {
				positioning: 'floating',
				floating: {
					horizontalPosition: { relativeTo: 'page', offset: -914400 }, // negative
					verticalPosition: { relativeTo: 'page', offset: -914400 },
					wrapping: { type: 'none' },
				},
			},
		});
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result[0].x).toBeGreaterThanOrEqual(0);
		expect(result[0].y).toBeGreaterThanOrEqual(0);
	});

	it('sets behindText from floating properties', () => {
		const item = makeFloatingItem({
			drawingProps: {
				positioning: 'floating',
				floating: {
					horizontalPosition: { relativeTo: 'margin', offset: 0 },
					verticalPosition: { relativeTo: 'margin', offset: 0 },
					wrapping: { type: 'none' },
					behindText: true,
				},
			},
		});
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result[0].behindText).toBe(true);
	});

	it('skips items without floating properties', () => {
		const item: FloatingItem = {
			nodeId: 'float-1',
			imageNodeId: 'img-1',
			src: 'test.png',
			mimeType: 'image/png',
			widthPx: 100,
			heightPx: 80,
			drawingProps: { positioning: 'inline' },
			anchorParagraphY: 100,
		};
		const result = positionFloats([item], pageContentRect, 612, 792);
		expect(result).toHaveLength(0);
	});
});

describe('getLineExclusions', () => {
	it('returns unchanged bounds when no floats', () => {
		const { left, right } = getLineExclusions([], 100, 20, 72, 540);
		expect(left).toBe(72);
		expect(right).toBe(540);
	});

	it('returns unchanged bounds when float is not overlapping', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 200,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'square', side: 'both' },
		};
		// Line at y=100, height=20 doesn't overlap float at y=200
		const { left, right } = getLineExclusions([float], 100, 20, 72, 540);
		expect(left).toBe(72);
		expect(right).toBe(540);
	});

	it('adjusts left when float is on left side', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'square', side: 'left' },
		};
		const { left, right } = getLineExclusions([float], 100, 20, 72, 540);
		expect(left).toBe(172); // float.x + float.width
		expect(right).toBe(540);
	});

	it('adjusts right when float is on right side', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 400,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'square', side: 'right' },
		};
		const { left, right } = getLineExclusions([float], 100, 20, 72, 540);
		expect(left).toBe(72);
		expect(right).toBe(400); // float.x
	});

	it('ignores wrapping type none', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'none' },
		};
		const { left, right } = getLineExclusions([float], 100, 20, 72, 540);
		expect(left).toBe(72);
		expect(right).toBe(540);
	});
});

describe('isBlockedByFloat', () => {
	it('returns not blocked when no floats', () => {
		const result = isBlockedByFloat([], 100, 20);
		expect(result.blocked).toBe(false);
		expect(result.nextY).toBe(100);
	});

	it('returns not blocked for non-topAndBottom floats', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'square', side: 'both' },
		};
		const result = isBlockedByFloat([float], 100, 20);
		expect(result.blocked).toBe(false);
	});

	it('returns blocked for topAndBottom float overlap', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'topAndBottom' },
		};
		const result = isBlockedByFloat([float], 100, 20);
		expect(result.blocked).toBe(true);
		expect(result.nextY).toBe(170); // float.y + float.height
	});

	it('returns not blocked if line is below topAndBottom float', () => {
		const float: PositionedFloat = {
			nodeId: 'f1',
			imageNodeId: 'i1',
			imagePath: [0],
			x: 72,
			y: 90,
			width: 100,
			height: 80,
			src: 'test.png',
			mimeType: 'image/png',
			behindText: false,
			wrapping: { type: 'topAndBottom' },
		};
		const result = isBlockedByFloat([float], 200, 20);
		expect(result.blocked).toBe(false);
	});
});
