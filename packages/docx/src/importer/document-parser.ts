import type {
	JPBlockNode,
	JPDocumentMetadata,
	JPFieldType,
	JPFooter,
	JPHeader,
	JPHeaderFooterRef,
	JPHeaderFooterType,
	JPInlineNode,
	JPLineNumbering,
	JPOrientation,
	JPPageBorderSide,
	JPPageBorders,
	JPSection,
	JPSectionColumns,
	JPSectionProperties,
} from '@jpoffice/model';
import {
	DEFAULT_SECTION_PROPERTIES,
	createBookmarkEnd,
	createBookmarkStart,
	createCommentRangeEnd,
	createCommentRangeStart,
	createField,
	createFooter,
	createHeader,
	createHyperlink,
	createParagraph,
	type createRun,
	createSection,
	generateId,
} from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild, textContent } from '../xml/xml-parser';
import type { DocxPackage } from './docx-reader';
import { mimeFromExtension, parseDrawing } from './drawing-parser';
import { parseEquation } from './equation-parser';
import type { RelationshipMap } from './relationships-parser';
import { resolveTarget } from './relationships-parser';
import { parseParagraphProperties, parseRunWithBreaks } from './run-parser';
import type { MediaBag } from './table-parser';
import { parseTable } from './table-parser';

/** Result of parsing the document body. */
export interface DocumentParseResult {
	readonly sections: JPSection[];
	readonly headers: Map<string, JPHeader>;
	readonly footers: Map<string, JPFooter>;
	readonly media: MediaBag;
	readonly metadata: JPDocumentMetadata;
}

/** Parse word/document.xml and related parts into document model pieces. */
export function parseDocument(pkg: DocxPackage, docRels: RelationshipMap): DocumentParseResult {
	const headers = new Map<string, JPHeader>();
	const footers = new Map<string, JPFooter>();
	const mediaBag: MediaBag = new Map();

	// Pre-extract media files
	extractMedia(pkg, docRels, mediaBag);

	const docXml = pkg.xml.get('word/document.xml');
	if (!docXml) {
		return {
			sections: [createSection(generateId(), [], DEFAULT_SECTION_PROPERTIES)],
			headers,
			footers,
			media: mediaBag,
			metadata: parseMetadata(pkg),
		};
	}

	const root = docXml.documentElement;
	const body = getFirstChild(root, NS.w, 'body');
	if (!body) {
		return {
			sections: [createSection(generateId(), [], DEFAULT_SECTION_PROPERTIES)],
			headers,
			footers,
			media: mediaBag,
			metadata: parseMetadata(pkg),
		};
	}

	// Parse body children, splitting into sections
	const sections = parseBody(body, pkg, docRels, mediaBag, headers, footers);

	return {
		sections,
		headers,
		footers,
		media: mediaBag,
		metadata: parseMetadata(pkg),
	};
}

// ─── Body Parsing ──────────────────────────────────────────────────────────

function parseBody(
	body: Element,
	pkg: DocxPackage,
	docRels: RelationshipMap,
	mediaBag: MediaBag,
	headers: Map<string, JPHeader>,
	footers: Map<string, JPFooter>,
): JPSection[] {
	const sections: JPSection[] = [];
	let currentBlocks: JPBlockNode[] = [];

	const children = body.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const el = child as Element;
		if (el.namespaceURI !== NS.w) continue;

		if (el.localName === 'p') {
			const pPr = getFirstChild(el, NS.w, 'pPr');
			const sectPr = pPr ? getFirstChild(pPr, NS.w, 'sectPr') : null;

			const paragraph = parseParagraphElement(el, docRels, mediaBag);
			currentBlocks.push(paragraph);

			// Section boundary: sectPr in last paragraph's pPr
			if (sectPr) {
				const props = parseSectionProperties(sectPr, pkg, docRels, headers, footers);
				sections.push(createSection(generateId(), currentBlocks, props));
				currentBlocks = [];
			}
		} else if (el.localName === 'tbl') {
			const table = parseTable(el, docRels, mediaBag, parseParagraphElement);
			currentBlocks.push(table);
		} else if (el.localName === 'sectPr') {
			// Final section properties at body level
			const props = parseSectionProperties(el, pkg, docRels, headers, footers);
			sections.push(createSection(generateId(), currentBlocks, props));
			currentBlocks = [];
		}
	}

	// If there are remaining blocks without a final sectPr
	if (currentBlocks.length > 0) {
		sections.push(createSection(generateId(), currentBlocks, DEFAULT_SECTION_PROPERTIES));
	}

	// Ensure at least one section
	if (sections.length === 0) {
		sections.push(createSection(generateId(), [], DEFAULT_SECTION_PROPERTIES));
	}

	return sections;
}

