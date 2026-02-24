import type { JPFootnote } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';
import { writeParagraphProperties, writeRun } from './run-writer';

// ─── Footnote/Endnote Writing ──────────────────────────────────────────────

/**
 * Serialize JPFootnote[] to a footnotes.xml or endnotes.xml string.
 *
 * Writes the required separator and continuationSeparator entries first,
 * then each real footnote/endnote with its paragraph content.
 */
export function writeFootnotes(
	footnotes: readonly JPFootnote[],
	noteType: 'footnote' | 'endnote',
): string {
	const b = new XmlBuilder();
	b.declaration();

	const rootTag = noteType === 'footnote' ? 'w:footnotes' : 'w:endnotes';
	const noteTag = noteType === 'footnote' ? 'w:footnote' : 'w:endnote';

	b.open(rootTag, {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
	});

	// Write separator (id="-1")
	writeSeparator(b, noteTag, '-1', 'separator');

	// Write continuationSeparator (id="0")
	writeSeparator(b, noteTag, '0', 'continuationSeparator');

	// Write each real footnote/endnote
	for (const note of footnotes) {
		b.open(noteTag, { 'w:id': note.id });

		for (const para of note.content) {
			b.open('w:p');

			if (para.properties && Object.keys(para.properties).length > 0) {
				writeParagraphProperties(b, para.properties);
			}

			for (const child of para.children) {
				if (child.type === 'run') {
					writeRun(b, child);
				}
			}

			b.close(); // w:p
		}

		b.close(); // w:footnote or w:endnote
	}

	b.close(); // w:footnotes or w:endnotes
	return b.build();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Write a separator or continuationSeparator footnote/endnote entry.
 * These are required OOXML entries that Word expects to be present.
 */
function writeSeparator(b: XmlBuilder, noteTag: string, id: string, type: string): void {
	b.open(noteTag, { 'w:type': type, 'w:id': id });
	b.open('w:p');
	b.open('w:r');
	if (type === 'separator') {
		b.empty('w:separator');
	} else {
		b.empty('w:continuationSeparator');
	}
	b.close(); // w:r
	b.close(); // w:p
	b.close(); // noteTag
}
