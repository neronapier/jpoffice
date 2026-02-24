import type { JPInlineNode, JPParagraphProperties, JPRunProperties } from '@jpoffice/model';
import type { XmlBuilder } from '../xml/xml-builder';

/**
 * Serialize JPRunProperties to w:rPr XML elements.
 * Used by document-writer, styles-writer, and others.
 */
export function writeRunProperties(b: XmlBuilder, props: JPRunProperties): void {
	if (!props || Object.keys(props).length === 0) return;

	b.open('w:rPr');

	if (props.styleId) b.empty('w:rStyle', { 'w:val': props.styleId });
	if (props.bold) b.empty('w:b');
	if (props.italic) b.empty('w:i');
	if (props.underline && props.underline !== 'none') {
		b.empty('w:u', { 'w:val': props.underline });
	}
	if (props.strikethrough) b.empty('w:strike');
	if (props.doubleStrikethrough) b.empty('w:dstrike');
	if (props.superscript) b.empty('w:vertAlign', { 'w:val': 'superscript' });
	if (props.subscript) b.empty('w:vertAlign', { 'w:val': 'subscript' });
	if (props.fontFamily) {
		b.empty('w:rFonts', {
			'w:ascii': props.fontFamily,
			'w:hAnsi': props.fontFamily,
			'w:cs': props.fontFamily,
		});
	}
	if (props.fontSize !== undefined) {
		b.empty('w:sz', { 'w:val': props.fontSize });
		b.empty('w:szCs', { 'w:val': props.fontSize });
	}
	if (props.color) b.empty('w:color', { 'w:val': props.color });
	if (props.highlight) b.empty('w:highlight', { 'w:val': props.highlight });
	if (props.backgroundColor) {
		b.empty('w:shd', { 'w:val': 'clear', 'w:fill': props.backgroundColor });
	}
	if (props.allCaps) b.empty('w:caps');
	if (props.smallCaps) b.empty('w:smallCaps');
	if (props.letterSpacing !== undefined) {
		b.empty('w:spacing', { 'w:val': props.letterSpacing });
	}
	if (props.language) b.empty('w:lang', { 'w:val': props.language });

	// Write w:rPrChange for format change revisions
	if (props.revision?.type === 'formatChange') {
		b.open('w:rPrChange', {
			'w:id': props.revision.revisionId,
			'w:author': props.revision.author,
			'w:date': props.revision.date,
		});
		if (props.previousProperties && Object.keys(props.previousProperties).length > 0) {
			writeRunPropertiesInner(b, props.previousProperties);
		} else {
			b.open('w:rPr');
			b.close();
		}
		b.close(); // w:rPrChange
	}

	b.close(); // w:rPr
}

/**
 * Write inner w:rPr elements without the outer tag.
 * Used by w:rPrChange to serialize the previous formatting state.
 */
function writeRunPropertiesInner(b: XmlBuilder, props: Partial<JPRunProperties>): void {
	b.open('w:rPr');
	if (props.styleId) b.empty('w:rStyle', { 'w:val': props.styleId });
	if (props.bold) b.empty('w:b');
	if (props.italic) b.empty('w:i');
	if (props.underline && props.underline !== 'none') {
		b.empty('w:u', { 'w:val': props.underline });
	}
	if (props.strikethrough) b.empty('w:strike');
	if (props.doubleStrikethrough) b.empty('w:dstrike');
	if (props.superscript) b.empty('w:vertAlign', { 'w:val': 'superscript' });
	if (props.subscript) b.empty('w:vertAlign', { 'w:val': 'subscript' });
	if (props.fontFamily) {
		b.empty('w:rFonts', {
			'w:ascii': props.fontFamily,
			'w:hAnsi': props.fontFamily,
			'w:cs': props.fontFamily,
		});
	}
	if (props.fontSize !== undefined) {
		b.empty('w:sz', { 'w:val': props.fontSize });
		b.empty('w:szCs', { 'w:val': props.fontSize });
	}
	if (props.color) b.empty('w:color', { 'w:val': props.color });
	if (props.highlight) b.empty('w:highlight', { 'w:val': props.highlight });
	if (props.backgroundColor) {
		b.empty('w:shd', { 'w:val': 'clear', 'w:fill': props.backgroundColor });
	}
	if (props.allCaps) b.empty('w:caps');
	if (props.smallCaps) b.empty('w:smallCaps');
	if (props.letterSpacing !== undefined) {
		b.empty('w:spacing', { 'w:val': props.letterSpacing });
	}
	if (props.language) b.empty('w:lang', { 'w:val': props.language });
	b.close(); // w:rPr
}

