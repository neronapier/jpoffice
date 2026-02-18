// Main components
export { JPOfficeEditor } from './JPOfficeEditor';
export type { JPOfficeEditorProps } from './JPOfficeEditor';

export { JPOfficeViewer } from './JPOfficeViewer';
export type { JPOfficeViewerProps } from './JPOfficeViewer';

// Sub-components
export { EditorCanvas } from './components/EditorCanvas';
export type { EditorCanvasProps } from './components/EditorCanvas';

export { Toolbar } from './components/Toolbar';

export { ScrollContainer } from './components/ScrollContainer';
export type { ScrollContainerProps } from './components/ScrollContainer';

export { StatusBar } from './components/StatusBar';
export type { StatusBarProps } from './components/StatusBar';

export { Ruler } from './components/Ruler';
export type { RulerProps } from './components/Ruler';

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
