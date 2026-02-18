import type { JPStyle, JPStyleType } from '@jpoffice/model';
import { createStyleRegistry } from '@jpoffice/model';
import type { JPStyleRegistry } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { attrNS, getDirectChildren, getFirstChild } from '../xml/xml-parser';
import { parseParagraphProperties, parseRunProperties } from './run-parser';

/** Parse word/styles.xml into a JPStyleRegistry. */
export function parseStyles(doc: Document): JPStyleRegistry {
	const root = doc.documentElement;
	if (!root) return createStyleRegistry([]);

	const styleEls = getDirectChildren(root, NS.w, 'style');
	const styles: JPStyle[] = [];

	for (const el of styleEls) {
		const style = parseStyle(el);
		if (style) styles.push(style);
	}

	return createStyleRegistry(styles);
}

function parseStyle(el: Element): JPStyle | null {
	const typeAttr = attrNS(el, NS.w, 'type');
	const styleId = attrNS(el, NS.w, 'styleId');
	if (!styleId) return null;

	const type = mapStyleType(typeAttr);
	if (!type) return null;

	const nameEl = getFirstChild(el, NS.w, 'name');
	const name = nameEl ? attrNS(nameEl, NS.w, 'val') || styleId : styleId;

	const basedOnEl = getFirstChild(el, NS.w, 'basedOn');
	const basedOn = basedOnEl ? (attrNS(basedOnEl, NS.w, 'val') ?? undefined) : undefined;

	const nextEl = getFirstChild(el, NS.w, 'next');
	const next = nextEl ? (attrNS(nextEl, NS.w, 'val') ?? undefined) : undefined;

	const defaultAttr = attrNS(el, NS.w, 'default');
	const isDefault = defaultAttr === '1' || defaultAttr === 'true' || undefined;

	const pPr = getFirstChild(el, NS.w, 'pPr');
	const paragraphProperties = pPr ? parseParagraphProperties(pPr) : undefined;

	const rPr = getFirstChild(el, NS.w, 'rPr');
	const runProperties = rPr ? parseRunProperties(rPr) : undefined;

	const style: Record<string, unknown> = {
		id: styleId,
		name,
		type,
	};

	if (basedOn) style.basedOn = basedOn;
	if (next) style.next = next;
	if (isDefault) style.isDefault = isDefault;
	if (paragraphProperties) style.paragraphProperties = paragraphProperties;
	if (runProperties) style.runProperties = runProperties;

	return style as unknown as JPStyle;
}

function mapStyleType(val: string | null): JPStyleType | null {
	switch (val) {
		case 'paragraph':
			return 'paragraph';
		case 'character':
			return 'character';
		case 'table':
			return 'table';
		case 'numbering':
			return 'numbering';
		default:
			return null;
	}
}
