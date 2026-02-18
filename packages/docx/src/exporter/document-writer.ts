import type {
	JPDocument,
	JPDrawing,
	JPFooter,
	JPHeader,
	JPParagraph,
	JPSection,
	JPSectionProperties,
} from '@jpoffice/model';
import { NS, REL_TYPE } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';
import { dataUrlToUint8Array, extensionFromMime, writeDrawing } from './drawing-writer';
import type { RelationshipTracker } from './relationships-writer';
import { writeParagraphProperties, writeRun } from './run-writer';
import { writeTable } from './table-writer';

/** Function type for writing a paragraph (used by table-writer). */
export type WriteParagraphFn = (
	b: XmlBuilder,
	para: JPParagraph,
	tracker: RelationshipTracker,
) => void;

/** Information about media files collected during export. */
export interface MediaEntry {
	readonly path: string;
	readonly data: Uint8Array;
	readonly mimeType: string;
}

/** Information about header/footer XML files collected during export. */
export interface HeaderFooterEntry {
	readonly path: string;
	readonly xml: string;
}

/** Result of writing the document. */
export interface DocumentWriteResult {
	readonly documentXml: string;
	readonly mediaEntries: MediaEntry[];
	readonly headerEntries: HeaderFooterEntry[];
	readonly footerEntries: HeaderFooterEntry[];
}

/** Generate word/document.xml and collect media/header/footer entries. */
export function writeDocument(doc: JPDocument, tracker: RelationshipTracker): DocumentWriteResult {
	const mediaEntries: MediaEntry[] = [];
	const headerEntries: HeaderFooterEntry[] = [];
	const footerEntries: HeaderFooterEntry[] = [];
	let headerCounter = 0;
	let footerCounter = 0;

	// Pre-register styles and numbering relationships
	tracker.add(REL_TYPE.styles, 'styles.xml');
	if (doc.numbering.instances.length > 0) {
		tracker.add(REL_TYPE.numbering, 'numbering.xml');
	}

	// Pre-register header/footer relationships and generate their XML
	const headerRIdMap = new Map<string, string>();
	const footerRIdMap = new Map<string, string>();

	for (const section of doc.children[0].children as readonly JPSection[]) {
		const props = section.properties;

		if (props.headerReferences) {
			for (const ref of props.headerReferences) {
				if (headerRIdMap.has(ref.id)) continue;
				headerCounter++;
				const fileName = `header${headerCounter}.xml`;
				const rId = tracker.add(REL_TYPE.header, fileName);
				headerRIdMap.set(ref.id, rId);

				const header = doc.headers.get(ref.id);
				if (header) {
					const xml = writeHeaderFooterXml(header, 'w:hdr', tracker);
					headerEntries.push({ path: `word/${fileName}`, xml });
				}
			}
		}

		if (props.footerReferences) {
			for (const ref of props.footerReferences) {
				if (footerRIdMap.has(ref.id)) continue;
				footerCounter++;
				const fileName = `footer${footerCounter}.xml`;
				const rId = tracker.add(REL_TYPE.footer, fileName);
				footerRIdMap.set(ref.id, rId);

				const footer = doc.footers.get(ref.id);
				if (footer) {
					const xml = writeHeaderFooterXml(footer, 'w:ftr', tracker);
					footerEntries.push({ path: `word/${fileName}`, xml });
				}
			}
		}
	}

	// Build document.xml
	const b = new XmlBuilder();
	b.declaration();
	b.open('w:document', {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
		'xmlns:wp': NS.wp,
		'xmlns:a': NS.a,
		'xmlns:pic': NS.pic,
		'xmlns:mc': NS.mc,
	});
	b.open('w:body');

	const sections = doc.children[0].children as readonly JPSection[];
	const lastSectionIdx = sections.length - 1;

	for (let si = 0; si < sections.length; si++) {
		const section = sections[si];
		const blocks = section.children;
		const isLastSection = si === lastSectionIdx;

		for (let bi = 0; bi < blocks.length; bi++) {
			const block = blocks[bi];
			const isLastBlock = bi === blocks.length - 1;

			if (block.type === 'paragraph') {
				if (!isLastSection && isLastBlock) {
					// Non-final section: embed sectPr in last paragraph's pPr
					writeParagraphWithSectPr(
						b,
						block,
						tracker,
						section.properties,
						headerRIdMap,
						footerRIdMap,
						mediaEntries,
					);
				} else {
					writeParagraphNode(b, block, tracker, mediaEntries);
				}
			} else if (block.type === 'table') {
				writeTable(b, block, tracker, (xb, para, t) => {
					writeParagraphNode(xb, para, t, mediaEntries);
				});

				// If this is the last block of a non-final section and it's a table,
				// insert an empty paragraph with sectPr
				if (!isLastSection && isLastBlock) {
					b.open('w:p');
					b.open('w:pPr');
					writeSectionProperties(b, section.properties, headerRIdMap, footerRIdMap);
					b.close(); // w:pPr
					b.close(); // w:p
				}
			} else if (block.type === 'page-break') {
				b.open('w:p');
				b.open('w:r');
				b.empty('w:br', { 'w:type': 'page' });
				b.close(); // w:r
				b.close(); // w:p
			}
		}

		// Final section: sectPr as direct child of w:body
		if (isLastSection) {
			writeSectionProperties(b, section.properties, headerRIdMap, footerRIdMap);
		}
	}

	b.close(); // w:body
	b.close(); // w:document

	return {
		documentXml: b.build(),
		mediaEntries,
		headerEntries,
		footerEntries,
	};
}

