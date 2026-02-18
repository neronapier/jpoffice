import type {
	JPDrawingProperties,
	JPFloatAlign,
	JPFloatPosition,
	JPFloatRelativeTo,
	JPImageProperties,
	JPWrapSide,
	JPWrapping,
} from '@jpoffice/model';
import { createDrawing, createImage, generateId } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getFirstChild, textContent } from '../xml/xml-parser';
import type { RelationshipMap } from './relationships-parser';
import type { MediaBag } from './table-parser';

/** Parse a w:drawing element into JPDrawing nodes. */
export function parseDrawing(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ReturnType<typeof createDrawing> | null {
	// Try inline first
	const inline = getFirstChild(el, NS.wp, 'inline');
	if (inline) return parseInlineDrawing(inline, rels, mediaBag);

	// Try anchor (floating)
	const anchor = getFirstChild(el, NS.wp, 'anchor');
	if (anchor) return parseAnchorDrawing(anchor, rels, mediaBag);

	return null;
}

function parseInlineDrawing(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ReturnType<typeof createDrawing> | null {
	const extent = getFirstChild(el, NS.wp, 'extent');
	const cx = extent ? intOrZero(extent.getAttribute('cx')) : 0;
	const cy = extent ? intOrZero(extent.getAttribute('cy')) : 0;

	const imageInfo = extractImageInfo(el, rels, mediaBag);
	if (!imageInfo) return null;

	const distT = intOrZero(el.getAttribute('distT'));
	const distB = intOrZero(el.getAttribute('distB'));
	const distL = intOrZero(el.getAttribute('distL'));
	const distR = intOrZero(el.getAttribute('distR'));

	const docPr = getFirstChild(el, NS.wp, 'docPr');
	const altText = docPr?.getAttribute('descr') ?? undefined;
	const title = docPr?.getAttribute('name') ?? undefined;

	const imageProps: JPImageProperties = {
		src: imageInfo.src,
		mimeType: imageInfo.mimeType,
		width: cx,
		height: cy,
		altText,
		title,
	};

	const drawingProps: JPDrawingProperties = {
		positioning: 'inline',
		inline: {
			distTop: distT,
			distBottom: distB,
			distLeft: distL,
			distRight: distR,
		},
	};

	const image = createImage(generateId(), imageProps);
	return createDrawing(generateId(), image, drawingProps);
}

function parseAnchorDrawing(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ReturnType<typeof createDrawing> | null {
	const extent = getFirstChild(el, NS.wp, 'extent');
	const cx = extent ? intOrZero(extent.getAttribute('cx')) : 0;
	const cy = extent ? intOrZero(extent.getAttribute('cy')) : 0;

	const imageInfo = extractImageInfo(el, rels, mediaBag);
	if (!imageInfo) return null;

	const docPr = getFirstChild(el, NS.wp, 'docPr');
	const altText = docPr?.getAttribute('descr') ?? undefined;
	const title = docPr?.getAttribute('name') ?? undefined;

	const behindDoc = el.getAttribute('behindDoc');
	const allowOverlap = el.getAttribute('allowOverlap');

	const horizontalPosition = parseFloatPosition(el, 'positionH');
	const verticalPosition = parseFloatPosition(el, 'positionV');
	const wrapping = parseWrapping(el);

	const imageProps: JPImageProperties = {
		src: imageInfo.src,
		mimeType: imageInfo.mimeType,
		width: cx,
		height: cy,
		altText,
		title,
	};

	const drawingProps: JPDrawingProperties = {
		positioning: 'floating',
		floating: {
			horizontalPosition,
			verticalPosition,
			wrapping,
			behindText: behindDoc === '1' || behindDoc === 'true' || undefined,
			allowOverlap: allowOverlap === '1' || allowOverlap === 'true' || undefined,
		},
	};

	const image = createImage(generateId(), imageProps);
	return createDrawing(generateId(), image, drawingProps);
}

// ─── Image Extraction ──────────────────────────────────────────────────────

interface ImageInfo {
	src: string;
	mimeType: string;
}

function extractImageInfo(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): ImageInfo | null {
	// Navigate: a:graphic/a:graphicData/pic:pic/pic:blipFill/a:blip
	const graphic = getFirstChild(el, NS.a, 'graphic');
	if (!graphic) return null;

	const graphicData = getFirstChild(graphic, NS.a, 'graphicData');
	if (!graphicData) return null;

	const pic = getFirstChild(graphicData, NS.pic, 'pic');
	if (!pic) return null;

	const blipFill = getFirstChild(pic, NS.pic, 'blipFill');
	if (!blipFill) return null;

	const blip = getFirstChild(blipFill, NS.a, 'blip');
	if (!blip) return null;

	const embed = attrNS(blip, NS.r, 'embed');
	if (!embed) return null;

	const rel = rels.get(embed);
	if (!rel) return null;

	// Resolve target to ZIP path
	const target = rel.target.startsWith('/') ? rel.target.slice(1) : `word/${rel.target}`;

	// Check media bag first (already extracted)
	const media = mediaBag.get(target);
	if (media) {
		const src = uint8ArrayToDataUrl(media.data, media.contentType);
		return { src, mimeType: media.contentType };
	}

	return null;
}

// ─── Float Position ────────────────────────────────────────────────────────

function parseFloatPosition(parent: Element, localName: string): JPFloatPosition {
	const el = getFirstChild(parent, NS.wp, localName);
	if (!el) {
		return { relativeTo: 'column' };
	}

	const relativeFrom = el.getAttribute('relativeFrom') as JPFloatRelativeTo | null;
	const relativeTo: JPFloatRelativeTo = relativeFrom || 'column';

	const alignEl = getFirstChild(el, NS.wp, 'align');
	if (alignEl) {
		return {
			relativeTo,
			align: textContent(alignEl) as JPFloatAlign,
		};
	}

	const posOffset = getFirstChild(el, NS.wp, 'posOffset');
	if (posOffset) {
		return {
			relativeTo,
			offset: Number.parseInt(textContent(posOffset), 10) || 0,
		};
	}

	return { relativeTo };
}

// ─── Wrapping ──────────────────────────────────────────────────────────────

function parseWrapping(el: Element): JPWrapping {
	if (getFirstChild(el, NS.wp, 'wrapNone')) {
		return { type: 'none' };
	}

	const wrapSquare = getFirstChild(el, NS.wp, 'wrapSquare');
	if (wrapSquare) {
		const side = (wrapSquare.getAttribute('wrapText') as JPWrapSide) || 'both';
		return { type: 'square', side };
	}

	const wrapTight = getFirstChild(el, NS.wp, 'wrapTight');
	if (wrapTight) {
		const side = (wrapTight.getAttribute('wrapText') as JPWrapSide) || 'both';
		return { type: 'tight', side };
	}

	if (getFirstChild(el, NS.wp, 'wrapTopAndBottom')) {
		return { type: 'topAndBottom' };
	}

	return { type: 'none' };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function intOrZero(val: string | null | undefined): number {
	if (!val) return 0;
	const n = Number.parseInt(val, 10);
	return Number.isNaN(n) ? 0 : n;
}

/** Convert Uint8Array to a data URL. Works in both browser and Node.js. */
export function uint8ArrayToDataUrl(data: Uint8Array, mimeType: string): string {
	let binary = '';
	for (let i = 0; i < data.length; i++) {
		binary += String.fromCharCode(data[i]);
	}

	// Use btoa if available (browser), otherwise Buffer (Node.js)
	let base64: string;
	if (typeof btoa === 'function') {
		base64 = btoa(binary);
	} else if (typeof Buffer !== 'undefined') {
		base64 = Buffer.from(data).toString('base64');
	} else {
		throw new Error('No base64 encoding available');
	}

	return `data:${mimeType};base64,${base64}`;
}

/** Infer MIME type from file extension. */
export function mimeFromExtension(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'bmp':
			return 'image/bmp';
		case 'tiff':
		case 'tif':
			return 'image/tiff';
		case 'svg':
			return 'image/svg+xml';
		default:
			return 'application/octet-stream';
	}
}
