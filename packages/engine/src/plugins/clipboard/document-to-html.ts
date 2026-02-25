import type {
	JPDocument,
	JPHyperlink,
	JPNode,
	JPParagraph,
	JPPath,
	JPRange,
	JPRun,
	JPRunProperties,
} from '@jpoffice/model';
import { comparePaths, getNodeAtPath, isElement } from '@jpoffice/model';
import { SelectionManager } from '../../selection/selection-manager';

/**
 * Convert the selected portion of a document to an HTML string.
 * Used for rich copy so that formatting is preserved when pasting
 * into other applications or back into the editor.
 */
export function documentToHtml(doc: JPDocument, selection: JPRange): string {
	if (SelectionManager.isCollapsed(selection)) return '';

	const normalized = SelectionManager.normalize(selection);
	const startPath = normalized.anchor.path;
	const startOffset = normalized.anchor.offset;
	const endPath = normalized.focus.path;
	const endOffset = normalized.focus.offset;

	// Same text node
	if (pathEquals(startPath, endPath)) {
		const textNode = getNodeAtPath(doc, startPath);
		if (!textNode || textNode.type !== 'text') return '';
		const text = (textNode as unknown as { text: string }).text.slice(startOffset, endOffset);
		const runPath = startPath.slice(0, -1);
		const run = getNodeAtPath(doc, runPath) as JPRun;
		return wrapTextInRunHtml(escapeHtml(text), run.properties);
	}

	// Collect paragraphs that overlap the selection
	const paragraphs = collectParagraphsInRange(doc, startPath, endPath);

	const parts: string[] = [];
	for (const { node, path } of paragraphs) {
		parts.push(paragraphToHtml(doc, node, path, startPath, startOffset, endPath, endOffset));
	}

	return parts.join('');
}

// ── Paragraph-level serialization ───────────────────────────────────

function paragraphToHtml(
	doc: JPDocument,
	para: JPParagraph,
	paraPath: JPPath,
	startPath: JPPath,
	startOffset: number,
	endPath: JPPath,
	endOffset: number,
): string {
	const tag = getHeadingTag(para);
	const styleAttr = getParagraphStyleAttr(para);
	const inner = paragraphChildrenToHtml(
		doc,
		para,
		paraPath,
		startPath,
		startOffset,
		endPath,
		endOffset,
	);
	return `<${tag}${styleAttr}>${inner}</${tag}>`;
}

function getHeadingTag(para: JPParagraph): string {
	const level = para.properties.outlineLevel;
	if (level !== undefined && level >= 0 && level <= 5) {
		return `h${level + 1}`;
	}
	return 'p';
}

function getParagraphStyleAttr(para: JPParagraph): string {
	const styles: string[] = [];

	if (para.properties.alignment && para.properties.alignment !== 'left') {
		styles.push(`text-align: ${para.properties.alignment}`);
	}

	if (styles.length > 0) {
		return ` style="${styles.join('; ')}"`;
	}
	return '';
}

function paragraphChildrenToHtml(
	_doc: JPDocument,
	para: JPParagraph,
	paraPath: JPPath,
	startPath: JPPath,
	startOffset: number,
	endPath: JPPath,
	endOffset: number,
): string {
	const parts: string[] = [];

	for (let i = 0; i < para.children.length; i++) {
		const child = para.children[i];
		const childPath = [...paraPath, i];

		if (child.type === 'run') {
			const runHtml = runToHtml(
				child as JPRun,
				childPath,
				startPath,
				startOffset,
				endPath,
				endOffset,
			);
			if (runHtml) parts.push(runHtml);
		} else if (child.type === 'hyperlink') {
			const linkHtml = hyperlinkToHtml(
				child as JPHyperlink,
				childPath,
				startPath,
				startOffset,
				endPath,
				endOffset,
			);
			if (linkHtml) parts.push(linkHtml);
		}
		// line-break, tab, drawing, etc. are skipped for simplicity
	}

	return parts.join('');
}

// ── Run-level serialization ─────────────────────────────────────────

