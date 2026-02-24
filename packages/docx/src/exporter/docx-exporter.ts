import type { JPDocument } from '@jpoffice/model';
import { strToU8, zipSync } from 'fflate';
import { REL_TYPE } from '../xml/namespaces';
import { writeComments } from './comment-writer';
import { writeContentTypes } from './content-types-writer';
import { writeCoreProperties, writeDocument } from './document-writer';
import { writeFootnotes } from './footnote-writer';
import { writeNumbering } from './numbering-writer';
import {
	RelationshipTracker,
	writeDocRelationships,
	writePkgRelationships,
} from './relationships-writer';
import { writeStyles } from './styles-writer';

/** Options for DOCX export. */
export interface DocxExportOptions {
	/** Reserved for future use. */
	readonly _placeholder?: never;
}

/**
 * Export a JPDocument to .docx bytes.
 *
 * @param doc - The document model to export
 * @returns Raw bytes of the .docx file (ZIP archive)
 */
export function exportDocx(doc: JPDocument, _options?: DocxExportOptions): Uint8Array {
	const tracker = new RelationshipTracker();

	// 1. Generate document.xml and collect media/header/footer entries
	const { documentXml, mediaEntries, headerEntries, footerEntries } = writeDocument(doc, tracker);

	// 2. Generate styles.xml
	const stylesXml = writeStyles(doc.styles);

	// 3. Generate numbering.xml (if needed)
	const hasNumbering = doc.numbering.instances.length > 0;
	const numberingXml = hasNumbering ? writeNumbering(doc.numbering) : null;

	// 4. Generate footnotes.xml and endnotes.xml (if needed)
	const hasFootnotes = doc.footnotes.length > 0;
	const footnotesXml = hasFootnotes ? writeFootnotes(doc.footnotes, 'footnote') : null;

	const hasEndnotes = doc.endnotes.length > 0;
	const endnotesXml = hasEndnotes ? writeFootnotes(doc.endnotes, 'endnote') : null;

	if (hasFootnotes) {
		tracker.add(REL_TYPE.footnotes, 'footnotes.xml');
	}
	if (hasEndnotes) {
		tracker.add(REL_TYPE.endnotes, 'endnotes.xml');
	}

	// 5. Generate comments.xml (if needed)
	const hasComments = doc.comments.length > 0;
	const commentsXml = hasComments ? writeComments(doc.comments) : null;

	if (hasComments) {
		tracker.add(REL_TYPE.comments, 'comments.xml');
	}

	// 7. Generate core properties (if metadata present)
	const hasMetadata =
		doc.metadata.title ||
		doc.metadata.author ||
		doc.metadata.description ||
		doc.metadata.created ||
		doc.metadata.modified;
	const coreXml = hasMetadata ? writeCoreProperties(doc.metadata) : null;

	// 8. Generate relationships
	const pkgRelsXml = writePkgRelationships(!!coreXml);
	const docRelsXml = writeDocRelationships(tracker);

	// 9. Generate content types
	const contentTypesXml = writeContentTypes({
		hasNumbering,
		hasFootnotes,
		hasEndnotes,
		hasComments,
		hasCoreProperties: !!coreXml,
		mediaFiles: mediaEntries.map((m) => ({ path: m.path, mimeType: m.mimeType })),
		headerPaths: headerEntries.map((h) => h.path),
		footerPaths: footerEntries.map((f) => f.path),
	});

	// 10. Assemble ZIP entries
	const zipData: Record<string, Uint8Array> = {
		'[Content_Types].xml': strToU8(contentTypesXml),
		'_rels/.rels': strToU8(pkgRelsXml),
		'word/_rels/document.xml.rels': strToU8(docRelsXml),
		'word/document.xml': strToU8(documentXml),
		'word/styles.xml': strToU8(stylesXml),
	};

	if (numberingXml) {
		zipData['word/numbering.xml'] = strToU8(numberingXml);
	}

	if (footnotesXml) {
		zipData['word/footnotes.xml'] = strToU8(footnotesXml);
	}

	if (endnotesXml) {
		zipData['word/endnotes.xml'] = strToU8(endnotesXml);
	}

	if (commentsXml) {
		zipData['word/comments.xml'] = strToU8(commentsXml);
	}

	if (coreXml) {
		zipData['docProps/core.xml'] = strToU8(coreXml);
	}

	// Add header XML files
	for (const entry of headerEntries) {
		zipData[entry.path] = strToU8(entry.xml);
	}

	// Add footer XML files
	for (const entry of footerEntries) {
		zipData[entry.path] = strToU8(entry.xml);
	}

	// Add media (images) — no compression for already-compressed formats
	for (const entry of mediaEntries) {
		zipData[entry.path] = entry.data;
	}

	// 11. Create ZIP and return
	return zipSync(zipData);
}