// ─── Paragraph Writing ─────────────────────────────────────────────────────

function writeParagraphNode(
	b: XmlBuilder,
	para: JPParagraph,
	tracker: RelationshipTracker,
	mediaEntries: MediaEntry[] = [],
): void {
	b.open('w:p');

	if (para.properties && Object.keys(para.properties).length > 0) {
		writeParagraphProperties(b, para.properties);
	}

	writeInlineContent(b, para, tracker, mediaEntries);

	b.close(); // w:p
}

function writeParagraphWithSectPr(
	b: XmlBuilder,
	para: JPParagraph,
	tracker: RelationshipTracker,
	sectProps: JPSectionProperties,
	headerRIdMap: Map<string, string>,
	footerRIdMap: Map<string, string>,
	mediaEntries: MediaEntry[],
): void {
	b.open('w:p');

	const props = para.properties || {};
	writeParagraphProperties(b, props, (xb) => {
		writeSectionProperties(xb, sectProps, headerRIdMap, footerRIdMap);
	});

	writeInlineContent(b, para, tracker, mediaEntries);

	b.close(); // w:p
}

function writeInlineContent(
	b: XmlBuilder,
	para: JPParagraph,
	tracker: RelationshipTracker,
	mediaEntries: MediaEntry[],
): void {
	for (const child of para.children) {
		if (child.type === 'run') {
			writeRun(b, child);
		} else if (child.type === 'hyperlink') {
			const rId = tracker.add(REL_TYPE.hyperlink, child.href, 'External');
			b.open('w:hyperlink', { 'r:id': rId });
			for (const run of child.children) {
				writeRun(b, run);
			}
			b.close();
		} else if (child.type === 'drawing') {
			const imageData = extractDrawingImage(child as JPDrawing, mediaEntries);
			if (imageData) {
				const imageRId = tracker.add(REL_TYPE.image, `media/${imageData.fileName}`);
				b.open('w:r');
				writeDrawing(b, child as JPDrawing, imageRId);
				b.close(); // w:r
			}
		} else if (child.type === 'bookmark-start') {
			b.empty('w:bookmarkStart', {
				'w:id': child.bookmarkId,
				'w:name': child.name,
			});
		} else if (child.type === 'bookmark-end') {
			b.empty('w:bookmarkEnd', { 'w:id': child.bookmarkId });
		} else if (
			child.type === 'line-break' ||
			child.type === 'column-break' ||
			child.type === 'tab'
		) {
			writeRun(b, child);
		}
	}
}

