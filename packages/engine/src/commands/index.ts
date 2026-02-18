export type { JPCommand } from './command';
export { JPCommandRegistry } from './registry';
export { TEXT_COMMANDS } from './text-commands';
export { FORMAT_COMMANDS } from './format-commands';
export { HISTORY_COMMANDS } from './history-commands';
export { SELECTION_COMMANDS } from './selection-commands';

import type { JPEditor } from '../editor';
import type { JPCommand } from './command';
import { FORMAT_COMMANDS } from './format-commands';
import { HISTORY_COMMANDS } from './history-commands';
import { SELECTION_COMMANDS } from './selection-commands';
import { TEXT_COMMANDS } from './text-commands';

/**
 * Register all built-in commands with an editor instance.
 */
export function registerBuiltinCommands(editor: JPEditor): void {
	const allCommands: readonly JPCommand<unknown>[] = [
		...TEXT_COMMANDS,
		...FORMAT_COMMANDS,
		...HISTORY_COMMANDS,
		...SELECTION_COMMANDS,
	] as unknown as JPCommand<unknown>[];

	for (const cmd of allCommands) {
		editor.registerCommand(cmd);
	}
}
