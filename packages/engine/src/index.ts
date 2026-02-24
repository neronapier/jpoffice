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
export type {
	StyleInfo,
	StyleProperties,
	CreateStyleArgs,
	ModifyStyleArgs,
	RenameStyleArgs,
	DeleteStyleArgs,
} from './plugins/styles/style-types';
export { ListPlugin } from './plugins/list/list-plugin';
export { TablePlugin } from './plugins/table/table-plugin';
export { ImagePlugin } from './plugins/image/image-plugin';
export type {
	InsertImageArgs,
	ResizeImageArgs,
	CropImageArgs,
	RotateImageArgs,
	FlipImageArgs,
	SetWrapArgs,
	SetAltTextArgs,
	ReplaceImageArgs,
	ResetImageSizeArgs,
} from './plugins/image/image-plugin';
export {
	constrainToAspectRatio,
	getCroppedDimensions,
	degreesToRadians,
	normalizeRotation,
	isValidCrop,
	clampCrop,
} from './plugins/image/image-transform';
export { ClipboardPlugin } from './plugins/clipboard/clipboard-plugin';
export type { PasteArgs } from './plugins/clipboard/clipboard-plugin';
export { LinkPlugin } from './plugins/link/link-plugin';
export type { InsertLinkArgs } from './plugins/link/link-plugin';
export { FindReplacePlugin } from './plugins/find-replace/find-replace-plugin';
export type { SearchMatch, FindReplaceState } from './plugins/find-replace/find-replace-plugin';
export { FieldPlugin } from './plugins/field/field-plugin';
export { CommentPlugin } from './plugins/comment/comment-plugin';
export type { AddCommentArgs, ReplyCommentArgs } from './plugins/comment/comment-plugin';
export { SpellcheckPlugin } from './plugins/spellcheck/spellcheck-plugin';
export type {
	SpellError,
	SpellCheckProvider,
	SpellCheckState,
} from './plugins/spellcheck/spellcheck-types';
export { BrowserSpellCheckProvider } from './plugins/spellcheck/browser-spellcheck-provider';
export { TrackChangesPlugin } from './plugins/track-changes/track-changes-plugin';
export type { RevisionEntry } from './plugins/track-changes/track-changes-plugin';
export { DragDropPlugin } from './plugins/drag-drop/drag-drop-plugin';
export type {
	DragState,
	DragDataType,
	DropArgs,
	StartDragArgs,
} from './plugins/drag-drop/drag-drop-plugin';
export { FootnotePlugin } from './plugins/footnote/footnote-plugin';
export type {
	InsertFootnoteArgs,
	DeleteFootnoteArgs,
	EditFootnoteArgs,
	GetFootnoteNumberArgs,
	FootnoteWithNumber,
} from './plugins/footnote/footnote-plugin';
export {
	PageSetupPlugin,
	PAGE_PRESETS,
	twipsToMm,
	mmToTwips,
} from './plugins/page-setup/page-setup-plugin';
export type {
	PagePreset,
	PagePresetName,
	SetMarginsArgs,
	SetPageSizeArgs,
	SetOrientationArgs,
	SetColumnsArgs,
	ApplyPresetArgs,
	PageSetupInfo,
} from './plugins/page-setup/page-setup-plugin';
export { HeaderFooterPlugin } from './plugins/header-footer/header-footer-plugin';
export type {
	HeaderFooterEditState,
	EditHeaderArgs,
	EditFooterArgs,
} from './plugins/header-footer/header-footer-plugin';
export { EquationPlugin } from './plugins/equation/equation-plugin';
export type {
	InsertEquationArgs,
	EditEquationArgs,
	DeleteEquationArgs,
	SetEquationDisplayArgs,
} from './plugins/equation/equation-plugin';
export { LATEX_SYMBOL_GROUPS } from './plugins/equation/latex-symbols';
export type { LatexSymbol, LatexSymbolGroup } from './plugins/equation/latex-symbols';
export { AutoCorrectPlugin } from './plugins/autocorrect/autocorrect-plugin';
export type { AutoCorrectRule } from './plugins/autocorrect/autocorrect-rules';
export { DEFAULT_AUTOCORRECT_RULES } from './plugins/autocorrect/autocorrect-rules';
export { ShapePlugin } from './plugins/shape/shape-plugin';
export type {
	InsertShapeArgs,
	DeleteShapeArgs,
	ResizeShapeArgs,
	MoveShapeArgs,
	SetShapePropertiesArgs,
	GroupShapeArgs,
	UngroupShapeArgs,
	InsertTextBoxArgs,
	DeleteTextBoxArgs,
} from './plugins/shape/shape-plugin';
export { MentionPlugin } from './plugins/mention/mention-plugin';
export type {
	MentionSuggestion,
	MentionPluginConfig,
} from './plugins/mention/mention-plugin';

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
export { TouchManager } from './input/touch-manager';
export type { TouchManagerOptions, TouchHitTestResult } from './input/touch-manager';

// Selection
export { SelectionManager } from './selection/selection-manager';

// Collaboration
export { CollabProvider } from './collab/collab-provider';
export type { CollabTransport } from './collab/collab-provider';
export { WebSocketTransport } from './collab/websocket-transport';
export {
	transformOperation,
	transformOperationAgainstMany,
	transformManyAgainstOperation,
	transformPath,
} from './collab/operation-transform';
export type {
	AwarenessState,
	ClientInfo,
	ConnectionStatus,
	SyncMessage,
} from './collab/types';

// Offline
export { OfflineStore } from './offline/offline-store';

// Versioning
export type { DocumentSnapshot } from './versioning/snapshot';
export { serializeDocument, deserializeDocument, createSnapshot } from './versioning/snapshot';
export type { VersionManagerOptions } from './versioning/version-manager';
export { VersionManager } from './versioning/version-manager';
