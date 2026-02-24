import type { JPBody } from './nodes/body';
import type { JPComment } from './nodes/comment';
import type { JPFootnote } from './nodes/footnote';
import type { JPFooter, JPHeader } from './nodes/header-footer';
import type { JPElement } from './nodes/node';
import { EMPTY_NUMBERING_REGISTRY } from './properties/numbering';
import type { JPNumberingRegistry } from './properties/numbering';
import type { JPTrackChangesConfig } from './properties/revision-props';
import { createStyleRegistry } from './styles/style-registry';
import type { JPStyleRegistry } from './styles/style-registry';

/**
 * Document metadata.
 */
export interface JPDocumentMetadata {
	readonly title?: string;
	readonly author?: string;
	readonly created?: string; // ISO 8601
	readonly modified?: string;
	readonly description?: string;
	readonly language?: string; // BCP47, e.g. 'es-AR'
}

/**
 * Media asset embedded in the document (images, etc).
 */
export interface JPMediaAsset {
	readonly id: string;
	readonly contentType: string;
	readonly data: Uint8Array;
	readonly fileName: string;
}

/**
 * JPDocument is the root node of the document tree.
 * It contains exactly one JPBody, plus style, numbering,
 * and media registries.
 */
export interface JPDocument extends JPElement {
	readonly type: 'document';
	readonly children: readonly [JPBody];
	readonly styles: JPStyleRegistry;
	readonly numbering: JPNumberingRegistry;
	readonly metadata: JPDocumentMetadata;
	readonly media: ReadonlyMap<string, JPMediaAsset>;
	readonly headers: ReadonlyMap<string, JPHeader>;
	readonly footers: ReadonlyMap<string, JPFooter>;
	readonly comments: readonly JPComment[];
	readonly footnotes: readonly JPFootnote[];
	readonly endnotes: readonly JPFootnote[];
	readonly trackChanges?: JPTrackChangesConfig;
	readonly themeColors?: Record<string, string>;
}

export function createDocument(config: {
	id: string;
	body: JPBody;
	styles?: JPStyleRegistry;
	numbering?: JPNumberingRegistry;
	metadata?: JPDocumentMetadata;
	media?: ReadonlyMap<string, JPMediaAsset>;
	headers?: ReadonlyMap<string, JPHeader>;
	footers?: ReadonlyMap<string, JPFooter>;
	comments?: readonly JPComment[];
	footnotes?: readonly JPFootnote[];
	endnotes?: readonly JPFootnote[];
	trackChanges?: JPTrackChangesConfig;
	themeColors?: Record<string, string>;
}): JPDocument {
	return {
		type: 'document',
		id: config.id,
		children: [config.body],
		styles: config.styles ?? createStyleRegistry([]),
		numbering: config.numbering ?? EMPTY_NUMBERING_REGISTRY,
		metadata: config.metadata ?? {},
		media: config.media ?? new Map(),
		headers: config.headers ?? new Map(),
		footers: config.footers ?? new Map(),
		comments: config.comments ?? [],
		footnotes: config.footnotes ?? [],
		endnotes: config.endnotes ?? [],
		trackChanges: config.trackChanges,
		themeColors: config.themeColors,
	};
}

export function isDocument(node: { type: string }): node is JPDocument {
	return node.type === 'document';
}
