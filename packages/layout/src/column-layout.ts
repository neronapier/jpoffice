/**
 * Multi-column layout support.
 *
 * Given section column properties, calculates column regions within
 * the content area and distributes laid-out blocks across those columns.
 */

import type { LayoutBlock, LayoutRect } from './types';
import { isLayoutParagraph, isLayoutTable } from './types';

// ── Public types ────────────────────────────────────────────────────────────

export interface ColumnConfig {
	readonly count: number;
	readonly space: number; // space between columns in px
	readonly separator: boolean;
}

export interface ColumnLayout {
	readonly columns: readonly ColumnRegion[];
}

export interface ColumnRegion {
	readonly index: number;
	readonly x: number; // x offset from content area left
	readonly width: number; // column width in px
	readonly blocks: LayoutBlock[];
}

// ── Public functions ────────────────────────────────────────────────────────

/**
 * Given content area dimensions and column config, calculate column regions.
 * Each column gets equal width with the configured spacing between them.
 *
 * Formula: columnWidth = (contentWidth - (count - 1) * space) / count
 * Column x offset: column[i].x = i * (columnWidth + space)
 */
export function calculateColumnRegions(
	contentWidth: number,
	config: ColumnConfig,
): readonly ColumnRegion[] {
	const { count, space } = config;

	if (count <= 1) {
		return [{ index: 0, x: 0, width: contentWidth, blocks: [] }];
	}

	const columnWidth = (contentWidth - (count - 1) * space) / count;
	const regions: ColumnRegion[] = [];

	for (let i = 0; i < count; i++) {
		regions.push({
			index: i,
			x: i * (columnWidth + space),
			width: columnWidth,
			blocks: [],
		});
	}

	return regions;
}

/**
 * Distribute blocks across columns. Fills the first column until it reaches
 * contentHeight, then flows to the next column, and so on.
 *
 * When all columns are full, remaining blocks are returned as overflow
 * (to be placed on the next page).
 *
 * Blocks are expected to have been laid out using a temporary content area
 * (starting at y=0 with x=0 and column width). This function repositions
 * blocks to their final absolute positions using the provided contentArea
 * as the reference frame.
 *
 * @param blocks - Blocks laid out sequentially (y positions relative to y=0).
 * @param columns - Column regions from calculateColumnRegions.
 * @param contentArea - The page's absolute content area rectangle.
 * @returns The filled columns (blocks repositioned to absolute coords) and overflow.
 */
export function distributeBlocksToColumns(
	blocks: LayoutBlock[],
	columns: readonly ColumnRegion[],
	contentArea: LayoutRect,
): { columns: readonly ColumnRegion[]; overflow: LayoutBlock[] } {
	const contentHeight = contentArea.height;

	// Create mutable copies of columns with empty block arrays
	const filledColumns: ColumnRegion[] = columns.map((col) => ({
		...col,
		blocks: [],
	}));

	let currentColIndex = 0;
	let cursorY = 0; // y position within current column (relative to column top = 0)
	const overflow: LayoutBlock[] = [];

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];

		// If we have exhausted all columns, everything else is overflow
		if (currentColIndex >= filledColumns.length) {
			overflow.push(...blocks.slice(i));
			break;
		}

		const blockHeight = getBlockHeight(block);

		// Check if block fits in the current column
		// Always allow the first block in a column (even if it overflows)
		const isFirstInColumn = filledColumns[currentColIndex].blocks.length === 0;
		const fitsInColumn = cursorY + blockHeight <= contentHeight;

		if (!fitsInColumn && !isFirstInColumn) {
			// Move to next column
			currentColIndex++;
			cursorY = 0;

			// If no more columns, this block and remaining are overflow
			if (currentColIndex >= filledColumns.length) {
				overflow.push(...blocks.slice(i));
				break;
			}
		}

		// Place the block in the current column with absolute positioning
		const col = filledColumns[currentColIndex];
		const absoluteX = contentArea.x + col.x;
		const absoluteY = contentArea.y + cursorY;
		const repositioned = repositionBlock(block, absoluteX, absoluteY, currentColIndex);
		col.blocks.push(repositioned);
		cursorY += blockHeight;
	}

	return { columns: filledColumns, overflow };
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Get the height of a layout block. */
function getBlockHeight(block: LayoutBlock): number {
	if (isLayoutParagraph(block)) {
		return block.rect.height;
	}
	if (isLayoutTable(block)) {
		return block.height;
	}
	// LayoutImage
	return block.rect.height;
}

/**
 * Reposition a block to absolute (x, y) coordinates.
 * Adjusts all nested rects (lines, fragments, rows, cells) accordingly.
 */
function repositionBlock(
	block: LayoutBlock,
	absoluteX: number,
	absoluteY: number,
	columnIndex: number,
): LayoutBlock {
	if (isLayoutParagraph(block)) {
		// line.rect.y and fragment.rect.y are block-relative, no Y adjustment needed
		// X coordinates are also block-relative, only update block position
		return {
			...block,
			columnIndex,
			rect: {
				...block.rect,
				x: absoluteX,
				y: absoluteY,
			},
		};
	}

	if (isLayoutTable(block)) {
		const xDelta = absoluteX - block.x;
		const yDelta = absoluteY - block.y;
		return {
			...block,
			columnIndex,
			x: absoluteX,
			y: absoluteY,
			rows: block.rows.map((row) => ({
				...row,
				x: row.x + xDelta,
				y: row.y + yDelta,
				cells: row.cells.map((cell) => ({
					...cell,
					x: cell.x + xDelta,
					y: cell.y + yDelta,
					contentRect: {
						...cell.contentRect,
						x: cell.contentRect.x + xDelta,
						y: cell.contentRect.y + yDelta,
					},
				})),
			})),
		};
	}

	// LayoutImage
	return {
		...block,
		columnIndex,
		rect: {
			...block.rect,
			x: absoluteX,
			y: absoluteY,
		},
	};
}
