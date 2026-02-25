import type { JPDrawing, JPShape, JPShapeType } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import type { XmlBuilder } from '../xml/xml-builder';

/** Serialize a JPDrawing to w:drawing XML. Returns the rId used for the image. */
export function writeDrawing(b: XmlBuilder, drawing: JPDrawing, imageRId: string): void {
	// Guard against malformed drawings with missing children
	if (!(drawing.children as readonly unknown[])?.length) return;
	const image = drawing.children[0];
	if (!image?.properties) return;
	const imgProps = image.properties;
	const drawProps = drawing.properties;

	b.open('w:drawing');

	if (drawProps.positioning === 'inline') {
		const dist = drawProps.inline || { distTop: 0, distBottom: 0, distLeft: 0, distRight: 0 };
		b.open('wp:inline', {
			'xmlns:wp': NS.wp,
			distT: dist.distTop,
			distB: dist.distBottom,
			distL: dist.distLeft,
			distR: dist.distRight,
		});

		b.empty('wp:extent', { cx: imgProps.width, cy: imgProps.height });
		b.open('wp:docPr', {
			id: '1',
			name: imgProps.title || 'Image',
			...(imgProps.altText ? { descr: imgProps.altText } : {}),
		});
		b.close(); // wp:docPr

		writeGraphic(b, imageRId, imgProps.width, imgProps.height);

		b.close(); // wp:inline
	} else if (drawProps.positioning === 'floating' && drawProps.floating) {
		const f = drawProps.floating;
		b.open('wp:anchor', {
			'xmlns:wp': NS.wp,
			behindDoc: f.behindText ? '1' : '0',
			allowOverlap: f.allowOverlap ? '1' : '0',
			simplePos: '0',
			relativeHeight: '0',
			locked: '0',
			layoutInCell: '1',
			distT: '0',
			distB: '0',
			distL: '0',
			distR: '0',
		});

		b.empty('wp:simplePos', { x: '0', y: '0' });

		// Horizontal position
		writeFloatPosition(b, 'wp:positionH', f.horizontalPosition);
		writeFloatPosition(b, 'wp:positionV', f.verticalPosition);

		b.empty('wp:extent', { cx: imgProps.width, cy: imgProps.height });

		// Wrapping
		writeWrapping(b, f.wrapping);

		b.open('wp:docPr', {
			id: '1',
			name: imgProps.title || 'Image',
			...(imgProps.altText ? { descr: imgProps.altText } : {}),
		});
		b.close();

		writeGraphic(b, imageRId, imgProps.width, imgProps.height);

		b.close(); // wp:anchor
	}

	b.close(); // w:drawing
}

function writeGraphic(b: XmlBuilder, rId: string, width: number, height: number): void {
	b.open('a:graphic', { 'xmlns:a': NS.a });
	b.open('a:graphicData', {
		uri: NS.pic,
	});
	b.open('pic:pic', { 'xmlns:pic': NS.pic });

	b.open('pic:nvPicPr');
	b.empty('pic:cNvPr', { id: '0', name: 'Image' });
	b.empty('pic:cNvPicPr');
	b.close(); // pic:nvPicPr

	b.open('pic:blipFill');
	b.empty('a:blip', { 'xmlns:r': NS.r, 'r:embed': rId });
	b.open('a:stretch');
	b.empty('a:fillRect');
	b.close(); // a:stretch
	b.close(); // pic:blipFill

	b.open('pic:spPr');
	b.open('a:xfrm');
	b.empty('a:off', { x: '0', y: '0' });
	b.empty('a:ext', { cx: width, cy: height });
	b.close(); // a:xfrm
	b.open('a:prstGeom', { prst: 'rect' });
	b.empty('a:avLst');
	b.close(); // a:prstGeom
	b.close(); // pic:spPr

	b.close(); // pic:pic
	b.close(); // a:graphicData
	b.close(); // a:graphic
}

function writeFloatPosition(
	b: XmlBuilder,
	tag: string,
	pos: { relativeTo: string; align?: string; offset?: number },
): void {
	b.open(tag, { relativeFrom: pos.relativeTo });
	if (pos.align) {
		b.open('wp:align');
		b.text(pos.align);
		b.close();
	} else if (pos.offset !== undefined) {
		b.open('wp:posOffset');
		b.text(String(pos.offset));
		b.close();
	} else {
		b.open('wp:posOffset');
		b.text('0');
		b.close();
	}
	b.close(); // tag
}

function writeWrapping(b: XmlBuilder, wrapping: { type: string; side?: string }): void {
	switch (wrapping.type) {
		case 'none':
			b.empty('wp:wrapNone');
			break;
		case 'square':
			b.empty('wp:wrapSquare', { wrapText: wrapping.side || 'both' });
			break;
		case 'tight':
			b.empty('wp:wrapTight', { wrapText: wrapping.side || 'both' });
			break;
		case 'topAndBottom':
			b.empty('wp:wrapTopAndBottom');
			break;
		default:
			b.empty('wp:wrapNone');
	}
}

