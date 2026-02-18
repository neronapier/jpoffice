import { describe, it, expect } from 'vitest';
import {
	createStyleRegistry,
	findStyle,
	findDefaultStyle,
	resolveStyleParagraphProperties,
	resolveStyleRunProperties,
	DEFAULT_STYLES,
	STYLE_NORMAL,
	STYLE_HEADING1,
} from '../src';

describe('Style Registry', () => {
	const registry = createStyleRegistry(DEFAULT_STYLES);

	describe('findStyle', () => {
		it('finds Normal style', () => {
			const style = findStyle(registry, 'Normal');
			expect(style).toBeDefined();
			expect(style!.name).toBe('Normal');
		});

		it('finds Heading1 style', () => {
			const style = findStyle(registry, 'Heading1');
			expect(style).toBeDefined();
			expect(style!.name).toBe('Heading 1');
		});

		it('returns undefined for unknown style', () => {
			expect(findStyle(registry, 'NonExistent')).toBeUndefined();
		});
	});

	describe('findDefaultStyle', () => {
		it('finds default paragraph style', () => {
			const style = findDefaultStyle(registry, 'paragraph');
			expect(style).toBeDefined();
			expect(style!.id).toBe('Normal');
		});

		it('finds default table style', () => {
			const style = findDefaultStyle(registry, 'table');
			expect(style).toBeDefined();
			expect(style!.id).toBe('TableNormal');
		});
	});

	describe('resolveStyleParagraphProperties', () => {
		it('resolves Normal properties directly', () => {
			const props = resolveStyleParagraphProperties(registry, 'Normal');
			expect(props.spacing?.after).toBe(160);
			expect(props.spacing?.line).toBe(259);
		});

		it('resolves Heading1 with Normal as base', () => {
			const props = resolveStyleParagraphProperties(registry, 'Heading1');
			// Heading1 overrides spacing
			expect(props.spacing?.before).toBe(240);
			expect(props.spacing?.after).toBe(0);
			// Heading1 adds keepNext
			expect(props.keepNext).toBe(true);
			expect(props.keepLines).toBe(true);
			expect(props.outlineLevel).toBe(0);
		});

		it('resolves ListParagraph with Normal as base', () => {
			const props = resolveStyleParagraphProperties(registry, 'ListParagraph');
			// Inherits Normal spacing
			expect(props.spacing?.after).toBe(160);
			// Has its own indent
			expect(props.indent?.left).toBe(720);
		});
	});

	describe('resolveStyleRunProperties', () => {
		it('resolves Normal run properties', () => {
			const props = resolveStyleRunProperties(registry, 'Normal');
			expect(props.fontFamily).toBe('Calibri');
			expect(props.fontSize).toBe(22);
		});

		it('resolves Heading1 run properties with inheritance', () => {
			const props = resolveStyleRunProperties(registry, 'Heading1');
			// Heading1 overrides font family and size
			expect(props.fontFamily).toBe('Calibri Light');
			expect(props.fontSize).toBe(32);
			expect(props.color).toBe('2F5496');
		});
	});

	describe('circular reference protection', () => {
		it('handles circular basedOn without infinite loop', () => {
			const circular = createStyleRegistry([
				{ ...STYLE_NORMAL, basedOn: 'Heading1' },
				{ ...STYLE_HEADING1, basedOn: 'Normal' },
			]);
			// Should not throw or loop forever
			const props = resolveStyleParagraphProperties(circular, 'Normal');
			expect(props).toBeDefined();
		});
	});
});
