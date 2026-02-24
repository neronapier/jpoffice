import type { JPComment } from '@jpoffice/model';
import { createComment } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild, textContent } from '../xml/xml-parser';

// ─── Comment Parsing ────────────────────────────────────────────────────────

/**
 * Parse word/comments.xml into an array of JPComment objects.
 *
 * Expected XML structure:
 * ```xml
 * <w:comments xmlns:w="...">
 *   <w:comment w:id="0" w:author="John" w:date="2024-01-01T00:00:00Z">
 *     <w:p><w:r><w:t>Comment text</w:t></w:r></w:p>
 *   </w:comment>
 * </w:comments>
 * ```
 */
export function parseComments(doc: Document): JPComment[] {
	const root = doc.documentElement;
	if (!root) return [];

	const commentEls = getDirectChildren(root, NS.w, 'comment');
	const comments: JPComment[] = [];

	for (const el of commentEls) {
		const id = attrNS(el, NS.w, 'id') || '0';
		const author = attrNS(el, NS.w, 'author') || '';
		const date = attrNS(el, NS.w, 'date') || '';

		// Extract text from all w:p > w:r > w:t elements
		const text = extractCommentText(el);

		comments.push(
			createComment({
				id,
				author,
				text,
				date: date || undefined,
			}),
		);
	}

	return comments;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract plain text from a comment element's paragraph/run structure. */
function extractCommentText(commentEl: Element): string {
	const paragraphs = getDirectChildren(commentEl, NS.w, 'p');
	const parts: string[] = [];

	for (const p of paragraphs) {
		const runs = getDirectChildren(p, NS.w, 'r');
		for (const r of runs) {
			const tEl = getFirstChild(r, NS.w, 't');
			if (tEl) {
				parts.push(textContent(tEl));
			}
		}
	}

	return parts.join('');
}
