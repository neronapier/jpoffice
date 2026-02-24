/** OOXML namespace URIs */
export const NS = {
	/** Word Processing ML */
	w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
	/** Relationships */
	r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	/** Package Relationships */
	pr: 'http://schemas.openxmlformats.org/package/2006/relationships',
	/** Drawing WordprocessingML */
	wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
	/** DrawingML Main */
	a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
	/** DrawingML Picture */
	pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
	/** Markup Compatibility */
	mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
	/** Content Types */
	ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
	/** Core Properties */
	cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
	/** Dublin Core */
	dc: 'http://purl.org/dc/elements/1.1/',
	/** Dublin Core Terms */
	dcterms: 'http://purl.org/dc/terms/',
	/** Word Processing Shape (2010+) */
	wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
	/** Word Processing Drawing (2010+) */
	wp14: 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
	/** Math ML */
	m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
} as const;

/** Relationship type URIs used in .rels files */
export const REL_TYPE = {
	officeDocument:
		'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
	styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
	numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
	image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
	hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
	header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
	footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
	coreProperties:
		'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
	settings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
	comments: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
	footnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
	endnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
} as const;

/** Content types for [Content_Types].xml */
export const CONTENT_TYPE = {
	document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
	styles: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
	numbering: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
	header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
	footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
	settings: 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
	relationships: 'application/vnd.openxmlformats-package.relationships+xml',
	coreProperties: 'application/vnd.openxmlformats-package.core-properties+xml',
	png: 'image/png',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	tiff: 'image/tiff',
	comments: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
	footnotes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
	endnotes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
} as const;
