/**
 * RTF Exporter — exports a JPDocument to RTF format (.doc compatible).
 *
 * Word, LibreOffice, and Google Docs all accept RTF files renamed to .doc.
 * This provides .doc export without implementing the complex OLE2/CFBF binary format.
 */

import type { JPDocument, JPParagraph, JPTable } from '@jpoffice/model';
import { serializeParagraph } from './rtf-paragraph';
import { serializeTable } from './rtf-table';
import { RtfWriter } from './rtf-writer';

export interface DocExportOptions {
	/** Include document metadata (title, author). Default true. */
	includeMetadata?: boolean;
}

/** Export a JPDocument to RTF bytes (Uint8Array). */
export function exportDoc(doc: JPDocument, options: DocExportOptions = {}): Uint8Array {
	const includeMetadata = options.includeMetadata !== false;
	const writer = new RtfWriter();

	// Register default font
	writer.addFont('Calibri');

	// Document info
	if (includeMetadata && doc.metadata) {
		let info = '';
		if (doc.metadata.title) {
			info += `{\\title ${doc.metadata.title}}`;
		}
		if (doc.metadata.author) {
			info += `{\\author ${doc.metadata.author}}`;
		}
		if (doc.metadata.description) {
			info += `{\\subject ${doc.metadata.description}}`;
		}
		info += '{\\*\\generator JPOffice RTF Export}';
		if (info) writer.setInfo(info);
	}

	// Build body content
	let bodyContent = '';
	const body = doc.children[0]; // JPBody

	for (const section of body.children) {
		const props = section.properties;

		// Section formatting
		bodyContent += `\\sectd\\pgwsxn${props.pageSize.width}\\pghsxn${props.pageSize.height}`;
		bodyContent += `\\marglsxn${props.margins.left}\\margrsxn${props.margins.right}`;
		bodyContent += `\\margtsxn${props.margins.top}\\margbsxn${props.margins.bottom}`;
		bodyContent += `\\headery${props.margins.header}\\footery${props.margins.footer}`;

		if (props.orientation === 'landscape') {
			bodyContent += '\\lndscpsxn';
		}

		bodyContent += '\n';

		// Headers/footers
		if (props.headerReferences) {
			for (const ref of props.headerReferences) {
				const header = doc.headers.get(ref.id);
				if (!header) continue;

				const hfType =
					ref.type === 'first' ? '\\headerf' : ref.type === 'even' ? '\\headerl' : '\\header';
				bodyContent += `{${hfType} `;
				for (const child of header.children) {
					if (child.type === 'paragraph') {
						bodyContent += serializeParagraph(child as JPParagraph, writer);
					}
				}
				bodyContent += '}\n';
			}
		}

		if (props.footerReferences) {
			for (const ref of props.footerReferences) {
				const footer = doc.footers.get(ref.id);
				if (!footer) continue;

				const hfType =
					ref.type === 'first' ? '\\footerf' : ref.type === 'even' ? '\\footerl' : '\\footer';
				bodyContent += `{${hfType} `;
				for (const child of footer.children) {
					if (child.type === 'paragraph') {
						bodyContent += serializeParagraph(child as JPParagraph, writer);
					}
				}
				bodyContent += '}\n';
			}
		}

		// Section content
		for (const block of section.children) {
			if (block.type === 'paragraph') {
				bodyContent += serializeParagraph(block as JPParagraph, writer);
			} else if (block.type === 'table') {
				bodyContent += serializeTable(block as JPTable, writer);
			}
		}
	}

	writer.appendBody(bodyContent);

	// Convert RTF string to Uint8Array
	const rtfString = writer.build();
	return stringToBytes(rtfString);
}

/** Convert a string to Uint8Array using UTF-8 encoding. */
function stringToBytes(str: string): Uint8Array {
	if (typeof TextEncoder !== 'undefined') {
		return new TextEncoder().encode(str);
	}
	// Fallback for environments without TextEncoder
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		bytes[i] = str.charCodeAt(i) & 0xff;
	}
	return bytes;
}