function runToHtml(
	run: JPRun,
	runPath: JPPath,
	startPath: JPPath,
	startOffset: number,
	endPath: JPPath,
	endOffset: number,
): string {
	const textParts: string[] = [];

	for (let t = 0; t < run.children.length; t++) {
		const textNode = run.children[t];
		const textPath = [...runPath, t];

		const cmpStart = comparePaths(textPath, startPath);
		const cmpEnd = comparePaths(textPath, endPath);

		// Before selection start — skip
		if (cmpStart < 0) continue;
		// After selection end — stop
		if (cmpEnd > 0) break;

		let text = textNode.text;

		if (cmpStart === 0 && cmpEnd === 0) {
			// Both start and end are in this text node
			text = text.slice(startOffset, endOffset);
		} else if (cmpStart === 0) {
			// Start is in this text node
			text = text.slice(startOffset);
		} else if (cmpEnd === 0) {
			// End is in this text node
			text = text.slice(0, endOffset);
		}
		// else: fully inside selection, use entire text

		if (text.length > 0) {
			textParts.push(escapeHtml(text));
		}
	}

	if (textParts.length === 0) return '';

	return wrapTextInRunHtml(textParts.join(''), run.properties);
}

function wrapTextInRunHtml(content: string, props: JPRunProperties): string {
	let html = content;

	// Wrap with formatting tags
	if (props.bold) html = `<strong>${html}</strong>`;
	if (props.italic) html = `<em>${html}</em>`;
	if (props.underline && props.underline !== 'none') html = `<u>${html}</u>`;
	if (props.strikethrough) html = `<s>${html}</s>`;
	if (props.superscript) html = `<sup>${html}</sup>`;
	if (props.subscript) html = `<sub>${html}</sub>`;

	// Wrap with span for style properties
	const styles = runPropertiesToCss(props);
	if (styles) {
		html = `<span style="${styles}">${html}</span>`;
	}

	return html;
}

function runPropertiesToCss(props: JPRunProperties): string {
	const parts: string[] = [];

	if (props.fontFamily) {
		parts.push(`font-family: '${props.fontFamily}'`);
	}

	if (props.fontSize) {
		// half-points to px: px = halfPts / 1.5
		const px = Math.round((props.fontSize / 1.5) * 100) / 100;
		parts.push(`font-size: ${px}px`);
	}

	if (props.color) {
		parts.push(`color: #${props.color}`);
	}

	if (props.backgroundColor) {
		parts.push(`background-color: #${props.backgroundColor}`);
	}

	return parts.join('; ');
}

// ── Hyperlink serialization ─────────────────────────────────────────

function hyperlinkToHtml(
	link: JPHyperlink,
	linkPath: JPPath,
	startPath: JPPath,
	startOffset: number,
	endPath: JPPath,
	endOffset: number,
): string {
	const inner: string[] = [];

	for (let r = 0; r < link.children.length; r++) {
		const run = link.children[r];
		const runPath = [...linkPath, r];
		const html = runToHtml(run, runPath, startPath, startOffset, endPath, endOffset);
		if (html) inner.push(html);
	}

	if (inner.length === 0) return '';

	const href = escapeAttr(link.href);
	return `<a href="${href}">${inner.join('')}</a>`;
}

// ── Helpers ─────────────────────────────────────────────────────────

function pathEquals(a: JPPath, b: JPPath): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function collectParagraphsInRange(
	doc: JPDocument,
	startPath: JPPath,
	endPath: JPPath,
): Array<{ node: JPParagraph; path: JPPath }> {
	// Paragraph path is text path minus last 2 segments (runIdx, textIdx)
	const startParaPath = startPath.slice(0, -2);
	const endParaPath = endPath.slice(0, -2);

	const result: Array<{ node: JPParagraph; path: JPPath }> = [];

	function walk(node: JPNode, path: JPPath): void {
		if (node.type === 'paragraph') {
			const cmpStart = comparePaths(path, startParaPath);
			const cmpEnd = comparePaths(path, endParaPath);
			if (cmpStart >= 0 && cmpEnd <= 0) {
				result.push({ node: node as JPParagraph, path });
			}
			return;
		}
		if (isElement(node)) {
			for (let i = 0; i < node.children.length; i++) {
				walk(node.children[i], [...path, i]);
			}
		}
	}

	walk(doc, []);
	return result;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
