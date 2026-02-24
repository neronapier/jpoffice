import { generateId } from './node';
import type { JPLeaf } from './node';

/** Types of mentions supported. */
export type JPMentionType = 'person' | 'file' | 'date';

/** A mention leaf node representing an @mention inline element. */
export interface JPMention extends JPLeaf {
	readonly type: 'mention';
	readonly id: string;
	readonly mentionType: JPMentionType;
	readonly label: string;
	readonly value: string;
}

export function createMention(mentionType: JPMentionType, label: string, value: string): JPMention {
	return { type: 'mention', id: generateId(), mentionType, label, value };
}

export function isMention(node: unknown): node is JPMention {
	return typeof node === 'object' && node !== null && (node as { type: string }).type === 'mention';
}
