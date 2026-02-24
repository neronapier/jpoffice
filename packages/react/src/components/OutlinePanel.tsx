'use client';

import type { JPEditor } from '@jpoffice/engine';
import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useDocumentOutline } from '../hooks/useDocumentOutline';
import type { OutlineEntry } from '../hooks/useDocumentOutline';

export interface OutlinePanelProps {
	/** The editor instance to extract headings from and navigate within. */
	editor: JPEditor | null;
	/** Optional callback when a heading is clicked. Receives the paragraph path. */
	onNavigate?: (path: readonly number[]) => void;
	/** Optional CSS class name. */
	className?: string;
	/** Optional inline styles. */
	style?: CSSProperties;
}

// -- Heading label styles by level --

const LEVEL_LABELS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const;

const LEVEL_COLORS = [
	'#1a73e8', // H1 - blue
	'#1967d2', // H2 - darker blue
	'#185abc', // H3
	'#174ea6', // H4
	'#1a5276', // H5
	'#1b4f72', // H6
] as const;

const LEVEL_FONT_SIZES = [15, 14, 13, 13, 12, 12] as const;

const LEVEL_FONT_WEIGHTS = [600, 600, 500, 500, 400, 400] as const;

// -- Styles --

const containerStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
};

const headerStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '8px 16px',
	borderBottom: '1px solid #e0e0e0',
	flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
	fontSize: 13,
	fontWeight: 600,
	color: '#202124',
	fontFamily: 'system-ui, -apple-system, sans-serif',
};

const listContainerStyle: CSSProperties = {
	flex: 1,
	overflowY: 'auto',
	padding: '4px 0',
};

const emptyStateStyle: CSSProperties = {
	padding: '24px 16px',
	fontSize: 13,
	color: '#80868b',
	textAlign: 'center',
	fontStyle: 'italic',
	lineHeight: 1.5,
	fontFamily: 'system-ui, -apple-system, sans-serif',
};

const levelBadgeBase: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 24,
	height: 18,
	borderRadius: 3,
	fontSize: 10,
	fontWeight: 700,
	fontFamily: 'system-ui, -apple-system, sans-serif',
	flexShrink: 0,
	lineHeight: 1,
};

// -- Helpers --

/**
 * Build a tree structure for collapsible behavior.
 * Each H1 "owns" subsequent H2-H6 until the next H1, etc.
 */
interface OutlineTreeNode {
	entry: OutlineEntry;
	children: OutlineTreeNode[];
}

function buildOutlineTree(entries: readonly OutlineEntry[]): OutlineTreeNode[] {
	const roots: OutlineTreeNode[] = [];
	const stack: OutlineTreeNode[] = [];

	for (const entry of entries) {
		const node: OutlineTreeNode = { entry, children: [] };

		// Pop stack until we find a parent with a lower level
		while (stack.length > 0 && stack[stack.length - 1].entry.level >= entry.level) {
			stack.pop();
		}

		if (stack.length === 0) {
			roots.push(node);
		} else {
			stack[stack.length - 1].children.push(node);
		}
		stack.push(node);
	}

	return roots;
}

/**
 * Find the path of the paragraph containing the current cursor.
 */
function getCurrentParagraphId(editor: JPEditor | null): string | null {
	if (!editor) return null;
	const sel = editor.getSelection();
	if (!sel) return null;

	// The anchor path goes: body > section > paragraph > run > text
	// The paragraph is at depth 2 (indices 0, 1, 2 in the path)
	const path = sel.anchor.path;
	if (path.length < 3) return null;

	const doc = editor.getDocument();
	const body = doc.children[0];
	if (!body) return null;

	const sectionIdx = path[1];
	const paraIdx = path[2];
	const section = body.children[sectionIdx];
	if (!section) return null;

	const block = section.children[paraIdx];
	if (!block || block.type !== 'paragraph') return null;

	return block.id;
}

/**
 * Find the closest heading at or above the current cursor position.
 * Returns the outline entry ID that should be highlighted.
 */
