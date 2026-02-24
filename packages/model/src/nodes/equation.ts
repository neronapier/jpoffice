import { generateId } from './node';
import type { JPLeaf } from './node';

/**
 * JPEquation is a leaf node representing a mathematical equation.
 * Uses LaTeX as the source of truth for the equation content.
 * Maps to OOXML w:oMath elements.
 */
export interface JPEquation extends JPLeaf {
	readonly type: 'equation';
	readonly id: string;
	/** LaTeX source string (source of truth for the equation). */
	readonly latex: string;
	/** Display mode: 'inline' renders within text flow, 'block' gets its own paragraph. */
	readonly display: 'inline' | 'block';
	/** Cached SVG rendering for performance. */
	readonly cachedSvg?: string;
}

/**
 * Create a new equation node.
 */
export function createEquation(latex: string, display: 'inline' | 'block' = 'inline'): JPEquation {
	return {
		type: 'equation',
		id: generateId(),
		latex,
		display,
	};
}

/**
 * Type guard for equation nodes.
 */
export function isEquation(node: unknown): node is JPEquation {
	return (
		typeof node === 'object' && node !== null && (node as { type: string }).type === 'equation'
	);
}
