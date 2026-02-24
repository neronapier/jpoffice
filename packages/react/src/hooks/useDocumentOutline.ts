'use client';

import type { JPEditor } from '@jpoffice/engine';
import type { JPDocument, JPParagraph, JPRun, JPText } from '@jpoffice/model';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * A single entry in the document outline.
 */
export interface OutlineEntry {
	/** Heading level: 0 = H1, 1 = H2, ... 5 = H6. */
	readonly level: number;
	/** Plain text content of the heading paragraph. */
	readonly text: string;
	/** Path to the paragraph node in the document tree. */
	readonly path: readonly number[];
	/** Paragraph ID for stable React keys. */
	readonly id: string;
}

/**
 * Extract plain text from a paragraph by iterating its inline children.
 * Handles runs and hyperlinks (which contain nested runs).
 */
function extractParagraphText(para: JPParagraph): string {
	const parts: string[] = [];
	for (const child of para.children) {
		if (child.type === 'run') {
			const run = child as JPRun;
			for (const textNode of run.children) {
				parts.push((textNode as JPText).text);
			}
		} else if (child.type === 'hyperlink') {
			// Hyperlinks contain runs
			const hyperlink = child as { children: readonly JPRun[] };
			for (const run of hyperlink.children) {
				for (const textNode of run.children) {
					parts.push((textNode as JPText).text);
				}
			}
		}
	}
	return parts.join('');
}

/**
 * Walk the document tree and collect all heading paragraphs as outline entries.
 * Headings are identified by their outlineLevel property (0-5) or by their
 * styleId matching Heading1-Heading6.
 */
function buildOutline(doc: JPDocument): readonly OutlineEntry[] {
	const entries: OutlineEntry[] = [];
	const body = doc.children[0];
	if (!body) return entries;

	for (let si = 0; si < body.children.length; si++) {
		const section = body.children[si];
		for (let pi = 0; pi < section.children.length; pi++) {
			const block = section.children[pi];
			if (block.type !== 'paragraph') continue;

			const para = block as JPParagraph;
			const props = para.properties;

			// Determine heading level from outlineLevel or styleId
			let level: number | undefined;

			if (props.outlineLevel !== undefined && props.outlineLevel !== null) {
				level = props.outlineLevel;
			} else if (props.styleId) {
				const match = /^Heading(\d)$/.exec(props.styleId);
				if (match) {
					level = Number.parseInt(match[1], 10) - 1;
				}
			}

			// Only include levels 0-5 (H1 through H6)
			if (level === undefined || level < 0 || level > 5) continue;

			const text = extractParagraphText(para);
			// Skip headings with no visible text
			if (text.trim().length === 0) continue;

			entries.push({
				level,
				text,
				path: [0, si, pi], // body[0] > section[si] > paragraph[pi]
				id: para.id,
			});
		}
	}

	return entries;
}

/**
 * Extracts headings from the document and returns them as an outline.
 * Updates when the document changes via useSyncExternalStore.
 *
 * @param editor - The JPEditor instance (or null if not yet initialized).
 * @returns An array of OutlineEntry objects in document order.
 */
export function useDocumentOutline(editor: JPEditor | null): readonly OutlineEntry[] {
	const subscribe = useCallback(
		(callback: () => void) => {
			if (!editor) return () => {};
			return editor.subscribe(callback);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => {
		if (!editor) return null;
		return editor.getDocument();
	}, [editor]);

	const doc = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return useMemo(() => {
		if (!doc) return [];
		return buildOutline(doc);
	}, [doc]);
}
