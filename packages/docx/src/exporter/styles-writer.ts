import type { JPStyleRegistry } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';
import { writeParagraphProperties, writeRunProperties } from './run-writer';

/** Generate word/styles.xml from a JPStyleRegistry. */
export function writeStyles(registry: JPStyleRegistry): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('w:styles', {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
		'xmlns:mc': NS.mc,
	});

	for (const style of registry.styles) {
		b.open('w:style', {
			'w:type': style.type,
			'w:styleId': style.id,
			...(style.isDefault ? { 'w:default': '1' } : {}),
		});

		b.empty('w:name', { 'w:val': style.name });

		if (style.basedOn) b.empty('w:basedOn', { 'w:val': style.basedOn });
		if (style.next) b.empty('w:next', { 'w:val': style.next });

		if (style.paragraphProperties) {
			writeParagraphProperties(b, style.paragraphProperties);
		}

		if (style.runProperties) {
			writeRunProperties(b, style.runProperties);
		}

		b.close(); // w:style
	}

	b.close(); // w:styles
	return b.build();
}
