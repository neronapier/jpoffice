import type { LayoutFragment, LayoutLine, LayoutPage } from '@jpoffice/layout';
import { isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPPoint } from '@jpoffice/model';
import type { PageRenderer } from './page-renderer';

export interface HitTestResult {
	readonly pageIndex: number;
	readonly point: JPPoint;
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

				const point = this.hitTestPage(page, localX, localY);
				if (point) {
					return { pageIndex: pi, point };
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

		const point = this.hitTestPage(page, localX, localY);
		if (point) {
			return { pageIndex: closestPageIndex, point };
		}

		return null;
	}

	private hitTestPage(page: LayoutPage, x: number, y: number): JPPoint | null {
		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				const r = block.rect;
				if (this.isInRect(x, y, r.x, r.y, r.width, r.height)) {
					return this.hitTestLines(block.lines, x - r.x, y - r.y);
				}
			} else if (isLayoutTable(block)) {
				if (this.isInRect(x, y, block.x, block.y, block.width, block.height)) {
					for (const row of block.rows) {
						for (const cell of row.cells) {
							if (this.isInRect(x, y, cell.x, cell.y, cell.width, cell.height)) {
								for (const cellBlock of cell.blocks) {
									if (isLayoutParagraph(cellBlock)) {
										const cr = cell.contentRect;
										const pr = cellBlock.rect;
										const px = cr.x + pr.x;
										const py = cr.y + pr.y;
										if (this.isInRect(x, y, px, py, pr.width, pr.height)) {
											return this.hitTestLines(cellBlock.lines, x - px, y - py);
										}
									}
								}
							}
						}
					}
				}
			}
		}

		return this.findClosestBlock(page, x, y);
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

		for (const block of page.blocks) {
			if (!isLayoutParagraph(block)) continue;
			const midY = block.rect.y + block.rect.height / 2;
			const dist = Math.abs(y - midY);

			if (dist < closestDist && block.lines.length > 0) {
				closestDist = dist;
				const line =
					y < block.rect.y + block.rect.height / 2
						? block.lines[0]
						: block.lines[block.lines.length - 1];
				closestPoint = this.hitTestFragments(line.fragments, x - block.rect.x);
			}
		}

		return closestPoint;
	}

	private isInRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
		return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
	}
}
