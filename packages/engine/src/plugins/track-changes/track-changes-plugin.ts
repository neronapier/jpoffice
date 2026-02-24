import type {
	JPDocument,
	JPNode,
	JPOperation,
	JPPath,
	JPRevisionInfo,
	JPRun,
} from '@jpoffice/model';
import { generateId, getNodeAtPath, isElement, parentPath, traverseByType } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';

/**
 * Author color palette. Colors cycle as new authors are encountered.
 */
const AUTHOR_COLORS: readonly string[] = [
	'#2196F3',
	'#F44336',
	'#4CAF50',
	'#9C27B0',
	'#FF9800',
	'#00BCD4',
];

export interface RevisionEntry {
	readonly revisionId: string;
	readonly author: string;
	readonly date: string;
	readonly type: 'insertion' | 'deletion' | 'formatChange';
	readonly runPath: JPPath;
	readonly runId: string;
	readonly text: string;
	readonly color: string;
}

/**
 * TrackChangesPlugin intercepts editing operations when tracking is enabled
 * and annotates runs with revision metadata instead of (or in addition to)
 * performing the raw mutation.
 *
 * - Insertions: text is inserted normally, and the run is marked with
 *   revision type 'insertion'.
 * - Deletions: instead of removing text, the run is marked with
 *   revision type 'deletion' (soft delete).
 * - Format changes: the run is marked with revision type 'formatChange'
 *   and previousProperties stores the old formatting.
 *
 * Accept/reject commands finalize or revert changes.
 */
export class TrackChangesPlugin implements JPPlugin {
	readonly id = 'jpoffice.trackChanges';
	readonly name = 'Track Changes';

	private tracking = false;
	private currentAuthor = 'Anonymous';
	private authorColorMap: Map<string, string> = new Map();
	private nextColorIndex = 0;

	/** Callback for React layer to respond to revision state changes */
	onRevisionsChange?: (revisions: readonly RevisionEntry[]) => void;

	/** Callback for React layer to respond to tracking state changes */
	onTrackingChange?: (enabled: boolean) => void;

	initialize(editor: JPEditor): void {
		// ── Toggle tracking ──────────────────────────────────────
		editor.registerCommand({
			id: 'trackChanges.toggle',
			name: 'Toggle Track Changes',
			canExecute: () => true,
			execute: () => {
				this.tracking = !this.tracking;
				this.onTrackingChange?.(this.tracking);
				this.notifyRevisions(editor);
			},
		});

		// ── Set author ───────────────────────────────────────────
		editor.registerCommand<{ author: string }>({
			id: 'trackChanges.setAuthor',
			name: 'Set Author',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.currentAuthor = args.author;
			},
		});

		// ── Accept a specific change ─────────────────────────────
		editor.registerCommand<{ revisionId: string }>({
			id: 'trackChanges.acceptChange',
			name: 'Accept Change',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.acceptChange(editor, args.revisionId),
		});

		// ── Reject a specific change ─────────────────────────────
		editor.registerCommand<{ revisionId: string }>({
			id: 'trackChanges.rejectChange',
			name: 'Reject Change',
			canExecute: () => !editor.isReadOnly(),
			execute: (_ed, args) => this.rejectChange(editor, args.revisionId),
		});

		// ── Accept all ───────────────────────────────────────────
		editor.registerCommand({
			id: 'trackChanges.acceptAll',
			name: 'Accept All Changes',
			canExecute: () => !editor.isReadOnly(),
			execute: () => this.acceptAll(editor),
		});

