import type { LayoutFragment, LayoutLine, LayoutPage } from '@jpoffice/layout';
import { isLayoutImage, isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPPoint } from '@jpoffice/model';
import type { PageRenderer } from './page-renderer';

export interface HitTestResult {
	readonly pageIndex: number;
	readonly point: JPPoint;
	readonly kind: 'text' | 'image';
	/** Present only when kind === 'image' */
	readonly imagePath?: readonly number[];
}

/**
 * Translates mouse coordinates to document positions.
 */
export class HitTester {
	private pageRenderer: PageRenderer;

	constructor(pageRenderer: PageRenderer) {
		this.pageRenderer = pageRenderer;
	}

	hitTest(
		canvasX: number,
		canvasY: number,
		pages: readonly LayoutPage[],
		canvasWidth: number,
	): HitTestResult | null {
		if (pages.length === 0) return null;

		for (let pi = 0; pi < pages.length; pi++) {
			const page = pages[pi];
			const pageY = this.pageRenderer.getPageY(pages, pi);
			const pageX = (canvasWidth - page.width) / 2;

			if (
				canvasY >= pageY &&
				canvasY < pageY + page.height &&
				canvasX >= pageX &&
				canvasX < pageX + page.width
			) {
				const localX = canvasX - pageX;
				const localY = canvasY - pageY;

				const result = this.hitTestPage(page, localX, localY);
				if (result) {
					return { pageIndex: pi, ...result };
				}
			}
		}

		// Click between pages - find closest
		let closestPageIndex = 0;
		let closestDistance = Number.POSITIVE_INFINITY;

		for (let pi = 0; pi < pages.length; pi++) {
			const pageY = this.pageRenderer.getPageY(pages, pi);
			const pageMidY = pageY + pages[pi].height / 2;
			const dist = Math.abs(canvasY - pageMidY);
			if (dist < closestDistance) {
				closestDistance = dist;
				closestPageIndex = pi;
			}
		}

		const page = pages[closestPageIndex];
		const pageX = (canvasWidth - page.width) / 2;
		const localX = canvasX - pageX;
		const pageY = this.pageRenderer.getPageY(pages, closestPageIndex);
		const localY = canvasY - pageY;

		const result = this.hitTestPage(page, localX, localY);
		if (result) {
			return { pageIndex: closestPageIndex, ...result };
		}

		return null;
	}

