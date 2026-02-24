// Types
export type {
	LayoutRect,
	ResolvedRunStyle,
	LayoutFragment,
	LayoutLine,
	LayoutParagraph,
	LayoutTableCell,
	LayoutTableRow,
	LayoutTable,
	LayoutImage,
	LayoutFloat,
	LayoutBlock,
	LayoutHeaderFooter,
	LayoutPage,
	LayoutPageColumns,
	LayoutResult,
	FontMetrics,
	TextMeasurement,
} from './types';
export { isLayoutParagraph, isLayoutTable, isLayoutImage } from './types';

// Text measurer
export { TextMeasurer } from './text-measurer';

// Style resolver
export type { ResolvedParagraphLayout } from './style-resolver';
export { resolveRunStyle, resolveParagraphLayout } from './style-resolver';

// Line breaker
export type { InlineItem, InlineImage, LineBreakingStrategy } from './line-breaker';
export { breakIntoLines, findHyphenationPoints } from './line-breaker';

// Knuth-Plass optimal line breaking
export type {
	KPBox,
	KPGlue,
	KPPenalty,
	KPItem,
	KPBreakpoint,
	KPOptions,
	KPResult,
} from './knuth-plass';
export { knuthPlassBreak, fragmentsToKPItems } from './knuth-plass';

// Table layout
export type { CellGridEntry, CellContentLayoutFn } from './table-layout';
export { layoutTable, buildCellGrid, resolveColumnWidths } from './table-layout';

// Float layout
export type { FloatingItem, PositionedFloat, ExclusionZone } from './float-layout';
export { positionFloats, getLineExclusions, isBlockedByFloat } from './float-layout';

// Column layout
export type { ColumnConfig, ColumnLayout, ColumnRegion } from './column-layout';
export { calculateColumnRegions, distributeBlocksToColumns } from './column-layout';

// BiDi / RTL text support
export type { BidiDirection, BidiRun, BidiCategory } from './bidi';
export {
	detectBaseDirection,
	resolveBidiRuns,
	reorderByBidiLevel,
	isRtlChar,
	isLtrChar,
	getBidiCategory,
} from './bidi';

// Cache
export type { LayoutCache } from './cache';
export { createLayoutCache } from './cache';

// Layout engine
export { LayoutEngine } from './layout-engine';