/** Serialize a JPShape to w:drawing XML with wps:wsp content. */
export function writeShape(b: XmlBuilder, shape: JPShape): void {
	b.open('w:drawing');
	b.open('wp:anchor', {
		'xmlns:wp': NS.wp,
		behindDoc: '0',
		allowOverlap: '1',
		simplePos: '0',
		relativeHeight: String(shape.zIndex || 0),
		locked: '0',
		layoutInCell: '1',
		distT: '0',
		distB: '0',
		distL: '0',
		distR: '0',
	});

	b.empty('wp:simplePos', { x: '0', y: '0' });
	b.open('wp:positionH', { relativeFrom: 'column' });
	b.open('wp:posOffset');
	b.text(String(shape.x));
	b.close();
	b.close();
	b.open('wp:positionV', { relativeFrom: 'paragraph' });
	b.open('wp:posOffset');
	b.text(String(shape.y));
	b.close();
	b.close();

	b.empty('wp:extent', { cx: shape.width, cy: shape.height });
	b.empty('wp:wrapNone');

	b.open('wp:docPr', { id: '1', name: shape.shapeType });
	b.close();

	b.open('a:graphic', { 'xmlns:a': NS.a });
	b.open('a:graphicData', { uri: NS.wps });
	b.open('wps:wsp', { 'xmlns:wps': NS.wps });

	b.open('wps:spPr');

	b.open('a:xfrm', shape.rotation ? { rot: Math.round(shape.rotation * 60000) } : {});
	b.empty('a:off', { x: '0', y: '0' });
	b.empty('a:ext', { cx: shape.width, cy: shape.height });
	b.close(); // a:xfrm

	const prst = mapShapeTypeToOoxml(shape.shapeType);
	b.open('a:prstGeom', { prst });
	b.empty('a:avLst');
	b.close();

	if (shape.fill) {
		if (shape.fill.type === 'solid' && shape.fill.color) {
			b.open('a:solidFill');
			b.empty('a:srgbClr', { val: shape.fill.color });
			b.close();
		} else if (shape.fill.type === 'none') {
			b.empty('a:noFill');
		}
	}

	if (shape.stroke) {
		b.open('a:ln', { w: shape.stroke.width });
		b.open('a:solidFill');
		b.empty('a:srgbClr', { val: shape.stroke.color });
		b.close();
		b.close();
	}

	b.close(); // wps:spPr

	b.open('wps:bodyPr');
	b.close();

	if (shape.text) {
		b.open('wps:txbxContent');
		b.open('w:p', { 'xmlns:w': NS.w });
		b.open('w:r');
		b.open('w:t', { 'xml:space': 'preserve' });
		b.text(shape.text);
		b.close();
		b.close();
		b.close(); // w:p
		b.close(); // wps:txbxContent
	}

	b.close(); // wps:wsp
	b.close(); // a:graphicData
	b.close(); // a:graphic

	b.close(); // wp:anchor
	b.close(); // w:drawing
}

function mapShapeTypeToOoxml(type: JPShapeType): string {
	const mapping: Record<JPShapeType, string> = {
		rectangle: 'rect',
		'rounded-rectangle': 'roundRect',
		ellipse: 'ellipse',
		triangle: 'triangle',
		diamond: 'diamond',
		pentagon: 'pentagon',
		hexagon: 'hexagon',
		star: 'star5',
		'arrow-right': 'rightArrow',
		'arrow-left': 'leftArrow',
		'arrow-up': 'upArrow',
		'arrow-down': 'downArrow',
		line: 'line',
		'curved-line': 'curvedConnector3',
		connector: 'straightConnector1',
		callout: 'wedgeRoundRectCallout',
		cloud: 'cloudCallout',
		heart: 'heart',
	};
	return mapping[type] || 'rect';
}

/**
 * Extract image binary data from a data URL.
 * Returns the raw bytes and MIME type.
 */
export function dataUrlToUint8Array(
	dataUrl: string,
): { data: Uint8Array; mimeType: string } | null {
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) return null;

	const mimeType = match[1];
	const base64 = match[2];

	let bytes: Uint8Array;
	if (typeof atob === 'function') {
		const binary = atob(base64);
		bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
	} else if (typeof Buffer !== 'undefined') {
		bytes = new Uint8Array(Buffer.from(base64, 'base64'));
	} else {
		return null;
	}

	return { data: bytes, mimeType };
}

/** Get file extension from MIME type. */
export function extensionFromMime(mimeType: string): string {
	switch (mimeType) {
		case 'image/png':
			return 'png';
		case 'image/jpeg':
			return 'jpg';
		case 'image/gif':
			return 'gif';
		case 'image/bmp':
			return 'bmp';
		case 'image/tiff':
			return 'tiff';
		default:
			return 'bin';
	}
}