		// ── Reject all ───────────────────────────────────────────
		editor.registerCommand({
			id: 'trackChanges.rejectAll',
			name: 'Reject All Changes',
			canExecute: () => !editor.isReadOnly(),
			execute: () => this.rejectAll(editor),
		});
	}

	// ── onBeforeApply: intercept ops when tracking ────────────────

	onBeforeApply(editor: JPEditor, op: JPOperation): JPOperation[] {
		if (!this.tracking) return [op];

		switch (op.type) {
			case 'insert_text':
				return this.interceptInsertText(editor, op);
			case 'delete_text':
				return this.interceptDeleteText(editor, op);
			case 'set_properties':
				return this.interceptSetProperties(editor, op);
			default:
				return [op];
		}
	}

	// ── onAfterApply: notify React layer ─────────────────────────

	onAfterApply(editor: JPEditor, ops: readonly JPOperation[]): void {
		// Only notify if any op touched revision-related properties
		const relevant = ops.some(
			(o) =>
				o.type === 'insert_text' ||
				o.type === 'delete_text' ||
				o.type === 'set_properties' ||
				o.type === 'remove_node',
		);
		if (relevant && this.onRevisionsChange) {
			this.notifyRevisions(editor);
		}
	}

	reset(_editor: JPEditor): void {
		// Keep tracking state and author — only reset on explicit toggle
	}

	// ── Public API ───────────────────────────────────────────────

	isTracking(): boolean {
		return this.tracking;
	}

	setTracking(enabled: boolean): void {
		this.tracking = enabled;
		this.onTrackingChange?.(enabled);
	}

	getCurrentAuthor(): string {
		return this.currentAuthor;
	}

	getAuthorColor(author: string): string {
		let color = this.authorColorMap.get(author);
		if (!color) {
			color = AUTHOR_COLORS[this.nextColorIndex % AUTHOR_COLORS.length];
			this.nextColorIndex++;
			this.authorColorMap.set(author, color);
		}
		return color;
	}

	/**
	 * Walk the document and collect all runs with revision metadata.
	 */
	getRevisions(doc: JPDocument): readonly RevisionEntry[] {
		const revisions: RevisionEntry[] = [];

		for (const [node, path] of traverseByType<JPRun>(doc, 'run')) {
			const props = node.properties;
			if (!props.revision) continue;

			const rev = props.revision;
			let text = '';
			if (isElement(node)) {
				for (const child of node.children) {
					if (child.type === 'text') {
						text += (child as { text: string }).text;
					}
				}
			}

			revisions.push({
				revisionId: rev.revisionId,
				author: rev.author,
				date: rev.date,
				type: rev.type,
				runPath: path,
				runId: node.id,
				text,
				color: this.getAuthorColor(rev.author),
			});
		}

		return revisions;
	}

	// ── Intercept helpers ────────────────────────────────────────

	/**
	 * When insert_text happens during tracking, let it proceed normally,
	 * then mark the run as an insertion revision via set_properties.
	 */
	private interceptInsertText(
		editor: JPEditor,
		op: JPOperation & { type: 'insert_text' },
	): JPOperation[] {
		const doc = editor.getDocument();
		const textNode = getNodeAtPath(doc, op.path);
		if (!textNode || textNode.type !== 'text') return [op];

		const runPath = parentPath(op.path);
		const run = getNodeAtPath(doc, runPath) as JPRun;

		// If this run already has a revision, just let the insert proceed
		if (run.properties.revision) return [op];

		const revision: JPRevisionInfo = {
			revisionId: generateId(),
			author: this.currentAuthor,
			date: new Date().toISOString(),
			type: 'insertion',
		};

		return [
			op,
			{
				type: 'set_properties',
				path: runPath,
				properties: { revision },
				oldProperties: { revision: run.properties.revision },
			},
		];
	}

	/**
	 * When delete_text happens during tracking, instead of deleting,
	 * mark the run as a deletion revision (soft delete).
	 * The text remains visible but is visually struck through.
	 */
	private interceptDeleteText(
		editor: JPEditor,
		op: JPOperation & { type: 'delete_text' },
	): JPOperation[] {
		const doc = editor.getDocument();
		const textNode = getNodeAtPath(doc, op.path);
		if (!textNode || textNode.type !== 'text') return [op];

		const runPath = parentPath(op.path);
		const run = getNodeAtPath(doc, runPath) as JPRun;

		// If the run is already an insertion revision, allow the actual delete
		// (removes uncommitted inserted text)
		if (run.properties.revision?.type === 'insertion') {
			return [op];
		}

		// If the run is already marked for deletion, no-op
		if (run.properties.revision?.type === 'deletion') {
			return [];
		}

		// Mark the run for deletion instead of actually deleting
		const revision: JPRevisionInfo = {
			revisionId: generateId(),
			author: this.currentAuthor,
			date: new Date().toISOString(),
			type: 'deletion',
		};

		return [
			{
				type: 'set_properties',
				path: runPath,
				properties: { revision },
				oldProperties: { revision: run.properties.revision },
			},
		];
	}

	/**
	 * When formatting changes during tracking, let it proceed but also
	 * store the previous properties and mark as formatChange revision.
	 */
	private interceptSetProperties(
		editor: JPEditor,
		op: JPOperation & { type: 'set_properties' },
	): JPOperation[] {
		const doc = editor.getDocument();

		// Only intercept run-level formatting (not paragraph, section, etc.)
		let targetNode: JPNode;
		try {
			targetNode = getNodeAtPath(doc, op.path);
		} catch {
			return [op];
		}

		if (targetNode.type !== 'run') return [op];

		const run = targetNode as JPRun;

		// If the op is itself setting revision info, pass through
		if ('revision' in op.properties) return [op];

		// If this run already has a revision, just let the format change proceed
		if (run.properties.revision) return [op];

		const revision: JPRevisionInfo = {
			revisionId: generateId(),
			author: this.currentAuthor,
			date: new Date().toISOString(),
			type: 'formatChange',
		};

		// Capture the properties that are about to change
		const previousProperties: Record<string, unknown> = {};
		for (const key of Object.keys(op.properties)) {
			previousProperties[key] = (run.properties as Record<string, unknown>)[key];
		}

		return [
			op,
			{
				type: 'set_properties',
				path: op.path,
				properties: { revision, previousProperties },
				oldProperties: {
					revision: run.properties.revision,
					previousProperties: run.properties.previousProperties,
				},
			},
		];
	}

	// ── Accept / Reject ──────────────────────────────────────────

	private acceptChange(editor: JPEditor, revisionId: string): void {
		const doc = editor.getDocument();
		const revisions = this.getRevisions(doc);
		const rev = revisions.find((r) => r.revisionId === revisionId);
		if (!rev) return;

		editor.batch(() => {
			switch (rev.type) {
				case 'insertion': {
					// Accept insertion: remove revision marker, text stays
					this.clearRevisionProps(editor, rev.runPath);
					break;
				}
				case 'deletion': {
					// Accept deletion: actually delete the run
					const run = getNodeAtPath(doc, rev.runPath);
					editor.apply({
						type: 'remove_node',
						path: rev.runPath,
						node: run,
					});
					break;
				}
				case 'formatChange': {
					// Accept format change: remove revision marker and previousProperties
					this.clearRevisionProps(editor, rev.runPath);
					break;
				}
			}
		});

		this.notifyRevisions(editor);
	}

	private rejectChange(editor: JPEditor, revisionId: string): void {
		const doc = editor.getDocument();
		const revisions = this.getRevisions(doc);
		const rev = revisions.find((r) => r.revisionId === revisionId);
		if (!rev) return;

		editor.batch(() => {
			switch (rev.type) {
				case 'insertion': {
					// Reject insertion: delete the inserted run
					const run = getNodeAtPath(doc, rev.runPath);
					editor.apply({
						type: 'remove_node',
						path: rev.runPath,
						node: run,
					});
					break;
				}
				case 'deletion': {
					// Reject deletion: remove the deletion marker, text stays
					this.clearRevisionProps(editor, rev.runPath);
					break;
				}
				case 'formatChange': {
					// Reject format change: restore previous properties
					const run = getNodeAtPath(doc, rev.runPath) as JPRun;
					const prev = run.properties.previousProperties;
					if (prev) {
						// Restore old formatting
						const oldProps: Record<string, unknown> = {};
						for (const key of Object.keys(prev)) {
							oldProps[key] = (run.properties as Record<string, unknown>)[key];
						}
						editor.apply({
							type: 'set_properties',
							path: rev.runPath,
							properties: prev as Record<string, unknown>,
							oldProperties: oldProps,
						});
					}
					// Clear revision markers
					this.clearRevisionProps(editor, rev.runPath);
					break;
				}
			}
		});

		this.notifyRevisions(editor);
	}

	private acceptAll(editor: JPEditor): void {
		const doc = editor.getDocument();
		const revisions = this.getRevisions(doc);
		if (revisions.length === 0) return;

		// Process deletions last (in reverse path order) to avoid path invalidation
		const sorted = [...revisions].sort((a, b) => {
			// Deletions (which remove nodes) should be processed last
			if (a.type === 'deletion' && b.type !== 'deletion') return 1;
			if (a.type !== 'deletion' && b.type === 'deletion') return -1;
			// Among deletions, process in reverse path order
			if (a.type === 'deletion' && b.type === 'deletion') {
				return comparePathsDesc(a.runPath, b.runPath);
			}
			return 0;
		});

		editor.batch(() => {
			for (const rev of sorted) {
				// Re-fetch document since it changes with each op
				const currentDoc = editor.getDocument();
				try {
					const currentNode = getNodeAtPath(currentDoc, rev.runPath);
					if (!currentNode) continue;

					switch (rev.type) {
						case 'insertion':
						case 'formatChange':
							this.clearRevisionPropsRaw(editor, currentDoc, rev.runPath);
							break;
						case 'deletion':
							editor.apply({
								type: 'remove_node',
								path: rev.runPath,
								node: currentNode,
							});
							break;
					}
				} catch {
					// Path may have become invalid after previous ops; skip
				}
			}
		});

		this.notifyRevisions(editor);
	}

	private rejectAll(editor: JPEditor): void {
		const doc = editor.getDocument();
		const revisions = this.getRevisions(doc);
		if (revisions.length === 0) return;

		// Process insertions (which remove nodes) in reverse path order
		const sorted = [...revisions].sort((a, b) => {
			if (a.type === 'insertion' && b.type !== 'insertion') return 1;
			if (a.type !== 'insertion' && b.type === 'insertion') return -1;
			if (a.type === 'insertion' && b.type === 'insertion') {
				return comparePathsDesc(a.runPath, b.runPath);
			}
			return 0;
		});

		editor.batch(() => {
			for (const rev of sorted) {
				const currentDoc = editor.getDocument();
				try {
					const currentNode = getNodeAtPath(currentDoc, rev.runPath);
					if (!currentNode) continue;

					switch (rev.type) {
						case 'insertion':
							editor.apply({
								type: 'remove_node',
								path: rev.runPath,
								node: currentNode,
							});
							break;
						case 'deletion':
							this.clearRevisionPropsRaw(editor, currentDoc, rev.runPath);
							break;
						case 'formatChange': {
							const run = currentNode as JPRun;
							const prev = run.properties.previousProperties;
							if (prev) {
								const oldProps: Record<string, unknown> = {};
								for (const key of Object.keys(prev)) {
									oldProps[key] = (run.properties as Record<string, unknown>)[key];
								}
								editor.apply({
									type: 'set_properties',
									path: rev.runPath,
									properties: prev as Record<string, unknown>,
									oldProperties: oldProps,
								});
							}
							this.clearRevisionPropsRaw(editor, currentDoc, rev.runPath);
							break;
						}
					}
				} catch {
					// Path may have become invalid; skip
				}
			}
		});

		this.notifyRevisions(editor);
	}

	// ── Internal helpers ─────────────────────────────────────────

	private clearRevisionProps(editor: JPEditor, runPath: JPPath): void {
		const doc = editor.getDocument();
		this.clearRevisionPropsRaw(editor, doc, runPath);
	}

	private clearRevisionPropsRaw(editor: JPEditor, doc: JPDocument, runPath: JPPath): void {
		const run = getNodeAtPath(doc, runPath) as JPRun;
		editor.apply({
			type: 'set_properties',
			path: runPath,
			properties: { revision: null, previousProperties: null },
			oldProperties: {
				revision: run.properties.revision,
				previousProperties: run.properties.previousProperties,
			},
		});
	}

	private notifyRevisions(editor: JPEditor): void {
		if (!this.onRevisionsChange) return;
		const revisions = this.getRevisions(editor.getDocument());
		this.onRevisionsChange(revisions);
	}
}

/** Compare two paths in descending order (for reverse traversal). */
function comparePathsDesc(a: JPPath, b: JPPath): number {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) return b[i] - a[i]; // descending
	}
	return b.length - a.length;
}
