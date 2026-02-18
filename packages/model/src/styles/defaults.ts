import type { JPStyle } from './style';

/**
 * Default built-in styles matching Word's default style set.
 */

export const STYLE_NORMAL: JPStyle = {
	id: 'Normal',
	name: 'Normal',
	type: 'paragraph',
	isDefault: true,
	paragraphProperties: {
		spacing: { after: 160, line: 259, lineRule: 'auto' },
	},
	runProperties: {
		fontFamily: 'Calibri',
		fontSize: 22, // 11pt in half-points
	},
};

export const STYLE_HEADING1: JPStyle = {
	id: 'Heading1',
	name: 'Heading 1',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 240, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 0,
	},
	runProperties: {
		fontFamily: 'Calibri Light',
		fontSize: 32, // 16pt
		color: '2F5496',
	},
};

export const STYLE_HEADING2: JPStyle = {
	id: 'Heading2',
	name: 'Heading 2',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 40, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 1,
	},
	runProperties: {
		fontFamily: 'Calibri Light',
		fontSize: 26, // 13pt
		color: '2F5496',
	},
};

export const STYLE_HEADING3: JPStyle = {
	id: 'Heading3',
	name: 'Heading 3',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 40, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 2,
	},
	runProperties: {
		fontFamily: 'Calibri Light',
		fontSize: 24, // 12pt
		color: '1F3763',
	},
};

export const STYLE_HEADING4: JPStyle = {
	id: 'Heading4',
	name: 'Heading 4',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 40, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 3,
	},
	runProperties: {
		italic: true,
		color: '2F5496',
	},
};

export const STYLE_HEADING5: JPStyle = {
	id: 'Heading5',
	name: 'Heading 5',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 40, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 4,
	},
	runProperties: {
		color: '2F5496',
	},
};

export const STYLE_HEADING6: JPStyle = {
	id: 'Heading6',
	name: 'Heading 6',
	type: 'paragraph',
	basedOn: 'Normal',
	next: 'Normal',
	paragraphProperties: {
		spacing: { before: 40, after: 0 },
		keepNext: true,
		keepLines: true,
		outlineLevel: 5,
	},
	runProperties: {
		color: '1F3763',
		italic: true,
	},
};

export const STYLE_LIST_PARAGRAPH: JPStyle = {
	id: 'ListParagraph',
	name: 'List Paragraph',
	type: 'paragraph',
	basedOn: 'Normal',
	paragraphProperties: {
		indent: { left: 720 }, // 0.5 inch
	},
};

export const STYLE_DEFAULT_TABLE: JPStyle = {
	id: 'TableNormal',
	name: 'Normal Table',
	type: 'table',
	isDefault: true,
	tableProperties: {},
};

export const DEFAULT_STYLES: readonly JPStyle[] = [
	STYLE_NORMAL,
	STYLE_HEADING1,
	STYLE_HEADING2,
	STYLE_HEADING3,
	STYLE_HEADING4,
	STYLE_HEADING5,
	STYLE_HEADING6,
	STYLE_LIST_PARAGRAPH,
	STYLE_DEFAULT_TABLE,
];
