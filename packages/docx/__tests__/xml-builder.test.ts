import { describe, expect, it } from 'vitest';
import { XmlBuilder } from '../src/xml/xml-builder';

describe('XmlBuilder', () => {
	it('generates XML declaration', () => {
		const b = new XmlBuilder();
		b.declaration();
		expect(b.build()).toBe('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
	});

	it('generates a self-closing empty element', () => {
		const b = new XmlBuilder();
		b.open('root');
		b.close();
		expect(b.build()).toBe('<root/>');
	});

	it('generates element with text content', () => {
		const b = new XmlBuilder();
		b.open('name');
		b.text('Hello');
		b.close();
		expect(b.build()).toBe('<name>Hello</name>');
	});

	it('generates element with attributes', () => {
		const b = new XmlBuilder();
		b.open('w:sz', { 'w:val': 24 });
		b.close();
		expect(b.build()).toBe('<w:sz w:val="24"/>');
	});

	it('skips undefined and false attributes', () => {
		const b = new XmlBuilder();
		b.open('el', { a: 'yes', b: undefined, c: false });
		b.close();
		expect(b.build()).toBe('<el a="yes"/>');
	});

	it('generates empty (self-closing) element via empty()', () => {
		const b = new XmlBuilder();
		b.empty('w:br', { 'w:type': 'page' });
		expect(b.build()).toBe('<w:br w:type="page"/>');
	});

	it('generates nested elements', () => {
		const b = new XmlBuilder();
		b.open('root');
		b.open('child');
		b.text('value');
		b.close();
		b.close();
		expect(b.build()).toBe('<root><child>value</child></root>');
	});

	it('escapes text content', () => {
		const b = new XmlBuilder();
		b.open('t');
		b.text('a < b & c > d');
		b.close();
		expect(b.build()).toBe('<t>a &lt; b &amp; c &gt; d</t>');
	});

	it('escapes attribute values', () => {
		const b = new XmlBuilder();
		b.empty('el', { val: 'a"b<c>&d' });
		expect(b.build()).toBe('<el val="a&quot;b&lt;c&gt;&amp;d"/>');
	});

	it('handles raw XML injection', () => {
		const b = new XmlBuilder();
		b.open('root');
		b.raw('<pre-built/>');
		b.close();
		expect(b.build()).toBe('<root><pre-built/></root>');
	});

	it('generates a realistic w:r element', () => {
		const b = new XmlBuilder();
		b.open('w:r');
		b.open('w:rPr');
		b.empty('w:b');
		b.empty('w:sz', { 'w:val': 28 });
		b.close(); // w:rPr
		b.open('w:t', { 'xml:space': 'preserve' });
		b.text('Bold text');
		b.close(); // w:t
		b.close(); // w:r

		const xml = b.build();
		expect(xml).toContain('<w:b/>');
		expect(xml).toContain('<w:sz w:val="28"/>');
		expect(xml).toContain('<w:t xml:space="preserve">Bold text</w:t>');
		expect(xml).toMatch(/^<w:r>.*<\/w:r>$/);
	});

	it('declaration + nested structure produces valid XML', () => {
		const b = new XmlBuilder();
		b.declaration();
		b.open('w:document', { 'xmlns:w': 'http://example.com' });
		b.open('w:body');
		b.open('w:p');
		b.close();
		b.close();
		b.close();

		const xml = b.build();
		expect(xml).toMatch(/^<\?xml/);
		expect(xml).toContain('<w:document xmlns:w="http://example.com">');
		expect(xml).toContain('<w:body>');
		expect(xml).toContain('<w:p/>');
		expect(xml).toContain('</w:body>');
		expect(xml).toContain('</w:document>');
	});

	it('handles boolean true attribute as key=key', () => {
		const b = new XmlBuilder();
		b.empty('el', { flag: true });
		expect(b.build()).toBe('<el flag="flag"/>');
	});

	it('mixed empty and content children', () => {
		const b = new XmlBuilder();
		b.open('parent');
		b.empty('a');
		b.open('b');
		b.text('hi');
		b.close();
		b.empty('c');
		b.close();
		expect(b.build()).toBe('<parent><a/><b>hi</b><c/></parent>');
	});
});
