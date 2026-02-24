import { describe, expect, it } from 'vitest';
import { createLayoutCache } from '../src/cache';

describe('createLayoutCache', () => {
	it('creates a cache instance', () => {
		const cache = createLayoutCache();
		expect(cache).toBeDefined();
	});

	it('caches block height by reference', () => {
		const cache = createLayoutCache();
		const node = { type: 'paragraph', id: 'p1' };

		cache.setCachedBlockHeight('p1', node, 42);
		expect(cache.getCachedBlockHeight('p1', node)).toBe(42);
	});

	it('returns undefined for uncached block', () => {
		const cache = createLayoutCache();
		const node = { type: 'paragraph', id: 'p1' };
		expect(cache.getCachedBlockHeight('p1', node)).toBeUndefined();
	});

	it('invalidates when node reference changes', () => {
		const cache = createLayoutCache();
		const node1 = { type: 'paragraph', id: 'p1' };
		const node2 = { type: 'paragraph', id: 'p1' }; // same id, different ref

		cache.setCachedBlockHeight('p1', node1, 42);
		expect(cache.getCachedBlockHeight('p1', node2)).toBeUndefined();
	});

	it('caches text width', () => {
		const cache = createLayoutCache();
		cache.setCachedTextWidth('font|Hello', 55.3);
		expect(cache.getCachedTextWidth('font|Hello')).toBe(55.3);
	});

	it('returns undefined for uncached text', () => {
		const cache = createLayoutCache();
		expect(cache.getCachedTextWidth('font|Missing')).toBeUndefined();
	});

	it('clear removes all entries', () => {
		const cache = createLayoutCache();
		const node = { type: 'paragraph', id: 'p1' };
		cache.setCachedBlockHeight('p1', node, 42);
		cache.setCachedTextWidth('key', 10);

		cache.clear();
		expect(cache.getCachedBlockHeight('p1', node)).toBeUndefined();
		expect(cache.getCachedTextWidth('key')).toBeUndefined();
	});
});
