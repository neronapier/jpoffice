import type { JPParagraphProperties } from '../properties/paragraph-props';
import type { JPRunProperties } from '../properties/run-props';
import type { JPStyle } from './style';

/**
 * The style registry holds all named styles and provides
 * resolved (inherited) property lookups.
 */
export interface JPStyleRegistry {
	readonly styles: readonly JPStyle[];
}

export function createStyleRegistry(styles: readonly JPStyle[]): JPStyleRegistry {
	return { styles };
}

/**
 * Find a style by id.
 */
export function findStyle(registry: JPStyleRegistry, styleId: string): JPStyle | undefined {
	return registry.styles.find((s) => s.id === styleId);
}

/**
 * Find the default style for a given type.
 */
export function findDefaultStyle(
	registry: JPStyleRegistry,
	type: JPStyle['type'],
): JPStyle | undefined {
	return registry.styles.find((s) => s.type === type && s.isDefault);
}

/**
 * Resolve the full paragraph properties for a style by walking
 * the basedOn chain. Properties closer to the leaf override parents.
 */
export function resolveStyleParagraphProperties(
	registry: JPStyleRegistry,
	styleId: string,
): JPParagraphProperties {
	const chain = getStyleChain(registry, styleId);
	let resolved: JPParagraphProperties = {};
	// Walk from root to leaf, each level overrides
	for (const style of chain) {
		if (style.paragraphProperties) {
			resolved = { ...resolved, ...style.paragraphProperties };
		}
	}
	return resolved;
}

/**
 * Resolve the full run properties for a style by walking
 * the basedOn chain.
 */
export function resolveStyleRunProperties(
	registry: JPStyleRegistry,
	styleId: string,
): JPRunProperties {
	const chain = getStyleChain(registry, styleId);
	let resolved: JPRunProperties = {};
	for (const style of chain) {
		if (style.runProperties) {
			resolved = { ...resolved, ...style.runProperties };
		}
	}
	return resolved;
}

/**
 * Get the inheritance chain for a style (root ancestor first, target last).
 * Protects against circular references with a depth limit.
 */
function getStyleChain(registry: JPStyleRegistry, styleId: string): JPStyle[] {
	const chain: JPStyle[] = [];
	const visited = new Set<string>();
	let currentId: string | undefined = styleId;

	while (currentId && !visited.has(currentId)) {
		visited.add(currentId);
		const style = findStyle(registry, currentId);
		if (!style) break;
		chain.unshift(style); // prepend so root is first
		currentId = style.basedOn;
	}

	return chain;
}
