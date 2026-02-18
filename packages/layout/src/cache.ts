/**
 * Incremental layout cache.
 *
 * Exploits the immutability of @jpoffice/model: if a node's reference
 * hasn't changed (===), its layout result is still valid.
 */

export interface LayoutCache {
	/** Get cached layout height for a block node, if the node reference matches. */
	getCachedBlockHeight(nodeId: string, node: object): number | undefined;

	/** Store a block layout height keyed by node id + reference. */
	setCachedBlockHeight(nodeId: string, node: object, height: number): void;

	/** Get cached text measurement. */
	getCachedTextWidth(key: string): number | undefined;

	/** Store a text measurement. */
	setCachedTextWidth(key: string, width: number): void;

	/** Clear all cached data. */
	clear(): void;

	/** Number of entries in the cache. */
	readonly size: number;
}

interface BlockCacheEntry {
	nodeRef: WeakRef<object>;
	height: number;
}

const MAX_TEXT_CACHE_SIZE = 50_000;

/**
 * Create a new LayoutCache instance.
 */
export function createLayoutCache(): LayoutCache {
	const blockCache = new Map<string, BlockCacheEntry>();
	const textCache = new Map<string, number>();
	let textInsertOrder: string[] = [];

	return {
		getCachedBlockHeight(nodeId: string, node: object): number | undefined {
			const entry = blockCache.get(nodeId);
			if (!entry) return undefined;

			const ref = entry.nodeRef.deref();
			if (ref === node) return entry.height;

			// Reference changed — invalidate
			blockCache.delete(nodeId);
			return undefined;
		},

		setCachedBlockHeight(nodeId: string, node: object, height: number): void {
			blockCache.set(nodeId, {
				nodeRef: new WeakRef(node),
				height,
			});
		},

		getCachedTextWidth(key: string): number | undefined {
			return textCache.get(key);
		},

		setCachedTextWidth(key: string, width: number): void {
			if (!textCache.has(key)) {
				textInsertOrder.push(key);
				// LRU eviction
				if (textInsertOrder.length > MAX_TEXT_CACHE_SIZE) {
					const evictCount = Math.floor(MAX_TEXT_CACHE_SIZE * 0.1);
					const toEvict = textInsertOrder.slice(0, evictCount);
					for (const k of toEvict) {
						textCache.delete(k);
					}
					textInsertOrder = textInsertOrder.slice(evictCount);
				}
			}
			textCache.set(key, width);
		},

		clear(): void {
			blockCache.clear();
			textCache.clear();
			textInsertOrder = [];
		},

		get size(): number {
			return blockCache.size + textCache.size;
		},
	};
}
