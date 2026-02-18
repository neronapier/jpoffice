import type { LayoutLine, LayoutPage } from '@jpoffice/layout';
import { isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPPath, JPPoint } from '@jpoffice/model';
import { pathEquals } from '@jpoffice/model';

export interface CursorStyle {
	/** Cursor color. Default '#000000'. */
	color?: string;
	/** Cursor width in px. Default 1.5. */
	width?: number;
	/** Blink interval in ms. Default 530. */
	blinkInterval?: number;
}

export interface CursorPosition {
	readonly x: number;
	readonly y: number;
	readonly height: number;
}

/**
 * Renders the blinking text cursor.
 */
export class CursorRenderer {
	private color: string;
	private width: number;
	private blinkInterval: number;
	private visible = true;
	private timer: ReturnType<typeof setInterval> | null = null;
	private onBlink: (() => void) | null = null;

	constructor(style?: CursorStyle) {
		this.color = style?.color ?? '#000000';
		this.width = style?.width ?? 1.5;
		this.blinkInterval = style?.blinkInterval ?? 530;
	}

	startBlinking(onBlink: () => void): void {
		this.stopBlinking();
		this.onBlink = onBlink;
		this.visible = true;
		this.timer = setInterval(() => {
			this.visible = !this.visible;
			this.onBlink?.();
		}, this.blinkInterval);
	}

	stopBlinking(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.onBlink = null;
	}

	resetBlink(): void {
		this.visible = true;
		if (this.timer && this.onBlink) {
			const callback = this.onBlink;
			this.stopBlinking();
			this.startBlinking(callback);
		}
	}

	renderCursor(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		point: JPPoint,
		pageOffsetX: number,
		pageOffsetY: number,
	): void {
		if (!this.visible) return;

		const pos = this.findCursorPosition(page, point, pageOffsetX, pageOffsetY);
		if (!pos) return;

		ctx.save();
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.width;
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
		ctx.lineTo(pos.x, pos.y + pos.height);
		ctx.stroke();
		ctx.restore();
	}

	findCursorPosition(
		page: LayoutPage,
		point: JPPoint,
		pageOffsetX: number,
		pageOffsetY: number,
	): CursorPosition | null {
		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				const pos = this.findInLines(
					block.lines,
					point.path,
					point.offset,
					pageOffsetX + block.rect.x,
					pageOffsetY + block.rect.y,
				);
				if (pos) return pos;
			} else if (isLayoutTable(block)) {
				for (const row of block.rows) {
					for (const cell of row.cells) {
						for (const cellBlock of cell.blocks) {
							if (isLayoutParagraph(cellBlock)) {
								const pos = this.findInLines(
									cellBlock.lines,
									point.path,
									point.offset,
									pageOffsetX + cell.contentRect.x + cellBlock.rect.x,
									pageOffsetY + cell.contentRect.y + cellBlock.rect.y,
								);
								if (pos) return pos;
							}
						}
					}
				}
			}
		}
		return null;
	}

	private findInLines(
		lines: readonly LayoutLine[],
		path: JPPath,
		offset: number,
		blockOffsetX: number,
		blockOffsetY: number,
	): CursorPosition | null {
		for (const line of lines) {
			for (const fragment of line.fragments) {
				if (!pathEquals(fragment.runPath, path)) continue;

				const fragStart = fragment.runOffset;
				const fragEnd = fragStart + fragment.charCount;

				if (offset >= fragStart && offset <= fragEnd) {
					const ratio = fragment.charCount > 0 ? (offset - fragStart) / fragment.charCount : 0;
					return {
						x: blockOffsetX + fragment.rect.x + fragment.rect.width * ratio,
						y: blockOffsetY + line.rect.y,
						height: line.rect.height,
					};
				}
			}
		}
		return null;
	}

	destroy(): void {
		this.stopBlinking();
	}
}
