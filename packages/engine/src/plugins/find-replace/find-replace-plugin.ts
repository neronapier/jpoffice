import type { JPDocument, JPPath, JPText } from '@jpoffice/model';
import { traverseTexts } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';

export interface SearchMatch {
	readonly path: JPPath;
	readonly offset: number;
	readonly length: number;
}

export interface FindReplaceState {
	readonly term: string;
	readonly caseSensitive: boolean;
	readonly matches: readonly SearchMatch[];
	readonly currentIndex: number;
}

/**
 * FindReplacePlugin handles document search, navigation, and replacement.
 */
export class FindReplacePlugin implements JPPlugin {
	readonly id = 'jpoffice.findReplace';
	readonly name = 'Find & Replace';

	private state: FindReplaceState = {
		term: '',
		caseSensitive: false,
		matches: [],
		currentIndex: -1,
	};

	/** Callback set by React layer to open the find/replace UI */
	onShowUI?: (showReplace?: boolean) => void;

	/** Callback to notify React of state changes */
	onStateChange?: (state: FindReplaceState) => void;

	reset(_editor: JPEditor): void {
		this.state = {
			term: '',
			caseSensitive: false,
			matches: [],
			currentIndex: -1,
		};
		this.onStateChange?.(this.state);
	}

	initialize(editor: JPEditor): void {
		editor.registerCommand<{ term: string; caseSensitive?: boolean }>({
			id: 'find.search',
			name: 'Search',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.search(editor, args.term, args.caseSensitive ?? false);
			},
		});

		editor.registerCommand({
			id: 'find.next',
			name: 'Next Match',
			canExecute: () => this.state.matches.length > 0,
			execute: () => this.navigateMatch(editor, 1),
		});

		editor.registerCommand({
			id: 'find.previous',
			name: 'Previous Match',
			canExecute: () => this.state.matches.length > 0,
			execute: () => this.navigateMatch(editor, -1),
		});

		editor.registerCommand<{ replacement: string }>({
			id: 'find.replace',
			name: 'Replace',
			canExecute: () => !editor.isReadOnly() && this.state.currentIndex >= 0,
			execute: (_ed, args) => this.replaceCurrent(editor, args.replacement),
		});

		editor.registerCommand<{ replacement: string }>({
			id: 'find.replaceAll',
			name: 'Replace All',
			canExecute: () => !editor.isReadOnly() && this.state.matches.length > 0,
			execute: (_ed, args) => this.replaceAll(editor, args.replacement),
		});

		editor.registerCommand<{ replace?: boolean }>({
			id: 'find.showUI',
			name: 'Show Find UI',
			canExecute: () => true,
			execute: (_ed, args) => {
				this.onShowUI?.(args?.replace);
			},
		});

		editor.registerCommand({
			id: 'find.clear',
			name: 'Clear Search',
			canExecute: () => true,
			execute: () => this.clearSearch(),
		});
	}

	getState(): FindReplaceState {
		return this.state;
	}

	private setState(partial: Partial<FindReplaceState>): void {
		this.state = { ...this.state, ...partial };
		this.onStateChange?.(this.state);
	}

	private search(editor: JPEditor, term: string, caseSensitive: boolean): void {
		if (!term) {
			this.clearSearch();
			return;
		}

		const doc = editor.getDocument();
		const matches = this.findAllMatches(doc, term, caseSensitive);
		const currentIndex = matches.length > 0 ? 0 : -1;

		this.setState({ term, caseSensitive, matches, currentIndex });

		if (currentIndex >= 0) {
			this.selectMatch(editor, matches[currentIndex]);
		}
	}

	private findAllMatches(doc: JPDocument, term: string, caseSensitive: boolean): SearchMatch[] {
		const matches: SearchMatch[] = [];
		const searchTerm = caseSensitive ? term : term.toLowerCase();

		for (const [textNode, textPath] of traverseTexts(doc)) {
			const text = caseSensitive ? textNode.text : textNode.text.toLowerCase();
			let pos = 0;
			while (pos < text.length) {
				const idx = text.indexOf(searchTerm, pos);
				if (idx === -1) break;
				matches.push({
					path: textPath,
					offset: idx,
					length: searchTerm.length,
				});
				pos = idx + 1;
			}
		}

		return matches;
	}

	private navigateMatch(editor: JPEditor, direction: 1 | -1): void {
		const { matches, currentIndex } = this.state;
		if (matches.length === 0) return;

		let newIndex = currentIndex + direction;
		if (newIndex >= matches.length) newIndex = 0;
		if (newIndex < 0) newIndex = matches.length - 1;

		this.setState({ currentIndex: newIndex });
		this.selectMatch(editor, matches[newIndex]);
	}

	private selectMatch(editor: JPEditor, match: SearchMatch): void {
		const anchor = { path: match.path, offset: match.offset };
		const focus = { path: match.path, offset: match.offset + match.length };
		editor.setSelection({ anchor, focus });
	}

	private replaceCurrent(editor: JPEditor, replacement: string): void {
		const { matches, currentIndex, term, caseSensitive } = this.state;
		if (currentIndex < 0 || currentIndex >= matches.length) return;

		const match = matches[currentIndex];

		editor.batch(() => {
			// Delete the matched text
			editor.apply({
				type: 'delete_text',
				path: match.path,
				offset: match.offset,
				text: editor.getDocument().children ? this.getMatchText(editor.getDocument(), match) : term,
			});
			// Insert replacement
			if (replacement.length > 0) {
				editor.apply({
					type: 'insert_text',
					path: match.path,
					offset: match.offset,
					text: replacement,
				});
			}
		});

		// Re-search to update matches
		this.search(editor, term, caseSensitive);
	}

	private replaceAll(editor: JPEditor, replacement: string): void {
		const { matches, term, caseSensitive } = this.state;
		if (matches.length === 0) return;

		// Replace in reverse order to preserve earlier offsets
		const reversed = [...matches].reverse();

		editor.batch(() => {
			for (const match of reversed) {
				editor.apply({
					type: 'delete_text',
					path: match.path,
					offset: match.offset,
					text: this.getMatchText(editor.getDocument(), match),
				});
				if (replacement.length > 0) {
					editor.apply({
						type: 'insert_text',
						path: match.path,
						offset: match.offset,
						text: replacement,
					});
				}
			}
		});

		// Re-search (should find 0 matches now)
		this.search(editor, term, caseSensitive);
	}

	private getMatchText(doc: JPDocument, match: SearchMatch): string {
		let node: unknown = doc;
		for (const idx of match.path) {
			node = (node as { children: unknown[] }).children[idx];
		}
		return (node as JPText).text.slice(match.offset, match.offset + match.length);
	}

	private clearSearch(): void {
		this.setState({
			term: '',
			matches: [],
			currentIndex: -1,
		});
	}
}