/**
 * Serialize JPParagraphProperties to w:pPr XML elements.
 * Used by document-writer, styles-writer, and others.
 */
export function writeParagraphProperties(
	b: XmlBuilder,
	props: JPParagraphProperties,
	extraContent?: (b: XmlBuilder) => void,
): void {
	if (!props || (Object.keys(props).length === 0 && !extraContent)) {
		if (extraContent) {
			b.open('w:pPr');
			extraContent(b);
			b.close();
		}
		return;
	}

	b.open('w:pPr');

	if (props.styleId) b.empty('w:pStyle', { 'w:val': props.styleId });

	if (props.keepNext) b.empty('w:keepNext');
	if (props.keepLines) b.empty('w:keepLines');
	if (props.pageBreakBefore) b.empty('w:pageBreakBefore');
	if (props.widowControl !== undefined) {
		b.empty('w:widowControl', { 'w:val': props.widowControl ? '1' : '0' });
	}

	if (props.numbering) {
		b.open('w:numPr');
		b.empty('w:ilvl', { 'w:val': props.numbering.level });
		b.empty('w:numId', { 'w:val': props.numbering.numId });
		b.close();
	}

	if (props.borders) {
		b.open('w:pBdr');
		for (const side of ['top', 'bottom', 'left', 'right', 'between'] as const) {
			const border = props.borders[side];
			if (border) {
				b.empty(`w:${side}`, {
					'w:val': border.style,
					'w:sz': border.width,
					'w:color': border.color,
					...(border.spacing !== undefined ? { 'w:space': border.spacing } : {}),
				});
			}
		}
		b.close();
	}

	if (props.shading) {
		b.empty('w:shd', {
			'w:val': props.shading.pattern || 'clear',
			'w:fill': props.shading.fill,
			...(props.shading.color ? { 'w:color': props.shading.color } : {}),
		});
	}

	if (props.tabs && props.tabs.length > 0) {
		b.open('w:tabs');
		for (const tab of props.tabs) {
			b.empty('w:tab', {
				'w:val': tab.type,
				'w:pos': tab.position,
				...(tab.leader ? { 'w:leader': tab.leader } : {}),
			});
		}
		b.close();
	}

	if (props.spacing) {
		const attrs: Record<string, string | number> = {};
		if (props.spacing.before !== undefined) attrs['w:before'] = props.spacing.before;
		if (props.spacing.after !== undefined) attrs['w:after'] = props.spacing.after;
		if (props.spacing.line !== undefined) attrs['w:line'] = props.spacing.line;
		if (props.spacing.lineRule) attrs['w:lineRule'] = props.spacing.lineRule;
		b.empty('w:spacing', attrs);
	}

	if (props.indent) {
		const attrs: Record<string, string | number> = {};
		if (props.indent.left !== undefined) attrs['w:left'] = props.indent.left;
		if (props.indent.right !== undefined) attrs['w:right'] = props.indent.right;
		if (props.indent.firstLine !== undefined) attrs['w:firstLine'] = props.indent.firstLine;
		if (props.indent.hanging !== undefined) attrs['w:hanging'] = props.indent.hanging;
		b.empty('w:ind', attrs);
	}

	if (props.alignment) {
		const val = props.alignment === 'justify' ? 'both' : props.alignment;
		b.empty('w:jc', { 'w:val': val });
	}

	if (props.outlineLevel !== undefined) {
		b.empty('w:outlineLvl', { 'w:val': props.outlineLevel });
	}

	if (props.runProperties) {
		writeRunProperties(b, props.runProperties);
	}

	if (extraContent) extraContent(b);

	b.close(); // w:pPr
}

/** Serialize a JPRun inline node to w:r XML. */
export function writeRun(b: XmlBuilder, node: JPInlineNode): void {
	if (node.type === 'run') {
		b.open('w:r');
		if (node.properties && Object.keys(node.properties).length > 0) {
			writeRunProperties(b, node.properties);
		}
		for (const child of node.children) {
			if (child.type === 'text') {
				if (child.text === '\n') {
					b.empty('w:br');
				} else if (child.text === '\t') {
					b.empty('w:tab');
				} else {
					b.open('w:t', { 'xml:space': 'preserve' });
					b.text(child.text);
					b.close();
				}
			}
		}
		b.close(); // w:r
	} else if (node.type === 'line-break') {
		b.open('w:r');
		b.empty('w:br');
		b.close();
	} else if (node.type === 'column-break') {
		b.open('w:r');
		b.empty('w:br', { 'w:type': 'column' });
		b.close();
	} else if (node.type === 'tab') {
		b.open('w:r');
		b.empty('w:tab');
		b.close();
	}
}
