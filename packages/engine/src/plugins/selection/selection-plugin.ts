import type { JPElement, JPNode, JPPath, JPPoint, JPRun } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import {
	findWordBoundary,
	firstTextNode,
	lastTextNode,
	nextTextNode,
	previousTextNode,
	resolveSelectionContext,
} from '../text/text-utils';

export interface MoveArgs {
	direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
	extend: boolean;
	word: boolean;
}

/**
 * SelectionPlugin handles cursor movement and selection commands.
 */
export class SelectionPlugin implements JPPlugin {
	readonly id = 'jpoffice.selection';
	readonly name = 'Selection';

	initialize(editor: JPEditor): void {
		editor.registerCommand<MoveArgs>({
			id: 'selection.move',
			name: 'Move Cursor',
			canExecute: () => editor.getSelection() !== null,
			execute: (_editor, args) => this.move(editor, args),
		});

		editor.registerCommand({
			id: 'selection.selectAll',
			name: 'Select All',
			shortcuts: ['Ctrl+A', 'Meta+A'],
			canExecute: () => true,
			execute: () => this.selectAll(editor),
		});
	}

	private move(editor: JPEditor, args: MoveArgs): void {
		const sel = editor.getSelection();
		if (!sel) return;

		const focus = sel.focus;
		let newPoint: JPPoint | null = null;

		switch (args.direction) {
			case 'ArrowLeft':
				newPoint = this.moveLeft(editor, focus, args.word);
				break;
			case 'ArrowRight':
				newPoint = this.moveRight(editor, focus, args.word);
				break;
			case 'Home':
				newPoint = this.moveHome(editor, focus);
				break;
			case 'End':
				newPoint = this.moveEnd(editor, focus);
				break;
			case 'ArrowUp':
				newPoint = this.moveToPreviousParagraph(editor, focus);
				break;
			case 'ArrowDown':
				newPoint = this.moveToNextParagraph(editor, focus);
				break;
		}

		if (!newPoint) return;

		if (args.extend) {
			editor.setSelection({ anchor: sel.anchor, focus: newPoint });
		} else {
			editor.setSelection({ anchor: newPoint, focus: newPoint });
		}
	}

	private moveLeft(editor: JPEditor, point: JPPoint, word: boolean): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		if (word) {
			const boundary = findWordBoundary(ctx.textNode.text, ctx.offset, 'backward');
			if (boundary < ctx.offset) {
				return { path: ctx.textPath, offset: boundary };
			}
			// At start of text node — jump to previous text
			const prev = previousTextNode(doc, ctx.textPath);
			if (!prev) return null;
			const prevBoundary = findWordBoundary(prev.node.text, prev.node.text.length, 'backward');
			return { path: prev.path, offset: prevBoundary };
		}

		if (ctx.offset > 0) {
			return { path: ctx.textPath, offset: ctx.offset - 1 };
		}

		// At start of text node — move to end of previous text
		const prev = previousTextNode(doc, ctx.textPath);
		if (!prev) return null;
		return { path: prev.path, offset: prev.node.text.length };
	}

	private moveRight(editor: JPEditor, point: JPPoint, word: boolean): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		if (word) {
			const boundary = findWordBoundary(ctx.textNode.text, ctx.offset, 'forward');
			if (boundary > ctx.offset) {
				return { path: ctx.textPath, offset: boundary };
			}
			// At end of text node — jump to next text
			const next = nextTextNode(doc, ctx.textPath);
			if (!next) return null;
			const nextBoundary = findWordBoundary(next.node.text, 0, 'forward');
			return { path: next.path, offset: nextBoundary };
		}

		if (ctx.offset < ctx.textNode.text.length) {
			return { path: ctx.textPath, offset: ctx.offset + 1 };
		}

		// At end of text node — move to start of next text
		const next = nextTextNode(doc, ctx.textPath);
		if (!next) return null;
		return { path: next.path, offset: 0 };
	}

	private moveHome(editor: JPEditor, point: JPPoint): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		// Move to start of first run's first text in the paragraph
		const firstRun = ctx.paragraph.children[0];
		if (!firstRun || firstRun.type !== 'run') return null;
		const firstTextPath: JPPath = [...ctx.paragraphPath, 0, 0];
		return { path: firstTextPath, offset: 0 };
	}

	private moveEnd(editor: JPEditor, point: JPPoint): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		// Move to end of last run's last text in the paragraph
		const lastRunIdx = ctx.paragraph.children.length - 1;
		const lastRun = ctx.paragraph.children[lastRunIdx];
		if (!lastRun || lastRun.type !== 'run') return null;

		const run = lastRun as JPRun;
		const lastTextIdx = run.children.length - 1;
		const lastTextPath: JPPath = [...ctx.paragraphPath, lastRunIdx, lastTextIdx];
		const lastText = run.children[lastTextIdx];
		return { path: lastTextPath, offset: lastText.text.length };
	}

	private moveToPreviousParagraph(editor: JPEditor, point: JPPoint): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		// Find the first text node in the previous paragraph
		if (ctx.paragraphIndex > 0) {
			const prevParaPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex - 1];
			try {
				// Walk to previous paragraph's first text
				let node: JPNode = doc;
				for (const idx of prevParaPath) {
					node = (node as JPElement).children[idx];
				}
				const prevPara = node as JPElement;
				if (node.type === 'paragraph' && prevPara.children.length > 0) {
					const firstRun = prevPara.children[0] as JPElement;
					if (firstRun.type === 'run' && firstRun.children.length > 0) {
						const textPath: JPPath = [...prevParaPath, 0, 0];
						return { path: textPath, offset: 0 };
					}
				}
			} catch {
				return null;
			}
		}
		return null;
	}

	private moveToNextParagraph(editor: JPEditor, point: JPPoint): JPPoint | null {
		const doc = editor.getDocument();
		const ctx = resolveSelectionContext(doc, point);

		const nextParaPath: JPPath = [...ctx.sectionPath, ctx.paragraphIndex + 1];
		try {
			let node: JPNode = doc;
			for (const idx of nextParaPath) {
				if (!('children' in node) || !(node as JPElement).children[idx]) return null;
				node = (node as JPElement).children[idx];
			}
			const nextPara = node as JPElement;
			if (node.type === 'paragraph' && nextPara.children.length > 0) {
				const firstRun = nextPara.children[0] as JPElement;
				if (firstRun.type === 'run' && firstRun.children.length > 0) {
					const textPath: JPPath = [...nextParaPath, 0, 0];
					return { path: textPath, offset: 0 };
				}
			}
		} catch {
			return null;
		}
		return null;
	}

	private selectAll(editor: JPEditor): void {
		const doc = editor.getDocument();
		const first = firstTextNode(doc);
		const last = lastTextNode(doc);
		if (!first || !last) return;

		editor.setSelection({
			anchor: { path: first.path, offset: 0 },
			focus: { path: last.path, offset: last.node.text.length },
		});
	}
}