// ─── Paragraph Parsing ─────────────────────────────────────────────────────

function parseParagraphElement(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ReturnType<typeof createParagraph> {
	const pPr = getFirstChild(el, NS.w, 'pPr');
	const properties = pPr ? parseParagraphProperties(pPr) : {};

	const inlines: JPInlineNode[] = [];

	const children = el.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;

		if (ce.namespaceURI === NS.w) {
			switch (ce.localName) {
				case 'r': {
					// Skip runs that only contain w:commentReference (comment marker runs)
					if (isCommentReferenceRun(ce)) break;
					const nodes = parseRunWithBreaks(ce);
					for (const node of nodes) inlines.push(node);
					break;
				}
				case 'hyperlink': {
					const hyperlink = parseHyperlink(ce, rels);
					if (hyperlink) inlines.push(hyperlink);
					break;
				}
				case 'bookmarkStart': {
					const bmId = attrNS(ce, NS.w, 'id') || '0';
					const bmName = attrNS(ce, NS.w, 'name') || '';
					inlines.push(createBookmarkStart(generateId(), bmId, bmName));
					break;
				}
				case 'bookmarkEnd': {
					const bmId = attrNS(ce, NS.w, 'id') || '0';
					inlines.push(createBookmarkEnd(generateId(), bmId));
					break;
				}
				case 'commentRangeStart': {
					const commentId = attrNS(ce, NS.w, 'id') || '0';
					inlines.push(createCommentRangeStart(generateId(), commentId));
					break;
				}
				case 'commentRangeEnd': {
					const commentId = attrNS(ce, NS.w, 'id') || '0';
					inlines.push(createCommentRangeEnd(generateId(), commentId));
					break;
				}
				case 'fldSimple': {
					const instr = attrNS(ce, NS.w, 'instr') || '';
					const fieldType = parseFieldInstruction(instr);
					let cachedResult = '';
					const innerRuns = ce.childNodes;
					for (let j = 0; j < innerRuns.length; j++) {
						const ir = innerRuns[j];
						if (ir.nodeType !== 1) continue;
						const ire = ir as Element;
						if (ire.namespaceURI === NS.w && ire.localName === 'r') {
							const t = getFirstChild(ire, NS.w, 't');
							if (t) cachedResult += textContent(t);
						}
					}
					inlines.push(
						createField(generateId(), fieldType, { instruction: instr.trim(), cachedResult }),
					);
					break;
				}
				case 'ins':
				case 'del': {
					const author = attrNS(ce, NS.w, 'author') || '';
					const date = attrNS(ce, NS.w, 'date') || '';
					const revType = ce.localName === 'ins' ? 'insertion' : 'deletion';
					const revisionId = attrNS(ce, NS.w, 'id') || generateId();
					const revisionContext = {
						revisionId,
						author,
						date,
						type: revType as 'insertion' | 'deletion',
					};
					const insChildren = ce.childNodes;
					for (let j = 0; j < insChildren.length; j++) {
						const insChild = insChildren[j];
						if (insChild.nodeType !== 1) continue;
						const ice = insChild as Element;
						if (ice.namespaceURI === NS.w && ice.localName === 'r') {
							const revNodes = parseRunWithBreaks(ice, revisionContext);
							for (const node of revNodes) inlines.push(node);
						}
					}
					break;
				}
			}
		}

		// Handle w:drawing inside runs (some docs have it directly in paragraph)
		if (ce.namespaceURI === NS.w && ce.localName === 'r') {
			const drawingEl = getFirstChild(ce, NS.w, 'drawing');
			if (drawingEl) {
				const drawing = parseDrawing(drawingEl, rels, mediaBag);
				if (drawing) inlines.push(drawing);
			}
		}

		// Handle mc:AlternateContent
		if (ce.namespaceURI === NS.mc && ce.localName === 'AlternateContent') {
			const fallback = getFirstChild(ce, NS.mc, 'Fallback');
			if (fallback) {
				// Parse fallback content as if it were paragraph children
				const fbChildren = fallback.childNodes;
				for (let j = 0; j < fbChildren.length; j++) {
					const fb = fbChildren[j];
					if (fb.nodeType !== 1) continue;
					const fbe = fb as Element;
					if (fbe.namespaceURI === NS.w && fbe.localName === 'r') {
						const nodes = parseRunWithBreaks(fbe);
						for (const node of nodes) inlines.push(node);
					}
				}
			}
		}

		// Handle math equations (m: namespace)
		if (ce.namespaceURI === NS.m && (ce.localName === 'oMath' || ce.localName === 'oMathPara')) {
			const equation = parseEquation(ce);
			if (equation) inlines.push(equation);
		}
	}

	return createParagraph(generateId(), inlines, properties);
}

