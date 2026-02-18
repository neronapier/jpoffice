import type { JPEditor } from '../editor';
import type { JPCommand } from './command';

/**
 * Registry that holds all registered commands.
 */
export class JPCommandRegistry {
	private commands = new Map<string, JPCommand<unknown>>();

	register<TArgs>(command: JPCommand<TArgs>): void {
		this.commands.set(command.id, command as JPCommand<unknown>);
	}

	unregister(commandId: string): void {
		this.commands.delete(commandId);
	}

	get(commandId: string): JPCommand<unknown> | undefined {
		return this.commands.get(commandId);
	}

	has(commandId: string): boolean {
		return this.commands.has(commandId);
	}

	canExecute(commandId: string, editor: JPEditor, args: unknown = undefined): boolean {
		const cmd = this.commands.get(commandId);
		if (!cmd) return false;
		return cmd.canExecute(editor, args);
	}

	execute(commandId: string, editor: JPEditor, args: unknown = undefined): void {
		const cmd = this.commands.get(commandId);
		if (!cmd) {
			throw new Error(`Command not found: ${commandId}`);
		}
		if (!cmd.canExecute(editor, args)) {
			return; // silently skip if cannot execute
		}
		cmd.execute(editor, args);
	}

	/**
	 * Get all registered command ids.
	 */
	getCommandIds(): string[] {
		return [...this.commands.keys()];
	}

	/**
	 * Find commands that match a keyboard shortcut.
	 */
	findByShortcut(shortcut: string): JPCommand<unknown>[] {
		const results: JPCommand<unknown>[] = [];
		for (const cmd of this.commands.values()) {
			if (cmd.shortcuts?.includes(shortcut)) {
				results.push(cmd);
			}
		}
		return results;
	}
}
