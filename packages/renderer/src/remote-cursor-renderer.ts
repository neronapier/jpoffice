import type { LayoutPage } from '@jpoffice/layout';
import type { JPPath, JPPoint } from '@jpoffice/model';
import type { CursorPosition } from './cursor-renderer';

/**
 * Awareness state shape expected by the remote cursor renderer.
 * This mirrors the AwarenessState from @jpoffice/engine but is
 * defined locally to avoid a direct dependency on the engine package.
 */
export interface RemoteCursorInfo {
	readonly clientId: string;
	readonly name: string;
	readonly color: string;
	readonly cursor?: {
		readonly anchor: { readonly path: readonly number[]; readonly offset: number };
		readonly focus: { readonly path: readonly number[]; readonly offset: number };
	};
}

/**
 * Function type for resolving a document position to screen coordinates.
 * This is typically provided by CursorRenderer.findCursorPosition or a
 * similar mechanism that converts (path, offset) -> pixel position.
 */
export type PositionResolver = (
	page: LayoutPage,
	point: JPPoint,
	pageOffsetX: number,
	pageOffsetY: number,
) => CursorPosition | null;

/** Height of the name label in pixels. */
const LABEL_HEIGHT = 16;
/** Horizontal padding of the name label. */
const LABEL_PADDING_H = 4;
/** Font size for the name label. */
const LABEL_FONT_SIZE = 10;
/** Cursor line width in pixels. */
const CURSOR_WIDTH = 2;

/**
 * Draw remote user cursors and selections on the canvas.
 *
 * For each remote user that has a cursor within the given page,
 * this draws:
 * - A colored vertical line at the cursor (focus) position
 * - A small colored label with the user's name above the cursor
 * - A semi-transparent highlight for the selection range (if non-collapsed)
 */
export function drawRemoteCursors(
	ctx: CanvasRenderingContext2D,
	page: LayoutPage,
	remoteCursors: readonly RemoteCursorInfo[],
	positionResolver: PositionResolver,
	pageOffsetX: number,
	pageOffsetY: number,
): void {
	for (const remote of remoteCursors) {
		if (!remote.cursor) continue;

		const focusPoint: JPPoint = {
			path: remote.cursor.focus.path as JPPath,
			offset: remote.cursor.focus.offset,
		};

		const focusPos = positionResolver(page, focusPoint, pageOffsetX, pageOffsetY);

		// Draw selection highlight if anchor !== focus
		const anchorPoint: JPPoint = {
			path: remote.cursor.anchor.path as JPPath,
			offset: remote.cursor.anchor.offset,
		};

		const isCollapsed =
			arraysEqual(remote.cursor.anchor.path, remote.cursor.focus.path) &&
			remote.cursor.anchor.offset === remote.cursor.focus.offset;

		if (!isCollapsed) {
			drawRemoteSelection(
				ctx,
				page,
				anchorPoint,
				focusPoint,
				remote.color,
				positionResolver,
				pageOffsetX,
				pageOffsetY,
			);
		}

		// Draw the cursor line and label
		if (focusPos) {
			drawCursorLine(ctx, focusPos, remote.color);
			drawNameLabel(ctx, focusPos, remote.name, remote.color);
		}
	}
}

/**
 * Draw a colored vertical line at the cursor position.
 */
function drawCursorLine(ctx: CanvasRenderingContext2D, pos: CursorPosition, color: string): void {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = CURSOR_WIDTH;
	ctx.beginPath();
	ctx.moveTo(pos.x, pos.y);
	ctx.lineTo(pos.x, pos.y + pos.height);
	ctx.stroke();
	ctx.restore();
}

/**
 * Draw a small colored label with the user's name above the cursor.
 */
