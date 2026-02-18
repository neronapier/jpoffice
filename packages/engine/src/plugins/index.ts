export type { JPPlugin } from './plugin';
export { JPPluginManager } from './plugin-manager';

// Feature plugins
export { TextPlugin } from './text/text-plugin';
export { HistoryPlugin } from './history/history-plugin';
export { SelectionPlugin } from './selection/selection-plugin';
export type { MoveArgs } from './selection/selection-plugin';
export { FormattingPlugin } from './formatting/formatting-plugin';
export { HeadingPlugin } from './heading/heading-plugin';
export { StylesPlugin } from './styles/styles-plugin';
export { ListPlugin } from './list/list-plugin';
export { TablePlugin } from './table/table-plugin';
export { ImagePlugin } from './image/image-plugin';
export type { InsertImageArgs } from './image/image-plugin';
export { ClipboardPlugin } from './clipboard/clipboard-plugin';
export type { PasteArgs } from './clipboard/clipboard-plugin';

// Shared utilities
export {
	resolveSelectionContext,
	resolveRangeContext,
	deleteSelectionOps,
	previousTextNode,
	nextTextNode,
	firstTextNode,
	lastTextNode,
	findWordBoundary,
	getParagraphsInRange,
	getRunsInRange,
} from './text/text-utils';
export type {
	SelectionContext,
	RangeContext,
	RunInRange,
} from './text/text-utils';