	private hitTestPage(
		page: LayoutPage,
		x: number,
		y: number,
	): { point: JPPoint; kind: 'text' | 'image'; imagePath?: readonly number[] } | null {
		// Check images first (they render on top of text)
		for (const block of page.blocks) {
			if (isLayoutImage(block)) {
				const r = block.rect;
				if (this.isInRect(x, y, r.x, r.y, r.width, r.height)) {
					// Find closest text point for cursor positioning
					const closestPoint = this.findClosestBlock(page, x, y);
					if (closestPoint) {
						return { point: closestPoint, kind: 'image', imagePath: block.nodePath };
					}
				}
			}
		}

		// Check floats (floating images)
		if (page.floats) {
			for (const float of page.floats) {
				if (this.isInRect(x, y, float.x, float.y, float.width, float.height)) {
					const closestPoint = this.findClosestBlock(page, x, y);
					if (closestPoint) {
						return { point: closestPoint, kind: 'image', imagePath: float.imagePath };
					}
				}
			}
		}

		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				const r = block.rect;
				if (this.isInRect(x, y, r.x, r.y, r.width, r.height)) {
					const pt = this.hitTestLines(block.lines, x - r.x, y - r.y);
					if (pt) return { point: pt, kind: 'text' };
				}
			} else if (isLayoutTable(block)) {
				if (this.isInRect(x, y, block.x, block.y, block.width, block.height)) {
					const pt = this.hitTestTableBlock(block, 0, 0, x, y);
					if (pt) return { point: pt, kind: 'text' };
				}
			}
		}

		// Check header/footer blocks
		if (page.header) {
			for (const block of page.header.blocks) {
				if (isLayoutParagraph(block)) {
					const hx = page.contentArea.x + block.rect.x;
					const hy = page.header.rect.y + block.rect.y;
					if (this.isInRect(x, y, hx, hy, block.rect.width, block.rect.height)) {
						const pt = this.hitTestLines(block.lines, x - hx, y - hy);
						if (pt) return { point: pt, kind: 'text' };
					}
				}
			}
		}

		if (page.footer) {
			for (const block of page.footer.blocks) {
				if (isLayoutParagraph(block)) {
					const fx = page.contentArea.x + block.rect.x;
					const fy = page.footer.rect.y + block.rect.y;
					if (this.isInRect(x, y, fx, fy, block.rect.width, block.rect.height)) {
						const pt = this.hitTestLines(block.lines, x - fx, y - fy);
						if (pt) return { point: pt, kind: 'text' };
					}
				}
			}
		}

		const closest = this.findClosestBlock(page, x, y);
		return closest ? { point: closest, kind: 'text' } : null;
	}

	/**
	 * Recursively hit-test inside a table (supports nested tables).
	 * offsetX/offsetY are accumulated content offsets from parent cells.
	 */
	private hitTestTableBlock(
		table: import('@jpoffice/layout').LayoutTable,
		offsetX: number,
		offsetY: number,
		x: number,
		y: number,
	): JPPoint | null {
		for (const row of table.rows) {
			for (const cell of row.cells) {
				const cellX = offsetX + cell.x;
				const cellY = offsetY + cell.y;
				if (!this.isInRect(x, y, cellX, cellY, cell.width, cell.height)) continue;

				// Try exact block hit first
				for (const cellBlock of cell.blocks) {
					if (isLayoutParagraph(cellBlock)) {
						const cr = cell.contentRect;
						const crx = offsetX + cr.x;
						const cry = offsetY + cr.y;
						const px = crx + cellBlock.rect.x;
						const py = cry + cellBlock.rect.y;
						if (this.isInRect(x, y, px, py, cellBlock.rect.width, cellBlock.rect.height)) {
							return this.hitTestLines(cellBlock.lines, x - px, y - py);
						}
					} else if (isLayoutTable(cellBlock)) {
						const cr = cell.contentRect;
						const ntx = offsetX + cr.x + cellBlock.x;
						const nty = offsetY + cr.y + cellBlock.y;
						if (this.isInRect(x, y, ntx, nty, cellBlock.width, cellBlock.height)) {
							const result = this.hitTestTableBlock(cellBlock, offsetX + cr.x, offsetY + cr.y, x, y);
							if (result) return result;
						}
					}
				}

				// No exact hit — find closest paragraph within THIS cell
				return this.findClosestBlockInCell(cell, offsetX, offsetY, x, y);
			}
		}
		return null;
	}

	/**
	 * When click lands inside a cell but not on any paragraph rect,
	 * find the closest paragraph within that cell (not global).
	 */
	private findClosestBlockInCell(
		cell: import('@jpoffice/layout').LayoutTableCell,
		offsetX: number,
		offsetY: number,
		x: number,
		y: number,
	): JPPoint | null {
		let closestPoint: JPPoint | null = null;
		let closestDist = Infinity;
		const crx = offsetX + cell.contentRect.x;
		const cry = offsetY + cell.contentRect.y;

		for (const block of cell.blocks) {
			if (!isLayoutParagraph(block) || block.lines.length === 0) continue;
			const px = crx + block.rect.x;
			const py = cry + block.rect.y;
			const midY = py + block.rect.height / 2;
			const dist = Math.abs(y - midY);
			if (dist < closestDist) {
				closestDist = dist;
				const line = y < midY ? block.lines[0] : block.lines[block.lines.length - 1];
				closestPoint = this.hitTestFragments(line.fragments, x - px);
			}
		}
		return closestPoint;
	}

	private hitTestLines(lines: readonly LayoutLine[], x: number, y: number): JPPoint | null {
		let targetLine: LayoutLine | null = null;

		for (const line of lines) {
			if (y >= line.rect.y && y < line.rect.y + line.rect.height) {
				targetLine = line;
				break;
			}
		}

		if (!targetLine && lines.length > 0) {
			let closestDist = Number.POSITIVE_INFINITY;
			for (const line of lines) {
				const midY = line.rect.y + line.rect.height / 2;
				const dist = Math.abs(y - midY);
				if (dist < closestDist) {
					closestDist = dist;
					targetLine = line;
				}
			}
		}

		if (!targetLine) return null;
		return this.hitTestFragments(targetLine.fragments, x);
	}

	private hitTestFragments(fragments: readonly LayoutFragment[], x: number): JPPoint | null {
		if (fragments.length === 0) return null;

		for (const fragment of fragments) {
			if (x >= fragment.rect.x && x < fragment.rect.x + fragment.rect.width) {
				const relativeX = x - fragment.rect.x;
				const charWidth = fragment.charCount > 0 ? fragment.rect.width / fragment.charCount : 0;
				const charOffset = charWidth > 0 ? Math.round(relativeX / charWidth) : 0;
				const offset = fragment.runOffset + Math.min(charOffset, fragment.charCount);
				return { path: fragment.runPath, offset };
			}
		}

		// Snap to closest fragment edge
		const lastFrag = fragments[fragments.length - 1];
		if (x >= lastFrag.rect.x + lastFrag.rect.width) {
			return { path: lastFrag.runPath, offset: lastFrag.runOffset + lastFrag.charCount };
		}

		const firstFrag = fragments[0];
		return { path: firstFrag.runPath, offset: firstFrag.runOffset };
	}

	private findClosestBlock(page: LayoutPage, x: number, y: number): JPPoint | null {
		let closestPoint: JPPoint | null = null;
		let closestDist = Number.POSITIVE_INFINITY;

		const consider = (block: { rect: { x: number; y: number; height: number }; lines: readonly LayoutLine[] }, ox: number, oy: number) => {
			const midY = oy + block.rect.y + block.rect.height / 2;
			const dist = Math.abs(y - midY);
			if (dist < closestDist && block.lines.length > 0) {
				closestDist = dist;
				const line = y < midY ? block.lines[0] : block.lines[block.lines.length - 1];
				closestPoint = this.hitTestFragments(line.fragments, x - ox - block.rect.x);
			}
		};

		const considerTable = (table: import('@jpoffice/layout').LayoutTable, ox: number, oy: number) => {
			for (const row of table.rows) {
				for (const cell of row.cells) {
					const cellX = ox + cell.x;
					const cellY = oy + cell.y;
					if (this.isInRect(x, y, cellX, cellY, cell.width, cell.height)) {
						const crx = ox + cell.contentRect.x;
						const cry = oy + cell.contentRect.y;
						for (const cb of cell.blocks) {
							if (isLayoutParagraph(cb)) {
								consider(cb, crx, cry);
							} else if (isLayoutTable(cb)) {
								considerTable(cb, crx, cry);
							}
						}
					}
				}
			}
		};

		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				consider(block, 0, 0);
			} else if (isLayoutTable(block)) {
				considerTable(block, 0, 0);
			}
		}

		return closestPoint;
	}

	private isInRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
		return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
	}
}
