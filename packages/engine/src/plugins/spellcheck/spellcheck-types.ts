import type { JPPath } from '@jpoffice/model';

/**
 * A single spelling or grammar error found in the document.
 */
export interface SpellError {
	readonly path: JPPath;
	readonly offset: number;
	readonly length: number;
	readonly word: string;
	readonly suggestions: string[];
	readonly type: 'spelling' | 'grammar';
}

/**
 * Interface for spell check providers.
 * Consumers can implement this to provide custom spell checking
 * (e.g., via a server API, nspell/hunspell, or browser APIs).
 */
export interface SpellCheckProvider {
	check(text: string, language?: string): Promise<SpellError[]>;
	addToPersonalDictionary?(word: string): void;
	getSuggestions?(word: string): Promise<string[]>;
}

/**
 * The state of the spell check system.
 */
export interface SpellCheckState {
	readonly enabled: boolean;
	readonly errors: ReadonlyMap<string, readonly SpellError[]>;
	readonly language: string;
	readonly checking: boolean;
}
