/**
 * Numbering/list definitions.
 * Maps to OOXML w:numbering.xml structures.
 */

export type JPNumberFormat =
	| 'decimal'
	| 'lowerLetter'
	| 'upperLetter'
	| 'lowerRoman'
	| 'upperRoman'
	| 'bullet'
	| 'none';

export interface JPNumberingLevel {
	readonly level: number; // 0-8
	readonly format: JPNumberFormat;
	readonly text: string; // e.g. '%1.' or bullet char '\u2022'
	readonly alignment: 'left' | 'center' | 'right';
	readonly indent: number; // twips
	readonly hangingIndent: number; // twips
	readonly font?: string; // font for bullet character
	readonly start?: number; // starting number (default 1)
}

export interface JPAbstractNumbering {
	readonly abstractNumId: number;
	readonly levels: readonly JPNumberingLevel[];
}

export interface JPNumberingInstance {
	readonly numId: number;
	readonly abstractNumId: number;
	readonly overrides?: readonly {
		readonly level: number;
		readonly startOverride?: number;
	}[];
}

export interface JPNumberingRegistry {
	readonly abstractNumberings: readonly JPAbstractNumbering[];
	readonly instances: readonly JPNumberingInstance[];
}

export const EMPTY_NUMBERING_REGISTRY: JPNumberingRegistry = {
	abstractNumberings: [],
	instances: [],
};

// === Mutation utilities (immutable — return new objects) ===

/** Add an abstract numbering definition to the registry. */
export function addAbstractNumbering(
	registry: JPNumberingRegistry,
	abstractNumbering: JPAbstractNumbering,
): JPNumberingRegistry {
	return {
		...registry,
		abstractNumberings: [...registry.abstractNumberings, abstractNumbering],
	};
}

/** Remove an abstract numbering by its abstractNumId. */
export function removeAbstractNumbering(
	registry: JPNumberingRegistry,
	abstractNumId: number,
): JPNumberingRegistry {
	return {
		...registry,
		abstractNumberings: registry.abstractNumberings.filter(
			(a) => a.abstractNumId !== abstractNumId,
		),
		// Also remove instances that reference this abstract numbering
		instances: registry.instances.filter((i) => i.abstractNumId !== abstractNumId),
	};
}

/** Update an abstract numbering definition (replace by abstractNumId). */
export function updateAbstractNumbering(
	registry: JPNumberingRegistry,
	abstractNumbering: JPAbstractNumbering,
): JPNumberingRegistry {
	return {
		...registry,
		abstractNumberings: registry.abstractNumberings.map((a) =>
			a.abstractNumId === abstractNumbering.abstractNumId ? abstractNumbering : a,
		),
	};
}

/** Add a numbering instance to the registry. */
export function addNumberingInstance(
	registry: JPNumberingRegistry,
	instance: JPNumberingInstance,
): JPNumberingRegistry {
	return {
		...registry,
		instances: [...registry.instances, instance],
	};
}

/** Remove a numbering instance by its numId. */
export function removeNumberingInstance(
	registry: JPNumberingRegistry,
	numId: number,
): JPNumberingRegistry {
	return {
		...registry,
		instances: registry.instances.filter((i) => i.numId !== numId),
	};
}

/** Update a numbering instance (replace by numId). */
export function updateNumberingInstance(
	registry: JPNumberingRegistry,
	instance: JPNumberingInstance,
): JPNumberingRegistry {
	return {
		...registry,
		instances: registry.instances.map((i) => (i.numId === instance.numId ? instance : i)),
	};
}

/** Find an abstract numbering by its abstractNumId. */
export function findAbstractNumbering(
	registry: JPNumberingRegistry,
	abstractNumId: number,
): JPAbstractNumbering | undefined {
	return registry.abstractNumberings.find((a) => a.abstractNumId === abstractNumId);
}

/** Find a numbering instance by its numId. */
export function findNumberingInstance(
	registry: JPNumberingRegistry,
	numId: number,
): JPNumberingInstance | undefined {
	return registry.instances.find((i) => i.numId === numId);
}

/** Resolve a numbering level: get the effective level definition for a numId + level. */
export function resolveNumberingLevel(
	registry: JPNumberingRegistry,
	numId: number,
	level: number,
): JPNumberingLevel | undefined {
	const instance = findNumberingInstance(registry, numId);
	if (!instance) return undefined;
	const abstract = findAbstractNumbering(registry, instance.abstractNumId);
	if (!abstract) return undefined;
	return abstract.levels.find((l) => l.level === level);
}
