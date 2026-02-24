import type { JPDocument } from '@jpoffice/model';
import type { DocumentSnapshot } from './snapshot';
import { createSnapshot, deserializeDocument } from './snapshot';

const DEFAULT_MAX_SNAPSHOTS = 50;
const DEFAULT_AUTO_SAVE_INTERVAL = 300_000; // 5 minutes
const DEFAULT_MIN_OPS_BETWEEN_SAVES = 20;

export interface VersionManagerOptions {
	/** Maximum number of snapshots to retain. Default: 50. */
	maxSnapshots?: number;
	/** Auto-save interval in milliseconds. Default: 300000 (5 minutes). */
	autoSaveInterval?: number;
	/** Minimum operations between auto-saves. Default: 20. */
	minOperationsBetweenSaves?: number;
}

/**
 * Manages document version snapshots with auto-save capability.
 *
 * Snapshots are stored in memory and ordered by timestamp (newest first).
 * When the maximum number of snapshots is exceeded, the oldest unlabeled
 * snapshot is pruned.
 */
export class VersionManager {
	private snapshots: DocumentSnapshot[] = [];
	private operationCount = 0;
	private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
	private getDocumentFn: (() => JPDocument) | null = null;

	private readonly maxSnapshots: number;
	private readonly autoSaveInterval: number;
	private readonly minOperationsBetweenSaves: number;

	/** Callback invoked whenever the snapshots list changes. */
	onSnapshotsChange?: (snapshots: readonly DocumentSnapshot[]) => void;

	constructor(options?: VersionManagerOptions) {
		this.maxSnapshots = options?.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
		this.autoSaveInterval = options?.autoSaveInterval ?? DEFAULT_AUTO_SAVE_INTERVAL;
		this.minOperationsBetweenSaves =
			options?.minOperationsBetweenSaves ?? DEFAULT_MIN_OPS_BETWEEN_SAVES;
	}

	/**
	 * Start auto-saving snapshots at the configured interval.
	 * The provided callback is used to retrieve the current document.
	 */
	start(getDocument: () => JPDocument): void {
		this.stop();
		this.getDocumentFn = getDocument;

		this.autoSaveTimer = setInterval(() => {
			this.autoSave();
		}, this.autoSaveInterval);
	}

	/**
	 * Stop auto-saving.
	 */
	stop(): void {
		if (this.autoSaveTimer !== null) {
			clearInterval(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}
		this.getDocumentFn = null;
	}

	/**
	 * Manually save a snapshot of the given document.
	 */
	saveSnapshot(doc: JPDocument, label?: string): DocumentSnapshot {
		const snapshot = createSnapshot(doc, label);
		this.snapshots.unshift(snapshot);
		this.pruneSnapshots();
		this.operationCount = 0;
		this.notifyChange();
		return snapshot;
	}

	/**
	 * Get all snapshots, ordered newest first.
	 */
	getSnapshots(): readonly DocumentSnapshot[] {
		return this.snapshots;
	}

	/**
	 * Get a specific snapshot by ID.
	 */
	getSnapshot(id: string): DocumentSnapshot | null {
		return this.snapshots.find((s) => s.id === id) ?? null;
	}

	/**
	 * Restore a snapshot by ID. Returns the deserialized document, or null
	 * if the snapshot was not found.
	 */
	restoreSnapshot(id: string): JPDocument | null {
		const snapshot = this.getSnapshot(id);
		if (!snapshot) return null;
		return deserializeDocument(snapshot.document);
	}

	/**
	 * Delete a snapshot by ID.
	 */
	deleteSnapshot(id: string): boolean {
		const index = this.snapshots.findIndex((s) => s.id === id);
		if (index === -1) return false;
		this.snapshots.splice(index, 1);
		this.notifyChange();
		return true;
	}

	/**
	 * Rename (re-label) a snapshot.
	 */
	renameSnapshot(id: string, label: string): boolean {
		const index = this.snapshots.findIndex((s) => s.id === id);
		if (index === -1) return false;
		this.snapshots[index] = { ...this.snapshots[index], label };
		this.notifyChange();
		return true;
	}

	/**
	 * Notify the manager that a document operation has occurred.
	 * Used to track operation count for auto-save threshold.
	 */
	notifyOperation(): void {
		this.operationCount++;
	}

	/**
	 * Clear all snapshots.
	 */
	clear(): void {
		this.snapshots = [];
		this.operationCount = 0;
		this.notifyChange();
	}

	/**
	 * Stop the auto-save timer and clear all snapshots.
	 */
	destroy(): void {
		this.stop();
		this.snapshots = [];
		this.operationCount = 0;
	}

	// -- Private helpers --

	private autoSave(): void {
		if (!this.getDocumentFn) return;
		if (this.operationCount < this.minOperationsBetweenSaves) return;

		const doc = this.getDocumentFn();
		this.saveSnapshot(doc, 'Auto-save');
	}

	/**
	 * Remove the oldest unlabeled snapshot if over the limit.
	 * Labeled (named) snapshots are preserved over unlabeled ones.
	 */
	private pruneSnapshots(): void {
		while (this.snapshots.length > this.maxSnapshots) {
			// Find the oldest unlabeled snapshot to remove
			let removeIndex = -1;
			for (let i = this.snapshots.length - 1; i >= 0; i--) {
				if (!this.snapshots[i].label) {
					removeIndex = i;
					break;
				}
			}

			// If all are labeled, remove the oldest overall
			if (removeIndex === -1) {
				removeIndex = this.snapshots.length - 1;
			}

			this.snapshots.splice(removeIndex, 1);
		}
	}

	private notifyChange(): void {
		this.onSnapshotsChange?.(this.snapshots);
	}
}
