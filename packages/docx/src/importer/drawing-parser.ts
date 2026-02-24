import type {
	JPDrawingProperties,
	JPFloatAlign,
	JPFloatPosition,
	JPFloatRelativeTo,
	JPImageProperties,
	JPInlineNode,
	JPShape,
	JPShapeFill,
	JPShapeStroke,
	JPShapeType,
	JPWrapSide,
	JPWrapping,
} from '@jpoffice/model';
import { createDrawing, createImage, createShape, generateId } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getFirstChild, textContent } from '../xml/xml-parser';
import type { RelationshipMap } from './relationships-parser';
import type { MediaBag } from './table-parser';

/** Parse a w:drawing element into JPDrawing or JPShape nodes. */
export function parseDrawing(
	el: Element,
	rels: RelationshipMap,
	mediaBag: MediaBag,
): JPInlineNode | null {
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
): JPInlineNode | null {
	// Check for shape (wps:wsp) before image
	const shapeNode = extractShapeInfo(el);
	if (shapeNode) return shapeNode;

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

// ─── Shape Extraction ──────────────────────────────────────────────────────

function extractShapeInfo(el: Element): JPShape | null {
	const graphic = getFirstChild(el, NS.a, 'graphic');
	if (!graphic) return null;
	const graphicData = getFirstChild(graphic, NS.a, 'graphicData');
	if (!graphicData) return null;

	const wsp = getFirstChild(graphicData, NS.wps, 'wsp');
	if (!wsp) return null;

	const spPr = getFirstChild(wsp, NS.wps, 'spPr') || getFirstChild(wsp, NS.a, 'spPr');
	if (!spPr) return null;

	const xfrm = getFirstChild(spPr, NS.a, 'xfrm');
	const off = xfrm ? getFirstChild(xfrm, NS.a, 'off') : null;
	const ext = xfrm ? getFirstChild(xfrm, NS.a, 'ext') : null;

	const x = off ? intOrZero(off.getAttribute('x')) : 0;
	const y = off ? intOrZero(off.getAttribute('y')) : 0;
	const width = ext ? intOrZero(ext.getAttribute('cx')) : 0;
	const height = ext ? intOrZero(ext.getAttribute('cy')) : 0;

	const prstGeom = getFirstChild(spPr, NS.a, 'prstGeom');
	const prst = prstGeom ? prstGeom.getAttribute('prst') : 'rect';
	const shapeType = mapOoxmlShapeType(prst || 'rect');

	const fill = parseShapeFill(spPr);
	const stroke = parseShapeStroke(spPr);

	const rot = xfrm ? xfrm.getAttribute('rot') : null;
	const rotation = rot ? Number.parseInt(rot, 10) / 60000 : undefined;

	const txbxContent = getFirstChild(wsp, NS.wps, 'txbxContent');
	let text: string | undefined;
	if (txbxContent) {
		const texts: string[] = [];
		const paragraphs = txbxContent.childNodes;
		for (let i = 0; i < paragraphs.length; i++) {
			const p = paragraphs[i];
			if (p.nodeType !== 1) continue;
			const runs = (p as Element).childNodes;
			for (let j = 0; j < runs.length; j++) {
				const r = runs[j];
				if (r.nodeType !== 1) continue;
				const re = r as Element;
				if (re.localName === 'r') {
					const t = getFirstChild(re, NS.w, 't');
					if (t) texts.push(textContent(t));
				}
			}
		}
		if (texts.length > 0) text = texts.join('');
	}

	return createShape(shapeType, x, y, width, height, { rotation, fill, stroke, text });
}

function mapOoxmlShapeType(prst: string): JPShapeType {
	const mapping: Record<string, JPShapeType> = {
		rect: 'rectangle',
		roundRect: 'rounded-rectangle',
		ellipse: 'ellipse',
		triangle: 'triangle',
		diamond: 'diamond',
		pentagon: 'pentagon',
		hexagon: 'hexagon',
		star5: 'star',
		rightArrow: 'arrow-right',
		leftArrow: 'arrow-left',
		upArrow: 'arrow-up',
		downArrow: 'arrow-down',
		line: 'line',
		curvedConnector3: 'curved-line',
		straightConnector1: 'connector',
		wedgeRoundRectCallout: 'callout',
		cloudCallout: 'cloud',
		heart: 'heart',
	};
	return mapping[prst] || 'rectangle';
}

function parseShapeFill(spPr: Element): JPShapeFill | undefined {
	const solidFill = getFirstChild(spPr, NS.a, 'solidFill');
	if (solidFill) {
		const srgbClr = getFirstChild(solidFill, NS.a, 'srgbClr');
		if (srgbClr) {
			return { type: 'solid', color: srgbClr.getAttribute('val') || '000000' };
		}
		return { type: 'solid', color: '000000' };
	}

	const noFill = getFirstChild(spPr, NS.a, 'noFill');
	if (noFill) return { type: 'none' };

	return undefined;
}

function parseShapeStroke(spPr: Element): JPShapeStroke | undefined {
	const ln = getFirstChild(spPr, NS.a, 'ln');
	if (!ln) return undefined;

	const w = ln.getAttribute('w');
	const width = w ? Number.parseInt(w, 10) : 12700;

	const solidFill = getFirstChild(ln, NS.a, 'solidFill');
	let color = '000000';
	if (solidFill) {
		const srgbClr = getFirstChild(solidFill, NS.a, 'srgbClr');
		if (srgbClr) color = srgbClr.getAttribute('val') || '000000';
	}

	return { color, width };
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
