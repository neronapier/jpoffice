import { strFromU8, unzipSync } from 'fflate';
import { parseXml } from '../xml/xml-parser';

/** Represents a parsed DOCX package (ZIP contents). */
export interface DocxPackage {
	/** All raw ZIP entries keyed by path. */
	readonly entries: Map<string, Uint8Array>;
	/** Pre-parsed XML documents keyed by path. */
	readonly xml: Map<string, Document>;
}

/** Extract and parse a .docx ZIP archive. */
export function readDocxPackage(data: Uint8Array): DocxPackage {
	const raw = unzipSync(data);
	const entries = new Map<string, Uint8Array>();
	const xml = new Map<string, Document>();

	for (const path of Object.keys(raw)) {
		const bytes = raw[path];
		entries.set(path, bytes);

		// Parse XML and .rels files
		if (path.endsWith('.xml') || path.endsWith('.rels')) {
			try {
				const text = strFromU8(bytes);
				const doc = parseXml(text);
				xml.set(path, doc);
			} catch {
				// Skip unparseable XML silently
			}
		}
	}

	return { entries, xml };
}
