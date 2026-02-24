import type { JPMentionType } from '@jpoffice/model';
import { createMention } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';

export interface MentionSuggestion {
	readonly label: string;
	readonly value: string;
	readonly type: JPMentionType;
}

export interface MentionPluginConfig {
	onTrigger?: (query: string, position: { x: number; y: number }) => void;
	onDismiss?: () => void;
	getSuggestions?: (query: string, type: JPMentionType) => MentionSuggestion[];
}

export class MentionPlugin implements JPPlugin {
	readonly id = 'jpoffice.mention';
	readonly name = 'Mention';
	private config: MentionPluginConfig;
	private active = false;
	private query = '';

	constructor(config: MentionPluginConfig = {}) {
		this.config = config;
	}

	initialize(editor: JPEditor): void {
		editor.registerCommand<{
			type: JPMentionType;
			label: string;
			value: string;
		}>({
			id: 'mention.insert',
			name: 'Insert Mention',
			canExecute: (ed: JPEditor) => {
				const sel = ed.getSelection();
				return sel != null && sel.anchor != null;
			},
			execute: (_editor: JPEditor, args: { type: JPMentionType; label: string; value: string }) => {
				const sel = editor.getSelection();
				if (!sel?.anchor) return;

				const mention = createMention(args.type, args.label, args.value);
				editor.apply({
					type: 'insert_node',
					path: sel.anchor.path,
					node: mention,
				});

				this.active = false;
				this.query = '';
				this.config.onDismiss?.();
			},
		});
	}

	destroy(): void {
		this.active = false;
		this.query = '';
	}

	/** Check if the @ trigger is active. */
	isActive(): boolean {
		return this.active;
	}

	/** Get current query string after @. */
	getQuery(): string {
		return this.query;
	}

	/** Manually trigger mention mode. */
	trigger(query: string, position: { x: number; y: number }): void {
		this.active = true;
		this.query = query;
		this.config.onTrigger?.(query, position);
	}

	/** Dismiss mention autocomplete. */
	dismiss(): void {
		this.active = false;
		this.query = '';
		this.config.onDismiss?.();
	}
}
