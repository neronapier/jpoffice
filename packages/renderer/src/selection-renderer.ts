import type { LayoutFragment, LayoutLine, LayoutPage } from '@jpoffice/layout';
import { isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPPath, JPSelection } from '@jpoffice/model';
import { comparePaths, pathEquals } from '@jpoffice/model';

export interface SelectionStyle {
	/** Fill color for selection highlight. Default 'rgba(51,144,255,0.3)'. */
	color?: string;
}

/**
 * Renders selection highlight over text.
 */
export class SelectionRenderer {
	private color: string;

	constructor(style?: SelectionStyle) {
		this.color = style?.color ?? 'rgba(51,144,255,0.3)';
	}

	/**
	 * Render selection highlight on a page.
	 */
	renderSelection(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		selection: JPSelection,
		pageOffsetX: number,
		pageOffsetY: number,
	): void {
		if (!selection) return;

		// Normalize so anchor is before focus
		let { anchor, focus } = selection;
		const cmp = comparePaths(anchor.path, focus.path);
		if (cmp > 0 || (cmp === 0 && anchor.offset > focus.offset)) {
			[anchor, focus] = [focus, anchor];
		}

		// Same point = collapsed = no highlight
		if (pathEquals(anchor.path, focus.path) && anchor.offset === focus.offset) {
			return;
		}

		ctx.save();
		ctx.fillStyle = this.color;

		for (const block of page.blocks) {
			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					this.highlightLineFragments(
						ctx,
						line,
						anchor.path,
						anchor.offset,
						focus.path,
						focus.offset,
						pageOffsetX + block.rect.x,
						pageOffsetY + block.rect.y,
					);
				}
			} else if (isLayoutTable(block)) {
				for (const row of block.rows) {
					for (const cell of row.cells) {
						for (const cellBlock of cell.blocks) {
							if (isLayoutParagraph(cellBlock)) {
								for (const line of cellBlock.lines) {
									this.highlightLineFragments(
										ctx,
										line,
										anchor.path,
										anchor.offset,
										focus.path,
										focus.offset,
										pageOffsetX + cell.contentRect.x + cellBlock.rect.x,
										pageOffsetY + cell.contentRect.y + cellBlock.rect.y,
									);
								}
							}
						}
					}
				}
			}
		}

		ctx.restore();
	}

	private highlightLineFragments(
		ctx: CanvasRenderingContext2D,
		line: LayoutLine,
		anchorPath: JPPath,
		anchorOffset: number,
		focusPath: JPPath,
		focusOffset: number,
		blockOffsetX: number,
		blockOffsetY: number,
	): void {
		for (const fragment of line.fragments) {
			const rects = this.getSelectionRectsForFragment(
				fragment,
				anchorPath,
				anchorOffset,
				focusPath,
				focusOffset,
			);

			for (const rect of rects) {
				ctx.fillRect(
					blockOffsetX + rect.x,
					blockOffsetY + line.rect.y + rect.y,
					rect.width,
					rect.height,
				);
			}
		}
	}

	private getSelectionRectsForFragment(
		fragment: LayoutFragment,
		anchorPath: JPPath,
		anchorOffset: number,
		focusPath: JPPath,
		focusOffset: number,
	): Array<{ x: number; y: number; width: number; height: number }> {
		const fragPath = fragment.runPath;
		const fragStart = fragment.runOffset;
		const fragEnd = fragStart + fragment.charCount;

		const pathCmpWithAnchor = comparePaths(fragPath, anchorPath);
		const pathCmpWithFocus = comparePaths(fragPath, focusPath);

		if (pathCmpWithFocus > 0 || pathCmpWithAnchor < 0) return [];

		let selStart = fragStart;
		let selEnd = fragEnd;

		if (pathEquals(fragPath, anchorPath)) {
			selStart = Math.max(fragStart, anchorOffset);
		}
		if (pathEquals(fragPath, focusPath)) {
			selEnd = Math.min(fragEnd, focusOffset);
		}

		if (selStart >= selEnd) return [];

		const startRatio = (selStart - fragStart) / fragment.charCount;
		const endRatio = (selEnd - fragStart) / fragment.charCount;

		return [
			{
				x: fragment.rect.x + fragment.rect.width * startRatio,
				y: 0,
				width: fragment.rect.width * (endRatio - startRatio),
				height: fragment.rect.height,
			},
		];
	}
}
