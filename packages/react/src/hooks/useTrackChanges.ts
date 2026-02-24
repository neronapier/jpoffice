/**
 * Hook for managing track changes (revision tracking).
 * Provides access to revision entries and accept/reject operations
 * via the TrackChangesPlugin.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { TrackChangesPlugin } from '@jpoffice/engine';
import type { RevisionEntry } from '@jpoffice/engine';
import { useCallback, useEffect, useState } from 'react';

export interface UseTrackChangesReturn {
	readonly revisions: readonly RevisionEntry[];
	readonly isTracking: boolean;
	readonly toggleTracking: () => void;
	readonly acceptRevision: (revisionId: string) => void;
	readonly rejectRevision: (revisionId: string) => void;
	readonly acceptAll: () => void;
	readonly rejectAll: () => void;
}

export function useTrackChanges(editor: JPEditor | null): UseTrackChangesReturn {
	const [revisions, setRevisions] = useState<readonly RevisionEntry[]>([]);
	const [isTracking, setIsTracking] = useState(false);

	useEffect(() => {
		if (!editor) return;

		const plugin = editor.getPlugin('jpoffice.trackChanges') as TrackChangesPlugin | undefined;
		if (!plugin) return;

		// Sync initial state
		setIsTracking(plugin.isTracking());
		setRevisions(plugin.getRevisions(editor.getDocument()));

		// Listen for revision changes
		plugin.onRevisionsChange = (updated: readonly RevisionEntry[]) => {
			setRevisions(updated);
		};

		// Listen for tracking toggle
		plugin.onTrackingChange = (enabled: boolean) => {
			setIsTracking(enabled);
		};

		// Subscribe to editor state changes
		const unsubscribe = editor.subscribe(() => {
			setRevisions(plugin.getRevisions(editor.getDocument()));
			setIsTracking(plugin.isTracking());
		});

		return () => {
			unsubscribe();
			plugin.onRevisionsChange = undefined;
			plugin.onTrackingChange = undefined;
		};
	}, [editor]);

	const toggleTracking = useCallback(() => {
		if (!editor) return;
		editor.executeCommand('trackChanges.toggle');
	}, [editor]);

	const acceptRevision = useCallback(
		(revisionId: string) => {
			if (!editor) return;
			editor.executeCommand('trackChanges.acceptChange', { revisionId });
		},
		[editor],
	);

	const rejectRevision = useCallback(
		(revisionId: string) => {
			if (!editor) return;
			editor.executeCommand('trackChanges.rejectChange', { revisionId });
		},
		[editor],
	);

	const acceptAll = useCallback(() => {
		if (!editor) return;
		editor.executeCommand('trackChanges.acceptAll');
	}, [editor]);

	const rejectAll = useCallback(() => {
		if (!editor) return;
		editor.executeCommand('trackChanges.rejectAll');
	}, [editor]);

	return {
		revisions,
		isTracking,
		toggleTracking,
		acceptRevision,
		rejectRevision,
		acceptAll,
		rejectAll,
	};
}
