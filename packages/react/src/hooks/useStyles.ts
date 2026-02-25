/**
 * Hook for managing document styles.
 * Provides access to the list of styles, the currently active style,
 * and a function to apply a style to the selection.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { StylesPlugin } from '@jpoffice/engine';
import type { StyleInfo } from '@jpoffice/engine';
import { useCallback, useEffect, useState } from 'react';

export interface UseStylesReturn {
	readonly styles: readonly StyleInfo[];
	readonly currentStyle: string | undefined;
	readonly applyStyle: (styleId: string, type?: 'paragraph' | 'character') => void;
	readonly createStyle: (
		name: string,
		type: 'paragraph' | 'character',
		basedOn?: string,
		properties?: Record<string, unknown>,
	) => void;
	readonly modifyStyle: (styleId: string, properties: Record<string, unknown>) => void;
	readonly deleteStyle: (styleId: string) => void;
}

export function useStyles(editor: JPEditor | null): UseStylesReturn {
	const [styles, setStyles] = useState<readonly StyleInfo[]>([]);
	const [currentStyle, setCurrentStyle] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!editor) return;

		const plugin = editor.getPlugin('jpoffice.styles') as StylesPlugin | undefined;
		if (!plugin) return;

		// Sync initial state
		const doc = editor.getDocument();
		setStyles(plugin.getAllStyles(doc));

		const current = plugin.getCurrentStyle(editor);
		setCurrentStyle(current?.id);

		// Listen for style registry changes
		const unsubStyles = plugin.onStylesChange((updated: readonly StyleInfo[]) => {
			setStyles(updated);
		});

		// Listen for editor state changes (selection moves, doc changes)
		const unsubEditor = editor.subscribe(() => {
			const updatedDoc = editor.getDocument();
			setStyles(plugin.getAllStyles(updatedDoc));

			const updatedCurrent = plugin.getCurrentStyle(editor);
			setCurrentStyle(updatedCurrent?.id);
		});

		return () => {
			unsubStyles();
			unsubEditor();
		};
	}, [editor]);

	const applyStyle = useCallback(
		(styleId: string, type?: 'paragraph' | 'character') => {
			if (!editor) return;
			editor.executeCommand('styles.apply', { styleId, type: type ?? 'paragraph' });
		},
		[editor],
	);

	const createStyle = useCallback(
		(
			name: string,
			type: 'paragraph' | 'character',
			basedOn?: string,
			properties?: Record<string, unknown>,
		) => {
			if (!editor) return;
			editor.executeCommand('styles.create', { name, type, basedOn, properties: properties ?? {} });
		},
		[editor],
	);

	const modifyStyle = useCallback(
		(styleId: string, properties: Record<string, unknown>) => {
			if (!editor) return;
			editor.executeCommand('styles.modify', { styleId, properties });
		},
		[editor],
	);

	const deleteStyle = useCallback(
		(styleId: string) => {
			if (!editor) return;
			editor.executeCommand('styles.delete', { styleId });
		},
		[editor],
	);

	return { styles, currentStyle, applyStyle, createStyle, modifyStyle, deleteStyle };
}