function findActiveHeadingId(
	editor: JPEditor | null,
	entries: readonly OutlineEntry[],
): string | null {
	if (!editor || entries.length === 0) return null;

	const sel = editor.getSelection();
	if (!sel) return null;

	const anchorPath = sel.anchor.path;
	if (anchorPath.length < 3) return null;

	const cursorSection = anchorPath[1];
	const cursorPara = anchorPath[2];

	// Direct match: cursor is inside a heading paragraph
	const directMatch = getCurrentParagraphId(editor);
	if (directMatch) {
		const found = entries.find((e) => e.id === directMatch);
		if (found) return found.id;
	}

	// Find the last heading that appears before the cursor position
	let activeEntry: OutlineEntry | null = null;
	for (const entry of entries) {
		const entrySection = entry.path[1];
		const entryPara = entry.path[2];

		if (
			entrySection < cursorSection ||
			(entrySection === cursorSection && entryPara <= cursorPara)
		) {
			activeEntry = entry;
		} else {
			break; // Entries are in document order, so we can stop early
		}
	}

	return activeEntry?.id ?? null;
}

/**
 * Navigate to a heading paragraph by setting the cursor to
 * the beginning of the first text node in that paragraph.
 */
function navigateToHeading(editor: JPEditor, entry: OutlineEntry): void {
	const doc = editor.getDocument();
	const body = doc.children[0];
	if (!body) return;

	const sectionIdx = entry.path[1];
	const paraIdx = entry.path[2];
	const section = body.children[sectionIdx];
	if (!section) return;

	const para = section.children[paraIdx];
	if (!para || para.type !== 'paragraph') return;

	// Find the first text node path: paragraph > run[0] > text[0]
	// or paragraph > hyperlink[0] > run[0] > text[0]
	const paraNode = para as { children: readonly { type: string; children?: readonly unknown[] }[] };
	for (let ci = 0; ci < paraNode.children.length; ci++) {
		const child = paraNode.children[ci];
		if (child.type === 'run') {
			const run = child as { children: readonly unknown[] };
			if (run.children.length > 0) {
				const textPath = [...entry.path, ci, 0];
				const point = { path: textPath, offset: 0 };
				editor.setSelection({ anchor: point, focus: point });
				return;
			}
		} else if (child.type === 'hyperlink') {
			const hyperlink = child as { children: readonly { children: readonly unknown[] }[] };
			if (hyperlink.children.length > 0 && hyperlink.children[0].children.length > 0) {
				const textPath = [...entry.path, ci, 0, 0];
				const point = { path: textPath, offset: 0 };
				editor.setSelection({ anchor: point, focus: point });
				return;
			}
		}
	}
}

// -- Chevron icon --

function ChevronIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			width={16}
			height={16}
			viewBox="0 0 24 24"
			fill="currentColor"
			role="img"
			aria-hidden="true"
			style={{
				transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
				transition: 'transform 0.15s ease',
				flexShrink: 0,
			}}
		>
			<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
		</svg>
	);
}

// -- Outline document icon --

function OutlineIcon() {
	return (
		<svg width={48} height={48} viewBox="0 0 24 24" fill="#dadce0" role="img" aria-hidden="true">
			<path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z" />
		</svg>
	);
}

// -- Tree Item Component --

interface TreeItemProps {
	node: OutlineTreeNode;
	activeHeadingId: string | null;
	collapsedIds: ReadonlySet<string>;
	onToggleCollapse: (id: string) => void;
	onClickEntry: (entry: OutlineEntry) => void;
	depth: number;
}

