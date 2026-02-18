import type {
	JPAbstractNumbering,
	JPNumberFormat,
	JPNumberingInstance,
	JPNumberingLevel,
	JPNumberingRegistry,
} from '@jpoffice/model';
import { EMPTY_NUMBERING_REGISTRY } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild } from '../xml/xml-parser';

/** Parse word/numbering.xml into a JPNumberingRegistry. */
export function parseNumbering(doc: Document): JPNumberingRegistry {
	const root = doc.documentElement;
	if (!root) return EMPTY_NUMBERING_REGISTRY;

	const abstractNums = getDirectChildren(root, NS.w, 'abstractNum');
	const nums = getDirectChildren(root, NS.w, 'num');

	const abstractNumberings: JPAbstractNumbering[] = abstractNums.map(parseAbstractNum);
	const instances: JPNumberingInstance[] = nums.map(parseNum);

	return { abstractNumberings, instances };
}

function parseAbstractNum(el: Element): JPAbstractNumbering {
	const abstractNumId = Number.parseInt(attrNS(el, NS.w, 'abstractNumId') || '0', 10);
	const lvlEls = getDirectChildren(el, NS.w, 'lvl');
	const levels: JPNumberingLevel[] = lvlEls.map(parseLvl);

	return { abstractNumId, levels };
}

function parseLvl(el: Element): JPNumberingLevel {
	const level = Number.parseInt(attrNS(el, NS.w, 'ilvl') || '0', 10);

	const numFmtEl = getFirstChild(el, NS.w, 'numFmt');
	const format = mapNumberFormat(numFmtEl ? attrNS(numFmtEl, NS.w, 'val') : null);

	const lvlTextEl = getFirstChild(el, NS.w, 'lvlText');
	const text = lvlTextEl ? attrNS(lvlTextEl, NS.w, 'val') || '' : '';

	const lvlJcEl = getFirstChild(el, NS.w, 'lvlJc');
	const jc = lvlJcEl ? attrNS(lvlJcEl, NS.w, 'val') : null;
	const alignment = jc === 'center' || jc === 'right' ? jc : ('left' as const);

	// Indentation from w:pPr/w:ind
	const pPr = getFirstChild(el, NS.w, 'pPr');
	const ind = pPr ? getFirstChild(pPr, NS.w, 'ind') : null;
	const indent = ind ? intOrZero(attrNS(ind, NS.w, 'left') ?? attrNS(ind, NS.w, 'start')) : 0;
	const hangingIndent = ind ? intOrZero(attrNS(ind, NS.w, 'hanging')) : 0;

	// Font from w:rPr/w:rFonts
	const rPr = getFirstChild(el, NS.w, 'rPr');
	const rFonts = rPr ? getFirstChild(rPr, NS.w, 'rFonts') : null;
	const font = rFonts
		? attrNS(rFonts, NS.w, 'ascii') || attrNS(rFonts, NS.w, 'hAnsi') || undefined
		: undefined;

	const startEl = getFirstChild(el, NS.w, 'start');
	const start = startEl ? intOrUndef(attrNS(startEl, NS.w, 'val')) : undefined;

	return { level, format, text, alignment, indent, hangingIndent, font, start };
}

function parseNum(el: Element): JPNumberingInstance {
	const numId = Number.parseInt(attrNS(el, NS.w, 'numId') || '0', 10);

	const abstractNumIdEl = getFirstChild(el, NS.w, 'abstractNumId');
	const abstractNumId = abstractNumIdEl
		? Number.parseInt(attrNS(abstractNumIdEl, NS.w, 'val') || '0', 10)
		: 0;

	const overrideEls = getDirectChildren(el, NS.w, 'lvlOverride');
	const overrides =
		overrideEls.length > 0
			? overrideEls.map((ov) => {
					const lvl = Number.parseInt(attrNS(ov, NS.w, 'ilvl') || '0', 10);
					const startOverrideEl = getFirstChild(ov, NS.w, 'startOverride');
					const startOverride = startOverrideEl
						? intOrUndef(attrNS(startOverrideEl, NS.w, 'val'))
						: undefined;
					return { level: lvl, startOverride };
				})
			: undefined;

	return { numId, abstractNumId, overrides };
}

function mapNumberFormat(val: string | null): JPNumberFormat {
	switch (val) {
		case 'decimal':
			return 'decimal';
		case 'lowerLetter':
			return 'lowerLetter';
		case 'upperLetter':
			return 'upperLetter';
		case 'lowerRoman':
			return 'lowerRoman';
		case 'upperRoman':
			return 'upperRoman';
		case 'bullet':
			return 'bullet';
		case 'none':
			return 'none';
		default:
			return 'decimal';
	}
}

function intOrZero(val: string | null | undefined): number {
	if (!val) return 0;
	const n = Number.parseInt(val, 10);
	return Number.isNaN(n) ? 0 : n;
}

function intOrUndef(val: string | null | undefined): number | undefined {
	if (!val) return undefined;
	const n = Number.parseInt(val, 10);
	return Number.isNaN(n) ? undefined : n;
}
