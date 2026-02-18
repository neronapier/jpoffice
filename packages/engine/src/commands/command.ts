import type { JPEditor } from '../editor';

/**
 * A command is the public API for mutations.
 * Commands validate preconditions, produce operations,
 * and can be composed.
 */
export interface JPCommand<TArgs = void> {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly shortcuts?: readonly string[];

	/**
	 * Return true if this command can execute given current state.
	 */
	canExecute(editor: JPEditor, args: TArgs): boolean;

	/**
	 * Execute the command. Must use editor.apply() to submit operations.
	 */
	execute(editor: JPEditor, args: TArgs): void;
}
