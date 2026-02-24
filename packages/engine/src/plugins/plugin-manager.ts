import type { JPNode, JPOperation, JPPath } from '@jpoffice/model';
import type { JPEditor } from '../editor';
import type { JPPlugin } from './plugin';

/**
 * Manages plugin lifecycle and event dispatch.
 */
export class JPPluginManager {
	private plugins: JPPlugin[] = [];

	register(plugin: JPPlugin, editor: JPEditor): void {
		if (this.plugins.some((p) => p.id === plugin.id)) {
			throw new Error(`Plugin already registered: ${plugin.id}`);
		}
		this.plugins.push(plugin);
		plugin.initialize(editor);
	}

	unregister(pluginId: string): void {
		const idx = this.plugins.findIndex((p) => p.id === pluginId);
		if (idx >= 0) {
			const plugin = this.plugins[idx];
			plugin.destroy?.();
			this.plugins.splice(idx, 1);
		}
	}

	getPlugin(pluginId: string): JPPlugin | undefined {
		return this.plugins.find((p) => p.id === pluginId);
	}

	/**
	 * Run onBeforeApply hooks on all plugins.
	 * Returns the (possibly modified) operations.
	 */
	beforeApply(editor: JPEditor, op: JPOperation): JPOperation[] {
		let ops: JPOperation[] = [op];

		for (const plugin of this.plugins) {
			if (!plugin.onBeforeApply) continue;
			const newOps: JPOperation[] = [];
			for (const o of ops) {
				const result = plugin.onBeforeApply(editor, o);
				newOps.push(...result);
			}
			ops = newOps;
			if (ops.length === 0) break;
		}

		return ops;
	}

	/**
	 * Run onAfterApply hooks on all plugins.
	 */
	afterApply(editor: JPEditor, ops: readonly JPOperation[]): void {
		for (const plugin of this.plugins) {
			plugin.onAfterApply?.(editor, ops);
		}
	}

	/**
	 * Run normalize hooks on all plugins for a given node.
	 */
	normalize(editor: JPEditor, node: JPNode, path: JPPath): JPOperation[] {
		const allOps: JPOperation[] = [];
		for (const plugin of this.plugins) {
			if (!plugin.normalize) continue;
			const ops = plugin.normalize(editor, node, path);
			if (ops) allOps.push(...ops);
		}
		return allOps;
	}

	/**
	 * Reset all plugins' internal state (for document replacement).
	 */
	resetAll(editor: JPEditor): void {
		for (const plugin of this.plugins) {
			plugin.reset?.(editor);
		}
	}

	/**
	 * Destroy all plugins.
	 */
	destroyAll(): void {
		for (const plugin of this.plugins) {
			plugin.destroy?.();
		}
		this.plugins = [];
	}
}
