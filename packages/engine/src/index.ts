// Editor
export { JPEditor } from './editor';
export type { JPEditorListener, JPEditorOptions } from './editor';

// State
export type { JPEditorState, JPHistory } from './editor-state';
export { createEditorState } from './editor-state';

// Commands
export type { JPCommand } from './commands/command';
export { JPCommandRegistry } from './commands/registry';
export { registerBuiltinCommands } from './commands/index';
export { TEXT_COMMANDS } from './commands/text-commands';
export { FORMAT_COMMANDS } from './commands/format-commands';
export { HISTORY_COMMANDS } from './commands/history-commands';
export { SELECTION_COMMANDS } from './commands/selection-commands';

// History
export { pushToHistory, performUndo, performRedo, canUndo, canRedo } from './history/history';

// Plugins
export type { JPPlugin } from './plugins/plugin';
export { JPPluginManager } from './plugins/plugin-manager';
export { TextPlugin } from './plugins/text/text-plugin';
export { HistoryPlugin } from './plugins/history/history-plugin';
export { SelectionPlugin } from './plugins/selection/selection-plugin';
export type { MoveArgs } from './plugins/selection/selection-plugin';
export { FormattingPlugin } from './plugins/formatting/formatting-plugin';
export { HeadingPlugin } from './plugins/heading/heading-plugin';
export { StylesPlugin } from './plugins/styles/styles-plugin';
export { ListPlugin } from './plugins/list/list-plugin';
export { TablePlugin } from './plugins/table/table-plugin';
export { ImagePlugin } from './plugins/image/image-plugin';
export type { InsertImageArgs } from './plugins/image/image-plugin';
export { ClipboardPlugin } from './plugins/clipboard/clipboard-plugin';
export type { PasteArgs } from './plugins/clipboard/clipboard-plugin';

// Plugin utilities
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
} from './plugins/text/text-utils';
export type {
	SelectionContext,
	RangeContext,
	RunInRange,
} from './plugins/text/text-utils';

// Input
export { InputManager } from './input/input-manager';
export type { KeyBinding } from './input/keybindings';
export { DEFAULT_KEYBINDINGS, eventToShortcut } from './input/keybindings';

// Selection
export { SelectionManager } from './selection/selection-manager';
