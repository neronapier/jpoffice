'use client';

import { JPEditor, registerBuiltinCommands } from '@jpoffice/engine';
import type { JPDocument } from '@jpoffice/model';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ScrollContainer } from './components/ScrollContainer';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { EditorContext } from './context/editor-context';
import type { EditorContextValue } from './context/editor-context';
import { useEditor } from './hooks/useEditor';
import { useEditorState } from './hooks/useEditorState';
import { useLayout } from './hooks/useLayout';

export interface JPOfficeEditorProps {
	document: JPDocument;
	readOnly?: boolean;
	showToolbar?: boolean;
	showStatusBar?: boolean;
	className?: string;
	style?: CSSProperties;
	onEditorReady?: (editor: JPEditor) => void;
}

/**
 * Inner component that consumes editor context for rendering.
 */
function EditorInner({
	readOnly,
	showToolbar,
	showStatusBar,
}: {
	readOnly: boolean;
	showToolbar: boolean;
	showStatusBar: boolean;
}) {
	const editor = useEditor();
	const state = useEditorState();
	const layout = useLayout();

	return (
		<>
			{showToolbar && !readOnly && <Toolbar />}
			<EditorCanvas
				editor={editor}
				layout={layout}
				selection={state.selection}
				readOnly={readOnly}
			/>
			{showStatusBar && <StatusBar language={state.document.metadata.language} />}
		</>
	);
}

/**
 * JPOfficeEditor is the main React component for the word processor.
 * It creates a JPEditor instance, registers built-in commands,
 * and renders the toolbar + canvas editor.
 */
export function JPOfficeEditor({
	document: initialDocument,
	readOnly = false,
	showToolbar = true,
	showStatusBar = true,
	className,
	style,
	onEditorReady,
}: JPOfficeEditorProps) {
	const editorRef = useRef<JPEditor | null>(null);

	// Create editor once
	if (!editorRef.current) {
		const editor = new JPEditor({
			document: initialDocument,
			readOnly,
		});
		registerBuiltinCommands(editor);
		editorRef.current = editor;
	}

	// Notify when ready
	useEffect(() => {
		if (editorRef.current && onEditorReady) {
			onEditorReady(editorRef.current);
		}
	}, [onEditorReady]);

	// Sync readOnly prop
	useEffect(() => {
		editorRef.current?.setReadOnly(readOnly);
	}, [readOnly]);

	// Cleanup
	useEffect(() => {
		return () => {
			editorRef.current?.destroy();
		};
	}, []);

	const contextValue = useMemo<EditorContextValue>(() => ({ editor: editorRef.current! }), []);

	return (
		<EditorContext.Provider value={contextValue}>
			<ScrollContainer className={className} style={style}>
				<EditorInner readOnly={readOnly} showToolbar={showToolbar} showStatusBar={showStatusBar} />
			</ScrollContainer>
		</EditorContext.Provider>
	);
}
