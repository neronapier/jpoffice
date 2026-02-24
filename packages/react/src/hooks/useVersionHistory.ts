import type { JPEditor } from '@jpoffice/engine';
import type { DocumentSnapshot } from '@jpoffice/engine';
import { VersionManager } from '@jpoffice/engine';
import type { VersionManagerOptions } from '@jpoffice/engine';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseVersionHistoryReturn {
	/** All snapshots, ordered newest first. */
	readonly snapshots: readonly DocumentSnapshot[];
	/** Manually save a snapshot of the current document. */
	readonly saveSnapshot: (label?: string) => void;
	/** Restore a snapshot by ID, replacing the editor document. */
	readonly restoreSnapshot: (id: string) => void;
	/** Delete a snapshot by ID. */
	readonly deleteSnapshot: (id: string) => void;
	/** Rename (re-label) a snapshot. */
	readonly renameSnapshot: (id: string, label: string) => void;
}

/**
 * React hook for document version history.
 *
 * Provides auto-saving snapshots and manual snapshot management.
 * When the editor applies operations, the version manager tracks them
 * for auto-save threshold detection.
 *
 * @param editor - The JPEditor instance. Pass null to disable.
 * @param options - VersionManager configuration options.
 */
export function useVersionHistory(
	editor: JPEditor | null,
	options?: VersionManagerOptions,
): UseVersionHistoryReturn {
	const [snapshots, setSnapshots] = useState<readonly DocumentSnapshot[]>([]);
	const managerRef = useRef<VersionManager | null>(null);

	// Stable refs for options to avoid re-creating the manager on every render
	const maxSnapshots = options?.maxSnapshots;
	const autoSaveInterval = options?.autoSaveInterval;
	const minOperationsBetweenSaves = options?.minOperationsBetweenSaves;

	useEffect(() => {
		if (!editor) {
			managerRef.current?.destroy();
			managerRef.current = null;
			setSnapshots([]);
			return;
		}

		const manager = new VersionManager({
			maxSnapshots,
			autoSaveInterval,
			minOperationsBetweenSaves,
		});

		manager.onSnapshotsChange = (newSnapshots) => {
			setSnapshots(newSnapshots);
		};

		// Track operations for auto-save threshold
		const unsubscribe = editor.subscribe(() => {
			manager.notifyOperation();
		});

		// Start auto-saving
		manager.start(() => editor.getDocument());

		managerRef.current = manager;

		return () => {
			unsubscribe();
			manager.destroy();
			managerRef.current = null;
		};
	}, [editor, maxSnapshots, autoSaveInterval, minOperationsBetweenSaves]);

	const saveSnapshot = useCallback(
		(label?: string) => {
			if (!editor || !managerRef.current) return;
			managerRef.current.saveSnapshot(editor.getDocument(), label);
		},
		[editor],
	);

	const restoreSnapshot = useCallback(
		(id: string) => {
			if (!editor || !managerRef.current) return;
			const doc = managerRef.current.restoreSnapshot(id);
			if (doc) {
				editor.setDocument(doc);
			}
		},
		[editor],
	);

	const deleteSnapshot = useCallback((id: string) => {
		managerRef.current?.deleteSnapshot(id);
	}, []);

	const renameSnapshot = useCallback((id: string, label: string) => {
		managerRef.current?.renameSnapshot(id, label);
	}, []);

	return {
		snapshots,
		saveSnapshot,
		restoreSnapshot,
		deleteSnapshot,
		renameSnapshot,
	};
}
