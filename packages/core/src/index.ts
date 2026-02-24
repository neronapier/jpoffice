// @jpoffice/core - Convenience re-export bundle
// Re-exports all public APIs from the JPOffice package family.

// Model
export * from '@jpoffice/model';

// Engine
export * from '@jpoffice/engine';

// Layout
export * from '@jpoffice/layout';

// Renderer
export * from '@jpoffice/renderer';

// React components and hooks
export * from '@jpoffice/react';

// DOCX import/export
export * from '@jpoffice/docx';

// PDF export
export {
	exportToPdf,
	PdfDocument,
	PdfWriter,
	ContentStreamBuilder,
	FontRegistry,
	buildFontKey,
	ImageEmbedder,
	TextPainter,
	TablePainter,
	pxToPt,
	flipY,
	colorToRgb,
	escapePdfString,
	round,
	collectLinkAnnotations,
	writeLinkAnnotations,
	collectOutlineEntries,
	writeOutlines,
	subsetFont,
	writeCidFont,
	generateToUnicodeCMap,
	nodeTypeToTag,
	writeStructureTree,
	buildBlockMcidMap,
	McidCounter,
} from '@jpoffice/pdf';
export type {
	PdfExportOptions,
	PdfFontInfo,
	GlyphMappings,
	LinkAnnotation,
	OutlineEntry as PdfOutlineEntry,
	SubsetResult,
	PdfFontMetrics,
	CidFontResult,
	PdfStructureTag,
	StructureTreeResult,
} from '@jpoffice/pdf';
