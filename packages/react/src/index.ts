// Main components
export { JPOfficeEditor } from './JPOfficeEditor';
export type { JPOfficeEditorProps, EditorMode } from './JPOfficeEditor';

export { JPOfficeViewer } from './JPOfficeViewer';
export type { JPOfficeViewerProps } from './JPOfficeViewer';

// Sub-components
export { EditorCanvas } from './components/EditorCanvas';
export type { EditorCanvasProps } from './components/EditorCanvas';

export { Toolbar } from './components/Toolbar';
export type { ToolbarProps } from './components/Toolbar';

export { ScrollContainer } from './components/ScrollContainer';
export type { ScrollContainerProps } from './components/ScrollContainer';

export { StatusBar } from './components/StatusBar';
export type { StatusBarProps } from './components/StatusBar';

export { Ruler } from './components/Ruler';
export type { RulerProps } from './components/Ruler';

export { ModePanel, ModeButtons } from './components/ModeButtons';
export type { ModePanelProps, ModeButtonsProps } from './components/ModeButtons';

export { TitleBar } from './components/TitleBar';
export type { TitleBarProps } from './components/TitleBar';

export { MenuBar } from './components/MenuBar';
export type { MenuBarProps } from './components/MenuBar';

export { Sidebar } from './components/Sidebar';
export type { SidebarProps } from './components/Sidebar';

export { OutlinePanel } from './components/OutlinePanel';
export type { OutlinePanelProps } from './components/OutlinePanel';

export {
	ContextMenu,
	contextMenuIcons,
	getDefaultContextMenuGroups,
} from './components/ContextMenu';
export type { ContextMenuProps, ContextMenuItem, ContextMenuGroup } from './components/ContextMenu';

export { LinkDialog } from './components/LinkDialog';
export type { LinkDialogProps } from './components/LinkDialog';

export { FindReplaceBar } from './components/FindReplaceBar';
export type { FindReplaceBarProps } from './components/FindReplaceBar';

export { MobileToolbar } from './components/MobileToolbar';
export type { MobileToolbarProps } from './components/MobileToolbar';

export { MentionAutocomplete } from './components/MentionAutocomplete';
export type {
	MentionAutocompleteProps,
	MentionSuggestion as MentionAutocompleteSuggestion,
} from './components/MentionAutocomplete';

export { PrintPreview } from './components/PrintPreview';
export type { PrintPreviewProps } from './components/PrintPreview';

export { CommentsPanel } from './components/CommentsPanel';
export type { CommentsPanelProps } from './components/CommentsPanel';

export { StylesPanel } from './components/StylesPanel';
export type { StylesPanelProps } from './components/StylesPanel';

export { TrackChangesPanel } from './components/TrackChangesPanel';
export type { TrackChangesPanelProps } from './components/TrackChangesPanel';

export { EquationEditor } from './components/EquationEditor';
export type { EquationEditorProps } from './components/EquationEditor';

export { FootnotePanel } from './components/FootnotePanel';
export type { FootnotePanelProps } from './components/FootnotePanel';

export { PageSetupDialog } from './components/PageSetupDialog';
export type { PageSetupDialogProps } from './components/PageSetupDialog';

export { TablePropertiesDialog } from './components/TablePropertiesDialog';
export type { TablePropertiesDialogProps } from './components/TablePropertiesDialog';

export { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
export type { KeyboardShortcutsDialogProps } from './components/KeyboardShortcutsDialog';

// Overlays
export { FloatingToolbar } from './overlays/FloatingToolbar';
export type { FloatingToolbarProps } from './overlays/FloatingToolbar';

// Context
export { EditorContext } from './context/editor-context';
export type { EditorContextValue } from './context/editor-context';

// Hooks
export { useEditor } from './hooks/useEditor';
export { useEditorState } from './hooks/useEditorState';
export { useSelection } from './hooks/useSelection';
export { useCommand } from './hooks/useCommand';
export { useLayout } from './hooks/useLayout';
export { useDocumentStats } from './hooks/useDocumentStats';
export type { DocumentStats } from './hooks/useDocumentStats';
export { useCurrentPage } from './hooks/useCurrentPage';
export { useAnnounce } from './hooks/useAnnounce';
export { useResponsive } from './hooks/useResponsive';
export type { Breakpoint, ResponsiveState } from './hooks/useResponsive';
export { useCollaboration } from './hooks/useCollaboration';
export type { CollaborationOptions, CollaborationState } from './hooks/useCollaboration';
export { useDragDrop } from './hooks/useDragDrop';
export type { HitTestFn, UseDragDropOptions, UseDragDropReturn } from './hooks/useDragDrop';
export { useDocumentOutline } from './hooks/useDocumentOutline';
export type { OutlineEntry } from './hooks/useDocumentOutline';
export { useVersionHistory } from './hooks/useVersionHistory';
export type { UseVersionHistoryReturn } from './hooks/useVersionHistory';
export { useSelectionRect } from './hooks/useSelectionRect';
export type { SelectionRect } from './hooks/useSelectionRect';
export { usePrintPreview } from './hooks/usePrintPreview';
export type { PrintPreviewState, UsePrintPreviewReturn } from './hooks/usePrintPreview';
export { useOffline } from './hooks/useOffline';
export type { UseOfflineReturn } from './hooks/useOffline';
export { useComments } from './hooks/useComments';
export type { UseCommentsReturn } from './hooks/useComments';
export { useStyles } from './hooks/useStyles';
export type { UseStylesReturn } from './hooks/useStyles';
export { useTrackChanges } from './hooks/useTrackChanges';
export type { UseTrackChangesReturn } from './hooks/useTrackChanges';
export { useFootnotes } from './hooks/useFootnotes';
export type { UseFootnotesReturn } from './hooks/useFootnotes';

// Theme
export {
	ThemeProvider,
	ThemeContext,
	lightTheme,
	darkTheme,
	highContrastTheme,
	useTheme,
} from './theme';
export type { JPTheme, ThemeMode, ThemeProviderProps } from './theme';
