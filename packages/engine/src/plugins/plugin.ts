import type { JPNode, JPOperation, JPPath } from '@jpoffice/model';
import type { JPEditor } from '../editor';

/**
 * Plugin interface. Every feature beyond basic text editing
 * is implemented as a plugin.
 */
export interface JPPlugin {
	readonly id: string;
	readonly name: string;

	/**
	 * Called when the plugin is registered with the editor.
	 * Use this to register commands, keybindings, and schema extensions.
	 */
	initialize(editor: JPEditor): void;

	/**
	 * Called before an operation is applied.
	 * Return modified operations, or empty array to cancel.
	 */
	onBeforeApply?(editor: JPEditor, op: JPOperation): JPOperation[];

	/**
	 * Called after operations are applied (after state change).
	 */
	onAfterApply?(editor: JPEditor, ops: readonly JPOperation[]): void;

	/**
	 * Called during normalization. Return fix operations if needed.
	 */
	normalize?(editor: JPEditor, node: JPNode, path: JPPath): JPOperation[] | null;

	/**
	 * Called when the document is replaced (e.g., loading a new file).
	 * Plugins should reset any internal state that references the old document.
	 */
	reset?(editor: JPEditor): void;

	/**
	 * Cleanup when plugin is removed.
	 */
	destroy?(): void;
}
