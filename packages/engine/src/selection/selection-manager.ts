import type { JPDocument, JPPath, JPPoint, JPRange, JPSelection } from '@jpoffice/model';
import { comparePaths, getNodeAtPath, isText, traverseTexts } from '@jpoffice/model';

/**
 * Manage selection state and provide selection-related utilities.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: acts as a namespace used across 50+ call sites
export class SelectionManager {
	/**
	 * Create a collapsed selection (cursor) at a point.
	 */
	static collapse(path: JPPath, offset: number): JPSelection {
		const point: JPPoint = { path, offset };
		return { anchor: point, focus: point };
	}

	/**
	 * Create a range selection.
	 */
	static createRange(
		anchorPath: JPPath,
		anchorOffset: number,
		focusPath: JPPath,
		focusOffset: number,
	): JPSelection {
		return {
			anchor: { path: anchorPath, offset: anchorOffset },
			focus: { path: focusPath, offset: focusOffset },
		};
	}

	/**
	 * Check if a selection is collapsed (cursor, not a range).
	 */
	static isCollapsed(selection: JPSelection): boolean {
		if (!selection) return true;
		return (
			selection.anchor.offset === selection.focus.offset &&
			selection.anchor.path.length === selection.focus.path.length &&
			selection.anchor.path.every((v, i) => v === selection.focus.path[i])
		);
	}

	/**
	 * Get the text content of the current selection.
	 */
	static getSelectedText(doc: JPDocument, selection: JPSelection): string {
		if (!selection || SelectionManager.isCollapsed(selection)) return '';

		try {
			// Normalize so anchor is before focus
			const normalized = SelectionManager.normalize(selection);
			const startPath = normalized.anchor.path;
			const startOffset = normalized.anchor.offset;
			const endPath = normalized.focus.path;
			const endOffset = normalized.focus.offset;

			// Same text node selection
			if (startPath.length === endPath.length && startPath.every((v, i) => v === endPath[i])) {
				const node = getNodeAtPath(doc, startPath);
				if (isText(node)) {
					return node.text.slice(startOffset, endOffset);
				}
				return '';
			}

			// Cross-node: traverse all text nodes and collect text between anchor and focus
			const parts: string[] = [];
			let inRange = false;
			let lastParagraphPath: string | null = null;

			for (const [textNode, textPath] of traverseTexts(doc)) {
				const cmpStart: number = comparePaths(textPath, startPath);
				const cmpEnd: number = comparePaths(textPath, endPath);

				// Check if this text node is at the start
				if (cmpStart === 0) {
					inRange = true;
					parts.push(textNode.text.slice(startOffset));
					lastParagraphPath = getParagraphPathKey(textPath);
					continue;
				}

				// Check if this text node is at the end
				if (cmpEnd === 0) {
					// Add newline between paragraphs if needed
					const paraKey = getParagraphPathKey(textPath);
					if (lastParagraphPath !== null && paraKey !== lastParagraphPath) {
						parts.push('\n');
					}
					parts.push(textNode.text.slice(0, endOffset));
					break;
				}

				// In between: include entire text node
				if (inRange && cmpEnd < 0) {
					const paraKey = getParagraphPathKey(textPath);
					if (lastParagraphPath !== null && paraKey !== lastParagraphPath) {
						parts.push('\n');
					}
					parts.push(textNode.text);
					lastParagraphPath = paraKey;
				} else if (!inRange && cmpStart > 0) {
					// We're past start but haven't seen start node — start is between nodes
					inRange = true;
					const paraKey = getParagraphPathKey(textPath);
					if (lastParagraphPath !== null && paraKey !== lastParagraphPath) {
						parts.push('\n');
					}
					if (cmpEnd >= 0) {
						parts.push(textNode.text.slice(0, cmpEnd === 0 ? endOffset : textNode.text.length));
						if (cmpEnd === 0) break;
					} else {
						parts.push(textNode.text);
					}
					lastParagraphPath = paraKey;
				}
			}

			return parts.join('');
		} catch {
			return '';
		}
	}

	/**
	 * Normalize a selection to ensure anchor comes before focus (forward direction).
	 */
	static normalize(selection: JPRange): JPRange {
		const { anchor, focus } = selection;

		// Compare paths
		for (let i = 0; i < Math.min(anchor.path.length, focus.path.length); i++) {
			if (anchor.path[i] < focus.path[i]) return selection;
			if (anchor.path[i] > focus.path[i]) return { anchor: focus, focus: anchor };
		}

		// Same path - compare offsets
		if (anchor.offset <= focus.offset) return selection;
		return { anchor: focus, focus: anchor };
	}
}

/**
 * Get a key representing the paragraph containing this text node path.
 * Paragraph is typically 3 levels deep: body/section/paragraph → path[0..2]
 * We use path minus last 2 components (run index + text index).
 */
function getParagraphPathKey(textPath: JPPath): string {
	// Text node path: [...paragraphPath, runIndex, textIndex]
	// Paragraph path is everything except the last 2 segments
	const paraPath = textPath.slice(0, -2);
	return paraPath.join(',');
}
