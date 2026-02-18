import type { JPDocument, JPMediaAsset } from '@jpoffice/model';
import {
	EMPTY_NUMBERING_REGISTRY,
	createBody,
	createDocument,
	createStyleRegistry,
	generateId,
} from '@jpoffice/model';
import { parseDocument } from './document-parser';
import { readDocxPackage } from './docx-reader';
import { parseNumbering } from './numbering-parser';
import { parseRelationships } from './relationships-parser';
import { parseStyles } from './styles-parser';

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

	// 4. Parse numbering
	const numberingXml = pkg.xml.get('word/numbering.xml');
	const numbering = numberingXml ? parseNumbering(numberingXml) : EMPTY_NUMBERING_REGISTRY;

	// 5. Parse document body, headers, footers, media, metadata
	const { sections, headers, footers, media, metadata } = parseDocument(pkg, docRels);

	// 6. Convert media bag to JPMediaAsset map
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

	// 7. Assemble the JPDocument
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
	});
}
