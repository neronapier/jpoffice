import type { JPNumberingRegistry } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';

/** Generate word/numbering.xml from a JPNumberingRegistry. */
export function writeNumbering(registry: JPNumberingRegistry): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('w:numbering', {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
	});

	// Abstract numbering definitions
	for (const abstractNum of registry.abstractNumberings) {
		b.open('w:abstractNum', { 'w:abstractNumId': abstractNum.abstractNumId });

		for (const level of abstractNum.levels) {
			b.open('w:lvl', { 'w:ilvl': level.level });

			b.empty('w:start', { 'w:val': level.start ?? 1 });
			b.empty('w:numFmt', { 'w:val': level.format });
			b.empty('w:lvlText', { 'w:val': level.text });
			b.empty('w:lvlJc', { 'w:val': level.alignment });

			// Paragraph properties for indent
			if (level.indent || level.hangingIndent) {
				b.open('w:pPr');
				const indAttrs: Record<string, number> = {};
				if (level.indent) indAttrs['w:left'] = level.indent;
				if (level.hangingIndent) indAttrs['w:hanging'] = level.hangingIndent;
				b.empty('w:ind', indAttrs);
				b.close(); // w:pPr
			}

			// Run properties for font (bullets)
			if (level.font) {
				b.open('w:rPr');
				b.empty('w:rFonts', { 'w:ascii': level.font, 'w:hAnsi': level.font });
				b.close(); // w:rPr
			}

			b.close(); // w:lvl
		}

		b.close(); // w:abstractNum
	}

	// Numbering instances
	for (const instance of registry.instances) {
		b.open('w:num', { 'w:numId': instance.numId });
		b.empty('w:abstractNumId', { 'w:val': instance.abstractNumId });

		if (instance.overrides) {
			for (const ov of instance.overrides) {
				b.open('w:lvlOverride', { 'w:ilvl': ov.level });
				if (ov.startOverride !== undefined) {
					b.empty('w:startOverride', { 'w:val': ov.startOverride });
				}
				b.close(); // w:lvlOverride
			}
		}

		b.close(); // w:num
	}

	b.close(); // w:numbering
	return b.build();
}
