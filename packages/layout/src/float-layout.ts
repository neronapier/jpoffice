/**
 * Float layout: position floating images and compute
 * text wrapping exclusion zones.
 */

import type { JPDrawingProperties, JPWrapping } from '@jpoffice/model';
import { emuToPx } from '@jpoffice/model';
import type { LayoutRect } from './types';

// ============================================================
// Types
// ============================================================

export interface FloatingItem {
	readonly nodeId: string; // JPDrawing.id
	readonly imageNodeId: string; // JPImage.id
	readonly src: string;
	readonly mimeType: string;
	readonly widthPx: number;
	readonly heightPx: number;
	readonly drawingProps: JPDrawingProperties;
	readonly anchorParagraphY: number; // px Y of the anchor paragraph
}

export interface PositionedFloat {
	readonly nodeId: string;
	readonly imageNodeId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly src: string;
	readonly mimeType: string;
	readonly behindText: boolean;
	readonly wrapping: JPWrapping;
}

export interface ExclusionZone {
	readonly left: number; // px
	readonly right: number; // px
	readonly top: number; // px
	readonly bottom: number; // px
}

// ============================================================
// Float positioning
// ============================================================

/**
 * Position floating items on a page.
 */
export function positionFloats(
	items: readonly FloatingItem[],
	pageContentRect: LayoutRect,
	pageWidth: number,
	pageHeight: number,
): PositionedFloat[] {
	const result: PositionedFloat[] = [];

	for (const item of items) {
		const floating = item.drawingProps.floating;
		if (!floating) continue;

		// Resolve horizontal position
		const hPos = floating.horizontalPosition;
		let x: number;
		if (hPos.offset !== undefined) {
			const offsetPx = emuToPx(hPos.offset);
			x = getHorizontalBase(hPos.relativeTo, pageContentRect, pageWidth) + offsetPx;
		} else if (hPos.align) {
			const { start, width } = getHorizontalRange(hPos.relativeTo, pageContentRect, pageWidth);
			x = resolveAlign(hPos.align, start, width, item.widthPx);
		} else {
			x = pageContentRect.x;
		}

		// Resolve vertical position
		const vPos = floating.verticalPosition;
		let y: number;
		if (vPos.offset !== undefined) {
			const offsetPx = emuToPx(vPos.offset);
			y =
				getVerticalBase(vPos.relativeTo, pageContentRect, pageHeight, item.anchorParagraphY) +
				offsetPx;
		} else if (vPos.align) {
			const { start, height } = getVerticalRange(vPos.relativeTo, pageContentRect, pageHeight);
			y = resolveVerticalAlign(vPos.align, start, height, item.heightPx);
		} else {
			y = item.anchorParagraphY;
		}

		// Clamp to page bounds
		x = Math.max(0, Math.min(x, pageWidth - item.widthPx));
		y = Math.max(0, Math.min(y, pageHeight - item.heightPx));

		result.push({
			nodeId: item.nodeId,
			imageNodeId: item.imageNodeId,
			x,
			y,
			width: item.widthPx,
			height: item.heightPx,
			src: item.src,
			mimeType: item.mimeType,
			behindText: floating.behindText ?? false,
			wrapping: floating.wrapping,
		});
	}

	return result;
}

// ============================================================
// Exclusion zones for text wrapping
// ============================================================

/**
 * Compute exclusion zones that affect a text line.
 * Returns adjusted left/right bounds for the line.
 */
