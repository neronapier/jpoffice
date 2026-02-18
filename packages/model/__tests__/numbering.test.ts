import { describe, it, expect } from 'vitest';
import {
	EMPTY_NUMBERING_REGISTRY,
	addAbstractNumbering,
	removeAbstractNumbering,
	updateAbstractNumbering,
	addNumberingInstance,
	removeNumberingInstance,
	updateNumberingInstance,
	findAbstractNumbering,
	findNumberingInstance,
	resolveNumberingLevel,
} from '../src/index';
import type { JPAbstractNumbering, JPNumberingInstance, JPNumberingLevel } from '../src/index';

const LEVEL_0: JPNumberingLevel = {
	level: 0,
	format: 'decimal',
	text: '%1.',
	alignment: 'left',
	indent: 720,
	hangingIndent: 360,
	start: 1,
};

const LEVEL_1: JPNumberingLevel = {
	level: 1,
	format: 'lowerLetter',
	text: '%2.',
	alignment: 'left',
	indent: 1440,
	hangingIndent: 360,
};

const ABSTRACT: JPAbstractNumbering = {
	abstractNumId: 1,
	levels: [LEVEL_0, LEVEL_1],
};

const INSTANCE: JPNumberingInstance = {
	numId: 1,
	abstractNumId: 1,
};

describe('NumberingRegistry mutations', () => {
	describe('addAbstractNumbering', () => {
		it('adds to empty registry', () => {
			const reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			expect(reg.abstractNumberings).toHaveLength(1);
			expect(reg.abstractNumberings[0]).toBe(ABSTRACT);
		});

		it('preserves existing entries', () => {
			const reg1 = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			const second: JPAbstractNumbering = { abstractNumId: 2, levels: [LEVEL_0] };
			const reg2 = addAbstractNumbering(reg1, second);
			expect(reg2.abstractNumberings).toHaveLength(2);
		});
	});

	describe('removeAbstractNumbering', () => {
		it('removes by abstractNumId', () => {
			const reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			const removed = removeAbstractNumbering(reg, 1);
			expect(removed.abstractNumberings).toHaveLength(0);
		});

		it('also removes related instances', () => {
			let reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			reg = addNumberingInstance(reg, INSTANCE);
			const removed = removeAbstractNumbering(reg, 1);
			expect(removed.instances).toHaveLength(0);
		});

		it('does nothing when id not found', () => {
			const reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			const result = removeAbstractNumbering(reg, 999);
			expect(result.abstractNumberings).toHaveLength(1);
		});
	});

	describe('updateAbstractNumbering', () => {
		it('replaces existing abstract numbering', () => {
			const reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			const updated: JPAbstractNumbering = { abstractNumId: 1, levels: [LEVEL_0] };
			const result = updateAbstractNumbering(reg, updated);
			expect(result.abstractNumberings[0].levels).toHaveLength(1);
		});
	});

	describe('addNumberingInstance', () => {
		it('adds instance to registry', () => {
			const reg = addNumberingInstance(EMPTY_NUMBERING_REGISTRY, INSTANCE);
			expect(reg.instances).toHaveLength(1);
			expect(reg.instances[0]).toBe(INSTANCE);
		});
	});

	describe('removeNumberingInstance', () => {
		it('removes by numId', () => {
			const reg = addNumberingInstance(EMPTY_NUMBERING_REGISTRY, INSTANCE);
			const removed = removeNumberingInstance(reg, 1);
			expect(removed.instances).toHaveLength(0);
		});
	});

	describe('updateNumberingInstance', () => {
		it('replaces existing instance', () => {
			const reg = addNumberingInstance(EMPTY_NUMBERING_REGISTRY, INSTANCE);
			const updated: JPNumberingInstance = { numId: 1, abstractNumId: 2 };
			const result = updateNumberingInstance(reg, updated);
			expect(result.instances[0].abstractNumId).toBe(2);
		});
	});

	describe('findAbstractNumbering', () => {
		it('finds by abstractNumId', () => {
			const reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			expect(findAbstractNumbering(reg, 1)).toBe(ABSTRACT);
		});

		it('returns undefined when not found', () => {
			expect(findAbstractNumbering(EMPTY_NUMBERING_REGISTRY, 1)).toBeUndefined();
		});
	});

	describe('findNumberingInstance', () => {
		it('finds by numId', () => {
			const reg = addNumberingInstance(EMPTY_NUMBERING_REGISTRY, INSTANCE);
			expect(findNumberingInstance(reg, 1)).toBe(INSTANCE);
		});

		it('returns undefined when not found', () => {
			expect(findNumberingInstance(EMPTY_NUMBERING_REGISTRY, 1)).toBeUndefined();
		});
	});

	describe('resolveNumberingLevel', () => {
		it('resolves level through instance -> abstract', () => {
			let reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			reg = addNumberingInstance(reg, INSTANCE);
			const level = resolveNumberingLevel(reg, 1, 0);
			expect(level).toBe(LEVEL_0);
		});

		it('resolves second level', () => {
			let reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			reg = addNumberingInstance(reg, INSTANCE);
			const level = resolveNumberingLevel(reg, 1, 1);
			expect(level).toBe(LEVEL_1);
		});

		it('returns undefined for missing numId', () => {
			expect(resolveNumberingLevel(EMPTY_NUMBERING_REGISTRY, 999, 0)).toBeUndefined();
		});

		it('returns undefined for missing level', () => {
			let reg = addAbstractNumbering(EMPTY_NUMBERING_REGISTRY, ABSTRACT);
			reg = addNumberingInstance(reg, INSTANCE);
			expect(resolveNumberingLevel(reg, 1, 5)).toBeUndefined();
		});
	});
});
