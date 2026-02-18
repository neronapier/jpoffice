import { describe, it, expect } from 'vitest';
import {
	comparePaths,
	pathEquals,
	isAncestor,
	isAncestorOrEqual,
	parentPath,
	lastIndex,
	siblingPath,
	childPath,
	commonAncestor,
	transformPathAfterInsert,
	transformPathAfterRemove,
} from '../src/path';

describe('Path utilities', () => {
	describe('comparePaths', () => {
		it('returns 0 for equal paths', () => {
			expect(comparePaths([0, 1, 2], [0, 1, 2])).toBe(0);
			expect(comparePaths([], [])).toBe(0);
		});

		it('returns -1 when a comes before b', () => {
			expect(comparePaths([0, 1], [0, 2])).toBe(-1);
			expect(comparePaths([0], [1])).toBe(-1);
			expect(comparePaths([0, 1], [0, 1, 0])).toBe(-1);
		});

		it('returns 1 when a comes after b', () => {
			expect(comparePaths([0, 2], [0, 1])).toBe(1);
			expect(comparePaths([1], [0])).toBe(1);
			expect(comparePaths([0, 1, 0], [0, 1])).toBe(1);
		});
	});

	describe('pathEquals', () => {
		it('returns true for equal paths', () => {
			expect(pathEquals([0, 1, 2], [0, 1, 2])).toBe(true);
			expect(pathEquals([], [])).toBe(true);
		});

		it('returns false for different paths', () => {
			expect(pathEquals([0, 1], [0, 2])).toBe(false);
			expect(pathEquals([0, 1], [0, 1, 2])).toBe(false);
		});
	});

	describe('isAncestor', () => {
		it('returns true for ancestor paths', () => {
			expect(isAncestor([0], [0, 1])).toBe(true);
			expect(isAncestor([0, 1], [0, 1, 2])).toBe(true);
			expect(isAncestor([], [0])).toBe(true);
		});

		it('returns false for non-ancestor paths', () => {
			expect(isAncestor([0, 1], [0, 1])).toBe(false); // equal, not ancestor
			expect(isAncestor([0, 2], [0, 1, 0])).toBe(false);
			expect(isAncestor([0, 1, 2], [0, 1])).toBe(false);
		});
	});

	describe('isAncestorOrEqual', () => {
		it('returns true for ancestor or equal', () => {
			expect(isAncestorOrEqual([0], [0, 1])).toBe(true);
			expect(isAncestorOrEqual([0, 1], [0, 1])).toBe(true);
		});
	});

	describe('parentPath', () => {
		it('returns parent path', () => {
			expect(parentPath([0, 1, 2])).toEqual([0, 1]);
			expect(parentPath([0])).toEqual([]);
		});
	});

	describe('lastIndex', () => {
		it('returns the last index', () => {
			expect(lastIndex([0, 1, 2])).toBe(2);
			expect(lastIndex([5])).toBe(5);
		});
	});

	describe('siblingPath', () => {
		it('creates a sibling path', () => {
			expect(siblingPath([0, 1, 2], 5)).toEqual([0, 1, 5]);
		});
	});

	describe('childPath', () => {
		it('creates a child path', () => {
			expect(childPath([0, 1], 3)).toEqual([0, 1, 3]);
		});
	});

	describe('commonAncestor', () => {
		it('returns common ancestor', () => {
			expect(commonAncestor([0, 1, 2], [0, 1, 5])).toEqual([0, 1]);
			expect(commonAncestor([0, 1], [0, 1, 2])).toEqual([0, 1]);
			expect(commonAncestor([0], [1])).toEqual([]);
		});
	});

	describe('transformPathAfterInsert', () => {
		it('shifts path after insert at same level', () => {
			// Inserting at [0,1] should shift [0,1] to [0,2]
			expect(transformPathAfterInsert([0, 1], [0, 1])).toEqual([0, 2]);
			expect(transformPathAfterInsert([0, 2], [0, 1])).toEqual([0, 3]);
		});

		it('does not shift path before insert point', () => {
			expect(transformPathAfterInsert([0, 0], [0, 1])).toEqual([0, 0]);
		});
	});

	describe('transformPathAfterRemove', () => {
		it('shifts path after removal at same level', () => {
			expect(transformPathAfterRemove([0, 2], [0, 1])).toEqual([0, 1]);
		});

		it('returns null for removed path', () => {
			expect(transformPathAfterRemove([0, 1], [0, 1])).toBeNull();
		});

		it('does not shift path before removal point', () => {
			expect(transformPathAfterRemove([0, 0], [0, 1])).toEqual([0, 0]);
		});
	});
});
