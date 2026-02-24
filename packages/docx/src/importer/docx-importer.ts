import type { JPDocument, JPMediaAsset } from '@jpoffice/model';
import {
	EMPTY_NUMBERING_REGISTRY,
	createBody,
	createDocument,
	createStyleRegistry,
	generateId,
} from '@jpoffice/model';
import { parseComments } from './comment-parser';
import { parseDocument } from './document-parser';
import { readDocxPackage } from './docx-reader';
import { parseFootnotes } from './footnote-parser';
import { parseNumbering } from './numbering-parser';
import { parseRelationships } from './relationships-parser';
import { parseStyles } from './styles-parser';
import { parseTheme } from './theme-parser';

/** Options for DOCX import. */
export interface DocxImportOptions {
	/** Reserved for future use. */
	readonly _placeholder?: never;
}

/**
 * Import a .docx file into a JPDocument.
 *
 * @param data - The raw bytes of the .docx file
 * @returns A complete JPDocument model
 */
export function importDocx(data: Uint8Array, _options?: DocxImportOptions): JPDocument {
	// 1. Unzip the .docx package
	const pkg = readDocxPackage(data);

	// 2. Parse document relationships
	const docRelsXml = pkg.xml.get('word/_rels/document.xml.rels');
	const docRels = docRelsXml ? parseRelationships(docRelsXml) : new Map();

	// 3. Parse styles
	const stylesXml = pkg.xml.get('word/styles.xml');
	const styles = stylesXml ? parseStyles(stylesXml) : createStyleRegistry([]);

	// 3b. Parse theme
	const themeXml = pkg.xml.get('word/theme/theme1.xml');
	const themeColors = themeXml ? parseTheme(themeXml) : undefined;

	// 4. Parse numbering
	const numberingXml = pkg.xml.get('word/numbering.xml');
	const numbering = numberingXml ? parseNumbering(numberingXml) : EMPTY_NUMBERING_REGISTRY;

	// 5. Parse comments
	const commentsXml = pkg.xml.get('word/comments.xml');
	const comments = commentsXml ? parseComments(commentsXml) : [];

	// 6. Parse footnotes and endnotes
	const footnotesXml = pkg.xml.get('word/footnotes.xml');
	const footnotes = footnotesXml ? parseFootnotes(footnotesXml, 'footnote') : [];

	const endnotesXml = pkg.xml.get('word/endnotes.xml');
	const endnotes = endnotesXml ? parseFootnotes(endnotesXml, 'endnote') : [];

	// 7. Parse document body, headers, footers, media, metadata
	const { sections, headers, footers, media, metadata } = parseDocument(pkg, docRels);

	// 8. Convert media bag to JPMediaAsset map
	const mediaAssets = new Map<string, JPMediaAsset>();
	for (const [_path, info] of media) {
		const assetId = generateId();
		mediaAssets.set(assetId, {
			id: assetId,
			contentType: info.contentType,
			data: info.data,
			fileName: info.fileName,
		});
	}

	// 9. Assemble the JPDocument
	const body = createBody(generateId(), sections);
	return createDocument({
		id: generateId(),
		body,
		styles,
		numbering,
		metadata,
		media: mediaAssets,
		headers,
		footers,
		comments,
		footnotes,
		endnotes,
		themeColors: themeColors as Record<string, string> | undefined,
	});
}
