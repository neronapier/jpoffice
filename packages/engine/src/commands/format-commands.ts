import type { JPPath, JPRange } from '@jpoffice/model';
import { comparePaths, getNodeAtPath, isRun, parentPath, traverseNodes } from '@jpoffice/model';
import type { JPRun } from '@jpoffice/model';
import type { JPEditor } from '../editor';
import { SelectionManager } from '../selection/selection-manager';
import type { JPCommand } from './command';

/**
 * Collect all run paths within a normalized selection range.
 */
function getRunsInRange(editor: JPEditor, range: JPRange): JPPath[] {
	const doc = editor.getDocument();
	const norm = SelectionManager.normalize(range);
	const startRunPath = parentPath(norm.anchor.path);
	const endRunPath = parentPath(norm.focus.path);

	const runs: JPPath[] = [];
	for (const [node, path] of traverseNodes(doc)) {
		if (isRun(node) && path.length === startRunPath.length) {
			if (comparePaths(path, startRunPath) >= 0 && comparePaths(path, endRunPath) <= 0) {
				runs.push(path);
			}
		}
	}
	return runs;
}

type ToggleProperty = 'bold' | 'italic' | 'underline';

function createFormatCommand(
	id: string,
	name: string,
	prop: ToggleProperty,
	shortcuts: string[],
): JPCommand<void> {
	return {
		id,
		name,
		shortcuts,

		canExecute(editor) {
			if (editor.isReadOnly()) return false;
			const sel = editor.getSelection();
			return sel !== null && !SelectionManager.isCollapsed(sel);
		},

		execute(editor) {
			const selection = editor.getSelection();
			if (!selection || SelectionManager.isCollapsed(selection)) return;

			const runPaths = getRunsInRange(editor, selection);
			if (runPaths.length === 0) return;

			// Determine toggle direction: if ALL runs have the property, turn it off
			const doc = editor.getDocument();
			const allHaveProp = runPaths.every((p) => {
				const run = getNodeAtPath(doc, p) as JPRun;
				if (prop === 'underline') {
					return run.properties.underline !== undefined && run.properties.underline !== 'none';
				}
				return run.properties[prop] === true;
			});

			const newValue = !allHaveProp;

			editor.batch(() => {
				for (const runPath of runPaths) {
					const run = getNodeAtPath(editor.getDocument(), runPath) as JPRun;
					const oldVal =
						prop === 'underline'
							? (run.properties.underline ?? 'none')
							: (run.properties[prop] ?? false);
					const newVal = prop === 'underline' ? (newValue ? 'single' : 'none') : newValue;

					editor.apply({
						type: 'set_properties',
						path: runPath,
						properties: { [prop]: newVal },
						oldProperties: { [prop]: oldVal },
					});
				}
			});
		},
	};
}

export const boldCommand = createFormatCommand('format.bold', 'Bold', 'bold', ['Ctrl+B', 'Meta+B']);

export const italicCommand = createFormatCommand('format.italic', 'Italic', 'italic', [
	'Ctrl+I',
	'Meta+I',
]);

export const underlineCommand = createFormatCommand('format.underline', 'Underline', 'underline', [
	'Ctrl+U',
	'Meta+U',
]);

export const FORMAT_COMMANDS = [boldCommand, italicCommand, underlineCommand] as const;
