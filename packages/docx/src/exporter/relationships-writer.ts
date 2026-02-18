import { REL_TYPE } from '../xml/namespaces';
import { XmlBuilder } from '../xml/xml-builder';

const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** A single relationship entry for serialization. */
export interface RelEntry {
	readonly id: string;
	readonly type: string;
	readonly target: string;
	readonly targetMode?: string;
}

/** Tracks assigned relationship IDs during export. */
export class RelationshipTracker {
	private counter = 0;
	private entries: RelEntry[] = [];

	/** Add a relationship and return its assigned rId. */
	add(type: string, target: string, targetMode?: string): string {
		this.counter++;
		const id = `rId${this.counter}`;
		this.entries.push({ id, type, target, targetMode });
		return id;
	}

	/** Get all entries. */
	getEntries(): readonly RelEntry[] {
		return this.entries;
	}
}

/** Generate _rels/.rels (package-level relationships). */
export function writePkgRelationships(hasCoreProperties: boolean): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('Relationships', { xmlns: RELS_NS });

	b.empty('Relationship', {
		Id: 'rId1',
		Type: REL_TYPE.officeDocument,
		Target: 'word/document.xml',
	});

	if (hasCoreProperties) {
		b.empty('Relationship', {
			Id: 'rId2',
			Type: REL_TYPE.coreProperties,
			Target: 'docProps/core.xml',
		});
	}

	b.close();
	return b.build();
}

/** Generate word/_rels/document.xml.rels from a RelationshipTracker. */
export function writeDocRelationships(tracker: RelationshipTracker): string {
	const b = new XmlBuilder();
	b.declaration();
	b.open('Relationships', { xmlns: RELS_NS });

	for (const entry of tracker.getEntries()) {
		const attrs: Record<string, string> = {
			Id: entry.id,
			Type: entry.type,
			Target: entry.target,
		};
		if (entry.targetMode) attrs.TargetMode = entry.targetMode;
		b.empty('Relationship', attrs);
	}

	b.close();
	return b.build();
}