// ─── Hyperlink Parsing ─────────────────────────────────────────────────────

function parseHyperlink(
	el: Element,
	rels: RelationshipMap,
): ReturnType<typeof createHyperlink> | null {
	const rId = attrNS(el, NS.r, 'id');
	const anchor = attrNS(el, NS.w, 'anchor');
	const tooltip = attrNS(el, NS.w, 'tooltip');

	let href = '';
	if (rId) {
		const rel = rels.get(rId);
		if (rel) href = rel.target;
	} else if (anchor) {
		href = `#${anchor}`;
	}

	// Parse runs inside the hyperlink
	const runs: ReturnType<typeof createRun>[] = [];
	const children = el.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI === NS.w && ce.localName === 'r') {
			const nodes = parseRunWithBreaks(ce);
			for (const node of nodes) {
				if (node.type === 'run') runs.push(node as ReturnType<typeof createRun>);
			}
		}
	}

	if (runs.length === 0) return null;

	return createHyperlink(generateId(), runs, href, tooltip ?? undefined);
}

// ─── Section Properties ────────────────────────────────────────────────────

function parseSectionProperties(
	el: Element,
	pkg: DocxPackage,
	docRels: RelationshipMap,
	headers: Map<string, JPHeader>,
	footers: Map<string, JPFooter>,
): JPSectionProperties {
	const pgSz = getFirstChild(el, NS.w, 'pgSz');
	const pgMar = getFirstChild(el, NS.w, 'pgMar');

	const width = pgSz ? intOrDefault(attrNS(pgSz, NS.w, 'w'), 11906) : 11906;
	const height = pgSz ? intOrDefault(attrNS(pgSz, NS.w, 'h'), 16838) : 16838;
	const orient = pgSz ? attrNS(pgSz, NS.w, 'orient') : null;
	const orientation: JPOrientation = orient === 'landscape' ? 'landscape' : 'portrait';

	const margins = {
		top: pgMar ? intOrDefault(attrNS(pgMar, NS.w, 'top'), 1440) : 1440,
		right: pgMar
			? intOrDefault(attrNS(pgMar, NS.w, 'right') ?? attrNS(pgMar, NS.w, 'end'), 1440)
			: 1440,
		bottom: pgMar ? intOrDefault(attrNS(pgMar, NS.w, 'bottom'), 1440) : 1440,
		left: pgMar
			? intOrDefault(attrNS(pgMar, NS.w, 'left') ?? attrNS(pgMar, NS.w, 'start'), 1440)
			: 1440,
		header: pgMar ? intOrDefault(attrNS(pgMar, NS.w, 'header'), 720) : 720,
		footer: pgMar ? intOrDefault(attrNS(pgMar, NS.w, 'footer'), 720) : 720,
		gutter: pgMar ? intOrDefault(attrNS(pgMar, NS.w, 'gutter'), 0) : 0,
	};

	let columns: JPSectionColumns | undefined;
	const cols = getFirstChild(el, NS.w, 'cols');
	if (cols) {
		const num = attrNS(cols, NS.w, 'num');
		const space = attrNS(cols, NS.w, 'space');
		const sep = attrNS(cols, NS.w, 'sep');
		if (num && Number.parseInt(num, 10) > 1) {
			columns = {
				count: Number.parseInt(num, 10),
				space: space ? Number.parseInt(space, 10) : 720,
				separator: sep === '1' || sep === 'true',
			};
		}
	}

	let headerReferences: JPHeaderFooterRef[] | undefined;
	const headerRefs = getDirectChildren(el, NS.w, 'headerReference');
	if (headerRefs.length > 0) {
		const refs: JPHeaderFooterRef[] = [];
		for (const ref of headerRefs) {
			const hfRef = parseHeaderFooterRef(ref, 'header', pkg, docRels, headers, footers);
			if (hfRef) refs.push(hfRef);
		}
		if (refs.length > 0) headerReferences = refs;
	}

	let footerReferences: JPHeaderFooterRef[] | undefined;
	const footerRefs = getDirectChildren(el, NS.w, 'footerReference');
	if (footerRefs.length > 0) {
		const refs: JPHeaderFooterRef[] = [];
		for (const ref of footerRefs) {
			const hfRef = parseHeaderFooterRef(ref, 'footer', pkg, docRels, headers, footers);
			if (hfRef) refs.push(hfRef);
		}
		if (refs.length > 0) footerReferences = refs;
	}

	// Page borders
	let pageBorders: JPPageBorders | undefined;
	const pgBorders = getFirstChild(el, NS.w, 'pgBorders');
	if (pgBorders) {
		const parseBorderSide = (side: Element | null): JPPageBorderSide | undefined => {
			if (!side) return undefined;
			return {
				style: attrNS(side, NS.w, 'val') ?? 'single',
				color: attrNS(side, NS.w, 'color') ?? '#000000',
				width: intOrDefault(attrNS(side, NS.w, 'sz'), 4),
				space: intOrDefault(attrNS(side, NS.w, 'space'), 0),
			};
		};
		const display = (attrNS(pgBorders, NS.w, 'display') ?? 'allPages') as JPPageBorders['display'];
		const offsetFrom = (attrNS(pgBorders, NS.w, 'offsetFrom') ??
			'page') as JPPageBorders['offsetFrom'];
		pageBorders = {
			top: parseBorderSide(getFirstChild(pgBorders, NS.w, 'top')),
			bottom: parseBorderSide(getFirstChild(pgBorders, NS.w, 'bottom')),
			left: parseBorderSide(getFirstChild(pgBorders, NS.w, 'left')),
			right: parseBorderSide(getFirstChild(pgBorders, NS.w, 'right')),
			display,
			offsetFrom,
		};
	}

	// Line numbering
	let lineNumbering: JPLineNumbering | undefined;
	const lnNumType = getFirstChild(el, NS.w, 'lnNumType');
	if (lnNumType) {
		lineNumbering = {
			start: intOrDefault(attrNS(lnNumType, NS.w, 'start'), 1),
			countBy: intOrDefault(attrNS(lnNumType, NS.w, 'countBy'), 1),
			restart: (attrNS(lnNumType, NS.w, 'restart') ?? 'newPage') as JPLineNumbering['restart'],
			distance: intOrDefault(attrNS(lnNumType, NS.w, 'distance'), 360),
		};
	}

	const result: JPSectionProperties = {
		pageSize: { width, height },
		margins,
		orientation,
		...(columns ? { columns } : {}),
		...(headerReferences ? { headerReferences } : {}),
		...(footerReferences ? { footerReferences } : {}),
		...(pageBorders ? { pageBorders } : {}),
		...(lineNumbering ? { lineNumbering } : {}),
	};

	return result;
}