function drawNameLabel(
	ctx: CanvasRenderingContext2D,
	pos: CursorPosition,
	name: string,
	color: string,
): void {
	ctx.save();

	ctx.font = `${LABEL_FONT_SIZE}px sans-serif`;
	const metrics = ctx.measureText(name);
	const labelWidth = metrics.width + LABEL_PADDING_H * 2;

	const labelX = pos.x - 1;
	const labelY = pos.y - LABEL_HEIGHT;

	// Label background
	ctx.fillStyle = color;
	roundRect(ctx, labelX, labelY, labelWidth, LABEL_HEIGHT, 2);
	ctx.fill();

	// Label text
	ctx.fillStyle = '#ffffff';
	ctx.textBaseline = 'middle';
	ctx.fillText(name, labelX + LABEL_PADDING_H, labelY + LABEL_HEIGHT / 2);

	ctx.restore();
}

/**
 * Draw a semi-transparent selection highlight for a remote user's range.
 *
 * This is a simplified version: it resolves both anchor and focus positions
 * and draws a highlight rectangle between them on the same line, or
 * multiple rectangles across lines.
 *
 * For a full implementation, we'd walk through every layout fragment in the
 * range like SelectionRenderer does. For now, we draw a highlight at the
 * anchor and focus positions as a visual indicator.
 */
function drawRemoteSelection(
	ctx: CanvasRenderingContext2D,
	page: LayoutPage,
	anchor: JPPoint,
	focus: JPPoint,
	color: string,
	positionResolver: PositionResolver,
	pageOffsetX: number,
	pageOffsetY: number,
): void {
	const anchorPos = positionResolver(page, anchor, pageOffsetX, pageOffsetY);
	const focusPos = positionResolver(page, focus, pageOffsetX, pageOffsetY);

	if (!anchorPos || !focusPos) return;

	ctx.save();
	// Parse the color and apply 20% opacity for selection highlight
	ctx.fillStyle = colorWithAlpha(color, 0.2);

	// Determine if on the same line (same y position)
	if (Math.abs(anchorPos.y - focusPos.y) < 2) {
		// Same line
		const x1 = Math.min(anchorPos.x, focusPos.x);
		const x2 = Math.max(anchorPos.x, focusPos.x);
		ctx.fillRect(x1, anchorPos.y, x2 - x1, anchorPos.height);
	} else {
		// Different lines -- draw rects for the anchor line and focus line
		// Anchor line: from anchor to end of line (approximate with a wide rect)
		const topPos = anchorPos.y < focusPos.y ? anchorPos : focusPos;
		const bottomPos = anchorPos.y < focusPos.y ? focusPos : anchorPos;

		// Top line highlight
		ctx.fillRect(topPos.x, topPos.y, 400, topPos.height);

		// Middle lines (full-width block between)
		if (bottomPos.y - (topPos.y + topPos.height) > 2) {
			ctx.fillRect(
				pageOffsetX,
				topPos.y + topPos.height,
				600,
				bottomPos.y - (topPos.y + topPos.height),
			);
		}

		// Bottom line highlight
		ctx.fillRect(pageOffsetX, bottomPos.y, bottomPos.x - pageOffsetX, bottomPos.height);
	}

	ctx.restore();
}

// ── Utility helpers ──────────────────────────────────────────

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Convert a CSS color string to an rgba string with the given alpha.
 * Handles hex colors (#rgb, #rrggbb) and named colors via a fallback.
 */
function colorWithAlpha(color: string, alpha: number): string {
	// Handle hex colors
	if (color.startsWith('#')) {
		let r: number;
		let g: number;
		let b: number;
		if (color.length === 4) {
			r = Number.parseInt(color[1] + color[1], 16);
			g = Number.parseInt(color[2] + color[2], 16);
			b = Number.parseInt(color[3] + color[3], 16);
		} else {
			r = Number.parseInt(color.slice(1, 3), 16);
			g = Number.parseInt(color.slice(3, 5), 16);
			b = Number.parseInt(color.slice(5, 7), 16);
		}
		return `rgba(${r},${g},${b},${alpha})`;
	}
	// Handle rgb/rgba
	if (color.startsWith('rgb')) {
		const match = color.match(/[\d.]+/g);
		if (match && match.length >= 3) {
			return `rgba(${match[0]},${match[1]},${match[2]},${alpha})`;
		}
	}
	// Fallback: return with opacity as-is (won't work perfectly for named colors)
	return color;
}

/**
 * Draw a rounded rectangle path (does not fill or stroke).
 */
function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}