export function getLineExclusions(
	floats: readonly PositionedFloat[],
	lineY: number,
	lineHeight: number,
	contentLeft: number,
	contentRight: number,
): { left: number; right: number } {
	let left = contentLeft;
	let right = contentRight;

	for (const f of floats) {
		if (f.wrapping.type === 'none') continue;

		// Check vertical overlap
		const floatTop = f.y;
		const floatBottom = f.y + f.height;
		const lineTop = lineY;
		const lineBottom = lineY + lineHeight;

		if (lineBottom <= floatTop || lineTop >= floatBottom) continue;

		// The float overlaps this line vertically
		if (f.wrapping.type === 'topAndBottom') {
			// Text cannot appear beside this float at all
			// Push the entire line — handled by the caller by skipping this Y range
			continue;
		}

		const side =
			f.wrapping.type === 'square' || f.wrapping.type === 'tight' ? f.wrapping.side : 'both';

		if (side === 'left' || side === 'largest') {
			// Float is on the left side, text goes to the right
			left = Math.max(left, f.x + f.width);
		} else if (side === 'right') {
			// Float is on the right side, text goes to the left
			right = Math.min(right, f.x);
		} else {
			// 'both' — text wraps on both sides
			// Determine which side has more space
			const spaceLeft = f.x - contentLeft;
			const spaceRight = contentRight - (f.x + f.width);
			if (spaceRight > spaceLeft) {
				left = Math.max(left, f.x + f.width);
			} else {
				right = Math.min(right, f.x);
			}
		}
	}

	return { left, right };
}

/**
 * Check if a Y range is completely blocked by a topAndBottom float.
 */
export function isBlockedByFloat(
	floats: readonly PositionedFloat[],
	y: number,
	height: number,
): { blocked: boolean; nextY: number } {
	for (const f of floats) {
		if (f.wrapping.type !== 'topAndBottom') continue;

		const floatTop = f.y;
		const floatBottom = f.y + f.height;

		if (y < floatBottom && y + height > floatTop) {
			return { blocked: true, nextY: floatBottom };
		}
	}
	return { blocked: false, nextY: y };
}

// ============================================================
// Helpers
// ============================================================

function getHorizontalBase(
	relativeTo: string,
	contentRect: LayoutRect,
	_pageWidth: number,
): number {
	switch (relativeTo) {
		case 'page':
			return 0;
		case 'margin':
		case 'column':
			return contentRect.x;
		default:
			return contentRect.x;
	}
}

function getHorizontalRange(
	relativeTo: string,
	contentRect: LayoutRect,
	pageWidth: number,
): { start: number; width: number } {
	switch (relativeTo) {
		case 'page':
			return { start: 0, width: pageWidth };
		case 'margin':
		case 'column':
			return { start: contentRect.x, width: contentRect.width };
		default:
			return { start: contentRect.x, width: contentRect.width };
	}
}

function getVerticalBase(
	relativeTo: string,
	contentRect: LayoutRect,
	_pageHeight: number,
	anchorY: number,
): number {
	switch (relativeTo) {
		case 'page':
			return 0;
		case 'margin':
			return contentRect.y;
		case 'paragraph':
			return anchorY;
		default:
			return contentRect.y;
	}
}

function getVerticalRange(
	relativeTo: string,
	contentRect: LayoutRect,
	pageHeight: number,
): { start: number; height: number } {
	switch (relativeTo) {
		case 'page':
			return { start: 0, height: pageHeight };
		case 'margin':
			return { start: contentRect.y, height: contentRect.height };
		default:
			return { start: contentRect.y, height: contentRect.height };
	}
}

function resolveAlign(
	align: string,
	start: number,
	rangeWidth: number,
	objectWidth: number,
): number {
	switch (align) {
		case 'left':
		case 'inside':
			return start;
		case 'center':
			return start + (rangeWidth - objectWidth) / 2;
		case 'right':
		case 'outside':
			return start + rangeWidth - objectWidth;
		default:
			return start;
	}
}

function resolveVerticalAlign(
	align: string,
	start: number,
	rangeHeight: number,
	objectHeight: number,
): number {
	switch (align) {
		case 'top':
		case 'inside':
			return start;
		case 'center':
			return start + (rangeHeight - objectHeight) / 2;
		case 'bottom':
		case 'outside':
			return start + rangeHeight - objectHeight;
		default:
			return start;
	}
}