function parseHeaderFooterRef(
	el: Element,
	kind: 'header' | 'footer',
	pkg: DocxPackage,
	docRels: RelationshipMap,
	headers: Map<string, JPHeader>,
	footers: Map<string, JPFooter>,
): JPHeaderFooterRef | null {
	const type = (attrNS(el, NS.w, 'type') || 'default') as JPHeaderFooterType;
	const rId = attrNS(el, NS.r, 'id');
	if (!rId) return null;

	const rel = docRels.get(rId);
	if (!rel) return null;

	const target = resolveTarget(rel.target, 'word/');
	const xml = pkg.xml.get(target);
	if (!xml) return null;

	const nodeId = generateId();
	const content = parseHeaderFooterContent(xml, docRels, new Map());

	if (kind === 'header') {
		headers.set(nodeId, createHeader(nodeId, content));
	} else {
		footers.set(nodeId, createFooter(nodeId, content));
	}

	return { type, id: nodeId };
}

function parseHeaderFooterContent(
	doc: Document,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ReturnType<typeof createParagraph>[] {
	const root = doc.documentElement;
	const result: ReturnType<typeof createParagraph>[] = [];

	const children = root.childNodes;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI === NS.w && ce.localName === 'p') {
			result.push(parseParagraphElement(ce, rels, mediaBag));
		}
	}

	return result;
}

