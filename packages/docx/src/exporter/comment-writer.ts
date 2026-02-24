import type { JPComment } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';

// ─── Comment Writing ────────────────────────────────────────────────────────

/**
 * Serialize an array of JPComment objects to word/comments.xml.
 *
 * Generates:
 * ```xml
 * <w:comments xmlns:w="...">
 *   <w:comment w:id="0" w:author="John" w:date="2024-01-01T00:00:00Z">
 *     <w:p><w:r><w:t>Comment text</w:t></w:r></w:p>
 *   </w:comment>
 * </w:comments>
 * ```
 */
export function writeComments(comments: readonly JPComment[]): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('w:comments', {
		'xmlns:w': NS.w,
		'xmlns:r': NS.r,
	});

	for (const comment of comments) {
		const attrs: Record<string, string> = {
			'w:id': comment.id,
			'w:author': comment.author,
		};
		if (comment.date) {
			attrs['w:date'] = comment.date;
		}

		b.open('w:comment', attrs);

		// Write comment text as a single paragraph with a single run
		b.open('w:p');
		b.open('w:r');
		b.open('w:t', { 'xml:space': 'preserve' });
		b.text(comment.text);
		b.close(); // w:t
		b.close(); // w:r
		b.close(); // w:p

		b.close(); // w:comment
	}

	b.close(); // w:comments
	return b.build();
}