function TreeItem({
	node,
	activeHeadingId,
	collapsedIds,
	onToggleCollapse,
	onClickEntry,
	depth,
}: TreeItemProps) {
	const { entry, children } = node;
	const hasChildren = children.length > 0;
	const isCollapsed = collapsedIds.has(entry.id);
	const isActive = activeHeadingId === entry.id;

	const level = entry.level;
	const indentPx = 8 + level * 16;

	const itemStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 6,
		padding: `5px 12px 5px ${indentPx}px`,
		cursor: 'pointer',
		backgroundColor: isActive ? '#e8f0fe' : 'transparent',
		borderLeft: isActive ? '3px solid #1a73e8' : '3px solid transparent',
		userSelect: 'none',
		fontFamily: 'system-ui, -apple-system, sans-serif',
	};

	const textStyle: CSSProperties = {
		fontSize: LEVEL_FONT_SIZES[level],
		fontWeight: LEVEL_FONT_WEIGHTS[level],
		color: isActive ? '#1a73e8' : '#3c4043',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		flex: 1,
		lineHeight: 1.4,
	};

	const badgeStyle: CSSProperties = {
		...levelBadgeBase,
		backgroundColor: isActive ? LEVEL_COLORS[level] : '#e8eaed',
		color: isActive ? '#fff' : '#5f6368',
	};

	const handleClick = useCallback(() => {
		onClickEntry(entry);
	}, [entry, onClickEntry]);

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onToggleCollapse(entry.id);
		},
		[entry.id, onToggleCollapse],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onClickEntry(entry);
			} else if (e.key === 'ArrowRight' && hasChildren && isCollapsed) {
				e.preventDefault();
				onToggleCollapse(entry.id);
			} else if (e.key === 'ArrowLeft' && hasChildren && !isCollapsed) {
				e.preventDefault();
				onToggleCollapse(entry.id);
			}
		},
		[entry, hasChildren, isCollapsed, onClickEntry, onToggleCollapse],
	);

	return (
		<li
			role="treeitem"
			aria-level={depth + 1}
			aria-expanded={hasChildren ? !isCollapsed : undefined}
			aria-selected={isActive}
			style={{ listStyle: 'none', margin: 0, padding: 0 }}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: treeitem requires a focusable interactive row */}
			<div
				role="button"
				tabIndex={0}
				style={itemStyle}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onMouseEnter={(e) => {
					if (!isActive) {
						e.currentTarget.style.backgroundColor = '#f1f3f4';
					}
				}}
				onMouseLeave={(e) => {
					if (!isActive) {
						e.currentTarget.style.backgroundColor = 'transparent';
					}
				}}
			>
				{/* Collapse toggle */}
				{hasChildren ? (
					<button
						type="button"
						onClick={handleToggle}
						aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: 20,
							height: 20,
							border: 'none',
							borderRadius: '50%',
							backgroundColor: 'transparent',
							cursor: 'pointer',
							color: '#5f6368',
							padding: 0,
							flexShrink: 0,
						}}
					>
						<ChevronIcon expanded={!isCollapsed} />
					</button>
				) : (
					<span style={{ width: 20, flexShrink: 0 }} />
				)}

				{/* Level badge */}
				<span style={badgeStyle}>{LEVEL_LABELS[level]}</span>

				{/* Heading text */}
				<span style={textStyle} title={entry.text}>
					{entry.text}
				</span>
			</div>

			{/* Children */}
			{hasChildren && !isCollapsed && (
				<ul style={{ margin: 0, padding: 0 }}>
					{children.map((child) => (
						<TreeItem
							key={child.entry.id}
							node={child}
							activeHeadingId={activeHeadingId}
							collapsedIds={collapsedIds}
							onToggleCollapse={onToggleCollapse}
							onClickEntry={onClickEntry}
							depth={depth + 1}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

// -- Main Component --

export function OutlinePanel({ editor, onNavigate, className, style }: OutlinePanelProps) {
	const outline = useDocumentOutline(editor);
	const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());

	const tree = useMemo(() => buildOutlineTree(outline), [outline]);

	const activeHeadingId = useMemo(() => findActiveHeadingId(editor, outline), [editor, outline]);

	const handleToggleCollapse = useCallback((id: string) => {
		setCollapsedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const handleClickEntry = useCallback(
		(entry: OutlineEntry) => {
			if (editor) {
				navigateToHeading(editor, entry);
			}
			onNavigate?.(entry.path);
		},
		[editor, onNavigate],
	);

	return (
		<div className={className} style={{ ...containerStyle, ...style }}>
			{/* Header */}
			<div style={headerStyle}>
				<span style={headerTitleStyle}>Outline</span>
				{outline.length > 0 && (
					<span
						style={{
							fontSize: 11,
							color: '#80868b',
							fontFamily: 'system-ui, -apple-system, sans-serif',
						}}
					>
						{outline.length} heading{outline.length !== 1 ? 's' : ''}
					</span>
				)}
			</div>

			{/* Content */}
			{outline.length === 0 ? (
				<div style={emptyStateStyle}>
					<OutlineIcon />
					<div style={{ marginTop: 8 }}>Add headings to see document outline</div>
				</div>
			) : (
				<div style={listContainerStyle}>
					<ul role="tree" aria-label="Document outline" style={{ margin: 0, padding: 0 }}>
						{tree.map((node) => (
							<TreeItem
								key={node.entry.id}
								node={node}
								activeHeadingId={activeHeadingId}
								collapsedIds={collapsedIds}
								onToggleCollapse={handleToggleCollapse}
								onClickEntry={handleClickEntry}
								depth={0}
							/>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