// ─── Media Extraction ──────────────────────────────────────────────────────

function extractMedia(pkg: DocxPackage, _docRels: RelationshipMap, mediaBag: MediaBag): void {
	for (const [path, data] of pkg.entries) {
		if (path.startsWith('word/media/')) {
			const fileName = path.split('/').pop() || path;
			const contentType = mimeFromExtension(fileName);
			mediaBag.set(path, { data, contentType, fileName });
		}
	}
}

// ─── Metadata ──────────────────────────────────────────────────────────────

function parseMetadata(pkg: DocxPackage): JPDocumentMetadata {
	const coreXml = pkg.xml.get('docProps/core.xml');
	if (!coreXml) return {};

	const root = coreXml.documentElement;
	if (!root) return {};

	const metadata: Record<string, string> = {};

	const title = getFirstChild(root, NS.dc, 'title');
	if (title) {
		const val = textContent(title);
		if (val) metadata.title = val;
	}

	const creator = getFirstChild(root, NS.dc, 'creator');
	if (creator) {
		const val = textContent(creator);
		if (val) metadata.author = val;
	}

	const description = getFirstChild(root, NS.dc, 'description');
	if (description) {
		const val = textContent(description);
		if (val) metadata.description = val;
	}

	const created = getFirstChild(root, NS.dcterms, 'created');
	if (created) {
		const val = textContent(created);
		if (val) metadata.created = val;
	}

	const modified = getFirstChild(root, NS.dcterms, 'modified');
	if (modified) {
		const val = textContent(modified);
		if (val) metadata.modified = val;
	}

	const language = getFirstChild(root, NS.dc, 'language');
	if (language) {
		const val = textContent(language);
		if (val) metadata.language = val;
	}

	return metadata as JPDocumentMetadata;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function intOrDefault(val: string | null, fallback: number): number {
	if (val === null) return fallback;
	const n = Number.parseInt(val, 10);
	return Number.isNaN(n) ? fallback : n;
}

/** Check if a w:r element only contains w:commentReference (no real text). */
function isCommentReferenceRun(el: Element): boolean {
	const nodes = el.childNodes;
	for (let i = 0; i < nodes.length; i++) {
		const child = nodes[i];
		if (child.nodeType !== 1) continue;
		const ce = child as Element;
		if (ce.namespaceURI === NS.w && ce.localName === 'commentReference') {
			return true;
		}
	}
	return false;
}

function parseFieldInstruction(instr: string): JPFieldType {
	const trimmed = instr.trim().toUpperCase();
	if (trimmed.startsWith('PAGE')) return 'PAGE';
	if (trimmed.startsWith('NUMPAGES')) return 'NUMPAGES';
	if (trimmed.startsWith('DATE')) return 'DATE';
	if (trimmed.startsWith('TIME')) return 'TIME';
	if (trimmed.startsWith('AUTHOR')) return 'AUTHOR';
	if (trimmed.startsWith('TITLE')) return 'TITLE';
	if (trimmed.startsWith('FILENAME')) return 'FILENAME';
	return 'PAGE';
}
