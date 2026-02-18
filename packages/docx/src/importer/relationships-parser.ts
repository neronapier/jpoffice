import { allDirectChildren, attr } from '../xml/xml-parser';

/** A single relationship entry from a .rels file. */
export interface Relationship {
	readonly id: string;
	readonly type: string;
	readonly target: string;
	readonly targetMode?: string;
}

/** Map of relationship ID → Relationship. */
export type RelationshipMap = Map<string, Relationship>;

/** Parse a .rels XML document into a RelationshipMap. */
export function parseRelationships(doc: Document): RelationshipMap {
	const map = new Map<string, Relationship>();
	const root = doc.documentElement;
	if (!root) return map;

	const children = allDirectChildren(root);
	for (const el of children) {
		if (el.localName !== 'Relationship') continue;

		const id = attr(el, 'Id');
		const type = attr(el, 'Type');
		const target = attr(el, 'Target');
		if (!id || !type || !target) continue;

		const targetMode = attr(el, 'TargetMode') ?? undefined;
		map.set(id, { id, type, target, targetMode });
	}

	return map;
}

/** Find the first relationship of a given type. */
export function findRelByType(rels: RelationshipMap, type: string): Relationship | undefined {
	for (const rel of rels.values()) {
		if (rel.type === type) return rel;
	}
	return undefined;
}

/** Find all relationships of a given type. */
export function findRelsByType(rels: RelationshipMap, type: string): Relationship[] {
	const result: Relationship[] = [];
	for (const rel of rels.values()) {
		if (rel.type === type) result.push(rel);
	}
	return result;
}

/**
 * Resolve a relationship target to a full ZIP path.
 * Targets in word/_rels/document.xml.rels are relative to word/.
 */
export function resolveTarget(target: string, basePath: string): string {
	if (target.startsWith('/')) return target.slice(1);
	return basePath + target;
}
