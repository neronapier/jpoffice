import { CONTENT_TYPE } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';

/** Information about parts in the DOCX package for content types. */
export interface PackageParts {
	readonly hasNumbering: boolean;
	readonly hasCoreProperties: boolean;
	readonly mediaFiles: readonly { path: string; mimeType: string }[];
	readonly headerPaths: readonly string[];
	readonly footerPaths: readonly string[];
}

/** Generate [Content_Types].xml. */
export function writeContentTypes(parts: PackageParts): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('Types', {
		xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types',
	});

	// Default extensions
	b.empty('Default', { Extension: 'rels', ContentType: CONTENT_TYPE.relationships });
	b.empty('Default', { Extension: 'xml', ContentType: 'application/xml' });

	// Track image extensions we've already declared
	const declaredExts = new Set<string>();
	for (const media of parts.mediaFiles) {
		const ext = media.path.split('.').pop()?.toLowerCase();
		if (ext && !declaredExts.has(ext)) {
			declaredExts.add(ext);
			b.empty('Default', { Extension: ext, ContentType: media.mimeType });
		}
	}

	// Override for specific parts
	b.empty('Override', {
		PartName: '/word/document.xml',
		ContentType: CONTENT_TYPE.document,
	});
	b.empty('Override', {
		PartName: '/word/styles.xml',
		ContentType: CONTENT_TYPE.styles,
	});

	if (parts.hasNumbering) {
		b.empty('Override', {
			PartName: '/word/numbering.xml',
			ContentType: CONTENT_TYPE.numbering,
		});
	}

	if (parts.hasCoreProperties) {
		b.empty('Override', {
			PartName: '/docProps/core.xml',
			ContentType: CONTENT_TYPE.coreProperties,
		});
	}

	for (const path of parts.headerPaths) {
		b.empty('Override', {
			PartName: `/${path}`,
			ContentType: CONTENT_TYPE.header,
		});
	}

	for (const path of parts.footerPaths) {
		b.empty('Override', {
			PartName: `/${path}`,
			ContentType: CONTENT_TYPE.footer,
		});
	}

	b.close(); // Types
	return b.build();
}