function extractDrawingImage(
	drawing: JPDrawing,
	mediaEntries: MediaEntry[],
): { fileName: string } | null {
	const image = drawing.children[0];
	if (!image) return null;

	const result = dataUrlToUint8Array(image.properties.src);
	if (!result) return null;

	const ext = extensionFromMime(result.mimeType);
	const fileName = `image${mediaEntries.length + 1}.${ext}`;
	mediaEntries.push({
		path: `word/media/${fileName}`,
		data: result.data,
		mimeType: result.mimeType,
	});

	return { fileName };
}

// ─── Section Properties ────────────────────────────────────────────────────

function writeSectionProperties(
	b: XmlBuilder,
	props: JPSectionProperties,
	headerRIdMap: Map<string, string>,
	footerRIdMap: Map<string, string>,
): void {
	b.open('w:sectPr');

	// Header references
	if (props.headerReferences) {
		for (const ref of props.headerReferences) {
			const rId = headerRIdMap.get(ref.id);
			if (rId) {
				b.empty('w:headerReference', { 'w:type': ref.type, 'r:id': rId });
			}
		}
	}

	// Footer references
	if (props.footerReferences) {
		for (const ref of props.footerReferences) {
			const rId = footerRIdMap.get(ref.id);
			if (rId) {
				b.empty('w:footerReference', { 'w:type': ref.type, 'r:id': rId });
			}
		}
	}

	// Page size
	b.empty('w:pgSz', {
		'w:w': props.pageSize.width,
		'w:h': props.pageSize.height,
		...(props.orientation === 'landscape' ? { 'w:orient': 'landscape' } : {}),
	});

	// Margins
	b.empty('w:pgMar', {
		'w:top': props.margins.top,
		'w:right': props.margins.right,
		'w:bottom': props.margins.bottom,
		'w:left': props.margins.left,
		'w:header': props.margins.header,
		'w:footer': props.margins.footer,
		'w:gutter': props.margins.gutter,
	});

	// Columns
	if (props.columns && props.columns.count > 1) {
		b.empty('w:cols', {
			'w:num': props.columns.count,
			'w:space': props.columns.space,
			...(props.columns.separator ? { 'w:sep': '1' } : {}),
		});
	}

	b.close(); // w:sectPr
}

// ─── Header/Footer XML ────────────────────────────────────────────────────

function writeHeaderFooterXml(
	node: JPHeader | JPFooter,
	rootTag: string,
	tracker: RelationshipTracker,
): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open(rootTag, {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
	});

	for (const child of node.children) {
		if (child.type === 'paragraph') {
			writeParagraphNode(b, child, tracker);
		}
	}

	b.close();
	return b.build();
}

/** Generate docProps/core.xml. */
export function writeCoreProperties(metadata: {
	title?: string;
	author?: string;
	description?: string;
	created?: string;
	modified?: string;
	language?: string;
}): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('cp:coreProperties', {
		'xmlns:cp': NS.cp,
		'xmlns:dc': NS.dc,
		'xmlns:dcterms': NS.dcterms,
		'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
	});

	if (metadata.title) {
		b.open('dc:title');
		b.text(metadata.title);
		b.close();
	}
	if (metadata.author) {
		b.open('dc:creator');
		b.text(metadata.author);
		b.close();
	}
	if (metadata.description) {
		b.open('dc:description');
		b.text(metadata.description);
		b.close();
	}
	if (metadata.created) {
		b.open('dcterms:created', { 'xsi:type': 'dcterms:W3CDTF' });
		b.text(metadata.created);
		b.close();
	}
	if (metadata.modified) {
		b.open('dcterms:modified', { 'xsi:type': 'dcterms:W3CDTF' });
		b.text(metadata.modified);
		b.close();
	}
	if (metadata.language) {
		b.open('dc:language');
		b.text(metadata.language);
		b.close();
	}

	b.close();
	return b.build();
}
