/**
 * Serialization helpers for JPDocument.
 * JPDocument contains Maps (headers, footers, media, styles) which are not
 * directly JSON-serializable. These helpers convert to/from a JSON-safe format.
 */

import type { JPDocument, JPFooter, JPHeader, JPMediaAsset } from '@jpoffice/model';
import { createDocument } from '@jpoffice/model';

interface SerializedDocument {
	id: string;
	body: JPDocument['children'][0];
	styles: JPDocument['styles'];
	numbering: JPDocument['numbering'];
	metadata: JPDocument['metadata'];
	media: [string, { id: string; contentType: string; data: number[]; fileName: string }][];
	headers: [string, JPHeader][];
	footers: [string, JPFooter][];
}

/** Serialize a JPDocument to a JSON string. */
export function serializeDocument(doc: JPDocument): string {
	const serialized: SerializedDocument = {
		id: doc.id,
		body: doc.children[0],
		styles: doc.styles,
		numbering: doc.numbering,
		metadata: doc.metadata,
		media: Array.from(doc.media.entries()).map(([k, v]) => [
			k,
			{ id: v.id, contentType: v.contentType, data: Array.from(v.data), fileName: v.fileName },
		]),
		headers: Array.from(doc.headers.entries()),
		footers: Array.from(doc.footers.entries()),
	};
	return JSON.stringify(serialized);
}

/** Deserialize a JSON string back into a JPDocument. */
export function deserializeDocument(json: string): JPDocument {
	const data = JSON.parse(json) as SerializedDocument;

	const media = new Map<string, JPMediaAsset>(
		data.media.map(([k, v]) => [
			k,
			{ id: v.id, contentType: v.contentType, data: new Uint8Array(v.data), fileName: v.fileName },
		]),
	);

	return createDocument({
		id: data.id,
		body: data.body,
		styles: data.styles,
		numbering: data.numbering,
		metadata: data.metadata,
		media,
		headers: new Map(data.headers),
		footers: new Map(data.footers),
	});
}
