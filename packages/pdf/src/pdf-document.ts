/**
 * PdfDocument orchestrates the PDF generation pipeline.
 * Takes a LayoutResult and produces a complete PDF file.
 *
 * Supports two font modes:
 * 1. Standard 14 (default): No embedding, Latin-only (WinAnsiEncoding)
 * 2. CID embedded fonts: Full Unicode via Identity-H encoding
 *
 * To use embedded fonts, pass a `fonts` map in PdfExportOptions.
 */

import type {
	LayoutBlock,
	LayoutImage,
	LayoutPage,
	LayoutResult,
	LayoutTable,
	LayoutTableCell,
} from '@jpoffice/layout';
import { isLayoutImage, isLayoutParagraph, isLayoutTable } from '@jpoffice/layout';
import type { JPMediaAsset, JPShape } from '@jpoffice/model';
import { writeCidFont } from './cid-font';
import { ContentStreamBuilder } from './content-stream';
import { FontRegistry } from './font-map';
import { subsetFont } from './font-subsetter';
import type { SubsetResult } from './font-subsetter';
import { ImageEmbedder } from './image-embedder';
import { collectLinkAnnotations, writeLinkAnnotations } from './pdf-annotations';
import { collectOutlineEntries, writeOutlines } from './pdf-outlines';
import { McidCounter, writeStructureTree } from './pdf-structure-tree';
import { nodeTypeToTag } from './pdf-tags';
import { PdfWriter } from './pdf-writer';
import { ShapePainter } from './shape-painter';
import { TablePainter } from './table-painter';
import { TextPainter } from './text-painter';
import { pxToPt, round } from './unit-utils';

export interface PdfExportOptions {
	title?: string;
	author?: string;
	subject?: string;
	keywords?: string;
	creator?: string;
	compress?: boolean;
	/**
	 * Enable Tagged PDF for accessibility (PDF/UA compatible structure).
	 * When true, the PDF will include a structure tree with semantic tags
	 * (paragraphs, headings, tables, images) and marked content sequences.
	 * Defaults to false.
	 */
	tagged?: boolean;
	/**
	 * Document language for accessibility (BCP 47 / ISO 639).
	 * Used in the /Lang entry of the PDF catalog.
	 * Defaults to 'en' when tagged is true.
	 */
	lang?: string;
	/**
	 * Custom fonts to embed in the PDF for full Unicode support.
	 * Maps font keys (from buildFontKey) to font file buffers (TTF/OTF).
	 *
	 * Font keys are built as: "family:bold:italic" (lowercase).
	 * Examples:
	 *   - "arial" for Arial Regular
	 *   - "arial:bold" for Arial Bold
	 *   - "arial:italic" for Arial Italic
	 *   - "arial:bold:italic" for Arial Bold Italic
	 *
	 * Use buildFontKey(family, bold, italic) to generate the correct key.
	 *
	 * When a font key is not found, the system falls back to Standard 14 fonts.
	 */
	fonts?: ReadonlyMap<string, Uint8Array>;
}

export class PdfDocument {
	private options: PdfExportOptions;

	constructor(options: PdfExportOptions = {}) {
		this.options = { compress: true, ...options };
	}

	/**
	 * Generate a complete PDF from a LayoutResult.
	 * @param shapes - Optional per-page shapes extracted from the document model.
	 *   Each entry maps a page index to the shapes that should be rendered on that page.
	 *   If a flat array is provided, all shapes are rendered on every page.
	 */
	generate(
		layoutResult: LayoutResult,
		media?: ReadonlyMap<string, JPMediaAsset>,
		shapes?: ReadonlyMap<number, readonly JPShape[]>,
		footnotes?: readonly { number: number; text: string }[],
	): Uint8Array {
		const writer = new PdfWriter(this.options.compress);
		const customFonts = this.options.fonts;
		const customFontKeys = customFonts ? new Set(customFonts.keys()) : undefined;
		const fonts = new FontRegistry(customFontKeys);
		const images = new ImageEmbedder();

		// First pass: render all pages and collect font/image usage.
		// We also collect used characters per CID font for subsetting.
		const usedCharsPerFont = new Map<string, Set<number>>();
		const pageStreamRefs: number[] = [];
		const pageWidths: number[] = [];
		const pageHeights: number[] = [];

		// Temporary glyph mappings (empty for first pass; populated after subsetting)
		let glyphMappings: Map<string, ReadonlyMap<number, number>> = new Map();

		const isTagged = this.options.tagged === true;

		// Create MCID counter for tagged PDF (tracks marked content IDs across all pages)
		const mcidCounter = isTagged ? new McidCounter() : undefined;

		for (let pi = 0; pi < layoutResult.pages.length; pi++) {
			const page = layoutResult.pages[pi];
			const widthPt = round(pxToPt(page.width));
			const heightPt = round(pxToPt(page.height));
			pageWidths.push(widthPt);
			pageHeights.push(heightPt);

			// Collect used characters from this page
			if (customFonts) {
				this.collectUsedChars(page, fonts, usedCharsPerFont);
			}

			const stream = new ContentStreamBuilder();
			const textPainter = new TextPainter(stream, fonts, heightPt, glyphMappings);
			const tablePainter = new TablePainter(stream, heightPt);
			const shapePainter = new ShapePainter(stream, heightPt);

			this.renderPage(page, stream, textPainter, tablePainter, images, media, mcidCounter);
			this.renderShapes(shapePainter, shapes?.get(pi), page);

			// Render footnotes on the last page
			if (footnotes && footnotes.length > 0 && pi === layoutResult.pages.length - 1) {
				this.renderFootnotes(stream, textPainter, footnotes, widthPt, heightPt, page);
			}

			const streamRef = writer.addStream(stream.build());
			pageStreamRefs.push(streamRef);
		}

		// If we have CID fonts, subset them and re-render with glyph mappings
		const subsetResults = new Map<string, SubsetResult>();
		if (customFonts && usedCharsPerFont.size > 0) {
			// Subset each CID font
			for (const [fontKey, usedChars] of usedCharsPerFont) {
				const fontBuffer = customFonts.get(fontKey);
				if (fontBuffer) {
					const subset = subsetFont(fontBuffer, usedChars);
					subsetResults.set(fontKey, subset);
				}
			}

			// Build glyph mappings for text encoding
			glyphMappings = new Map<string, ReadonlyMap<number, number>>();
			for (const [fontKey, subset] of subsetResults) {
				glyphMappings.set(fontKey, subset.glyphMapping);
			}

			// Re-render all pages with correct glyph mappings
			// Reset MCID counter so the second pass matches structure tree order
			const reRenderMcid = isTagged ? new McidCounter() : undefined;
			pageStreamRefs.length = 0;
			for (let pi = 0; pi < layoutResult.pages.length; pi++) {
				const page = layoutResult.pages[pi];
				const heightPt = round(pxToPt(page.height));

				const stream = new ContentStreamBuilder();
				const textPainter = new TextPainter(stream, fonts, heightPt, glyphMappings);
				const tablePainter = new TablePainter(stream, heightPt);
				const shapePainter = new ShapePainter(stream, heightPt);

				this.renderPage(page, stream, textPainter, tablePainter, images, media, reRenderMcid);
				this.renderShapes(shapePainter, shapes?.get(pi), page);

				// Render footnotes on the last page (re-render pass)
				if (footnotes && footnotes.length > 0 && pi === layoutResult.pages.length - 1) {
					const reHeightPt = round(pxToPt(page.height));
					this.renderFootnotes(stream, textPainter, footnotes, round(pxToPt(page.width)), reHeightPt, page);
				}

				const streamRef = writer.addStream(stream.build());
				pageStreamRefs.push(streamRef);
			}
		}

		// Write image XObjects
		const imageRefs = images.writeObjects(writer);

		// Write font objects
		const fontObjRefs = new Map<string, number>();

		// Write Standard 14 fonts
		for (const fontInfo of fonts.getStandard14Fonts()) {
			const ref = writer.addObject(
				`<< /Type /Font /Subtype /Type1 /BaseFont /${fontInfo.baseName} /Encoding /${fontInfo.encoding} >>`,
			);
			fontObjRefs.set(fontInfo.pdfName, ref);
		}

		// Write CID embedded fonts
		for (const fontInfo of fonts.getCidFonts()) {
			if (!fontInfo.fontKey) continue;
			const subset = subsetResults.get(fontInfo.fontKey);
			const fontBuffer = customFonts?.get(fontInfo.fontKey);
			if (!subset || !fontBuffer) continue;

			const cidResult = writeCidFont(
				writer,
				fontInfo.pdfName,
				subset,
				fontBuffer,
				fontInfo.baseName,
			);
			fontObjRefs.set(fontInfo.pdfName, cidResult.fontRef);
		}

		// Build font resource dictionary entries
		const fontEntries = Array.from(fontObjRefs.entries())
			.map(([name, ref]) => `${name} ${ref} 0 R`)
			.join(' ');

		// Build XObject resource dictionary entries
		const xobjEntries = images.hasImages() ? images.getXObjectEntries(imageRefs) : '';

		// Build resource dict
		let resourceDict = `<< /Font << ${fontEntries} >>`;
		if (xobjEntries) {
			resourceDict += ` /XObject << ${xobjEntries} >>`;
		}
		resourceDict += ' >>';

		const resourceRef = writer.addObject(resourceDict);

		// Collect annotations and outlines from layout
		const linkAnnotations = collectLinkAnnotations(layoutResult);
		const outlineEntries = collectOutlineEntries(layoutResult);

		// Write link annotations
		const pageAnnotationRefs = writeLinkAnnotations(writer, linkAnnotations, pageHeights);

		// Reserve Pages object ID so Page objects can reference their parent
		const pagesRef = writer.reserveId();

		// Create Page objects (with optional annotation references and StructParents)
		const pageRefs: number[] = [];
		for (let i = 0; i < layoutResult.pages.length; i++) {
			let pageDict =
				`<< /Type /Page /Parent ${pagesRef} 0 R ` +
				`/MediaBox [0 0 ${pageWidths[i]} ${pageHeights[i]}] ` +
				`/Contents ${pageStreamRefs[i]} 0 R ` +
				`/Resources ${resourceRef} 0 R`;

			// Add StructParents for tagged PDF (page index as structure parent key)
			if (isTagged) {
				pageDict += ` /StructParents ${i}`;
			}

			// Add annotations if any exist for this page
			const annots = pageAnnotationRefs.get(i);
			if (annots && annots.length > 0) {
				const annotRefs = annots.map((r) => `${r} 0 R`).join(' ');
				pageDict += ` /Annots [${annotRefs}]`;
			}
			pageDict += ' >>';

			const pageRef = writer.addObject(pageDict);
			pageRefs.push(pageRef);
		}

		// Now fill in the Pages object with the kids
		const kids = pageRefs.map((r) => `${r} 0 R`).join(' ');
		writer.setObject(pagesRef, `<< /Type /Pages /Kids [${kids}] /Count ${pageRefs.length} >>`);

		// Write document outlines (bookmarks)
		const outlinesRef = writeOutlines(writer, outlineEntries, pageRefs, pageHeights);

		// Write structure tree for tagged PDF
		let structTreeRootRef: number | undefined;
		if (isTagged) {
			const structResult = writeStructureTree(writer, layoutResult, pageRefs);
			structTreeRootRef = structResult.structTreeRootRef;
		}

		// Create Info dictionary
		let infoRef: number | undefined;
		if (this.options.title || this.options.author || this.options.creator) {
			const infoParts: string[] = [];
			if (this.options.title) infoParts.push(`/Title (${this.options.title})`);
			if (this.options.author) infoParts.push(`/Author (${this.options.author})`);
			if (this.options.subject) infoParts.push(`/Subject (${this.options.subject})`);
			if (this.options.keywords) infoParts.push(`/Keywords (${this.options.keywords})`);
			infoParts.push(`/Creator (${this.options.creator ?? 'JPOffice'})`);
			infoParts.push('/Producer (JPOffice PDF Export)');
			infoRef = writer.addObject(`<< ${infoParts.join(' ')} >>`);
		}

		// Create catalog
		let catalogDict = `<< /Type /Catalog /Pages ${pagesRef} 0 R`;
		if (outlinesRef) {
			catalogDict += ` /Outlines ${outlinesRef} 0 R /PageMode /UseOutlines`;
		}

		// Tagged PDF catalog entries
		if (isTagged && structTreeRootRef !== undefined) {
			const lang = this.options.lang ?? 'en';
			catalogDict += ` /StructTreeRoot ${structTreeRootRef} 0 R`;
			catalogDict += ' /MarkInfo << /Marked true >>';
			catalogDict += ` /Lang (${lang})`;
			catalogDict += ' /ViewerPreferences << /DisplayDocTitle true >>';
		}

		catalogDict += ' >>';
		const catalogRef = writer.addObject(catalogDict);

		return writer.generate(catalogRef, infoRef);
	}

	/**
	 * Collect used Unicode codepoints from a page, grouped by font key.
	 * This is used for font subsetting — we only embed glyphs that are actually used.
	 */
	private collectUsedChars(
		page: LayoutPage,
		fonts: FontRegistry,
		usedCharsPerFont: Map<string, Set<number>>,
	): void {
		const collectFromBlocks = (blocks: readonly LayoutBlock[], offsetX: number) => {
			for (const block of blocks) {
				if (isLayoutParagraph(block)) {
					for (const line of block.lines) {
						for (const fragment of line.fragments) {
							if (!fragment.text) continue;
							const fontInfo = fonts.getFont(
								fragment.style.fontFamily,
								fragment.style.bold,
								fragment.style.italic,
							);
							if (!fontInfo.isCidFont || !fontInfo.fontKey) continue;

							let charSet = usedCharsPerFont.get(fontInfo.fontKey);
							if (!charSet) {
								charSet = new Set();
								usedCharsPerFont.set(fontInfo.fontKey, charSet);
							}

							let displayText = fragment.text;
							if (fragment.style.allCaps) {
								displayText = displayText.toUpperCase();
							}

							for (const char of displayText) {
								const cp = char.codePointAt(0);
								if (cp !== undefined) {
									charSet.add(cp);
								}
							}
						}
					}
				} else if (isLayoutTable(block)) {
					for (const row of block.rows) {
						for (const cell of row.cells) {
							collectFromBlocks(cell.blocks, offsetX);
						}
					}
				}
			}
		};

		// Collect from header
		if (page.header) {
			collectFromBlocks(page.header.blocks, page.contentArea.x);
		}

		// Collect from main blocks
		collectFromBlocks(page.blocks, page.contentArea.x);

		// Collect from footer
		if (page.footer) {
			collectFromBlocks(page.footer.blocks, page.contentArea.x);
		}
	}

	private renderPage(
		page: LayoutPage,
		stream: ContentStreamBuilder,
		textPainter: TextPainter,
		tablePainter: TablePainter,
		images: ImageEmbedder,
		media?: ReadonlyMap<string, JPMediaAsset>,
		mcidCounter?: McidCounter,
	): void {
		const heightPt = round(pxToPt(page.height));

		// Block positions (block.rect.x/y) already include contentArea offset
		// (margin), so main blocks use offset 0. Header/footer blocks are
		// positioned relative to contentArea, so they need the margin offset.

		// Render header if present
		if (page.header) {
			for (const block of page.header.blocks) {
				this.renderBlock(
					block,
					stream,
					textPainter,
					tablePainter,
					page.contentArea.x,
					page.header.rect.y,
					images,
					media,
					heightPt,
					mcidCounter,
				);
			}
		}

		// Render main blocks
		for (const block of page.blocks) {
			this.renderBlock(
				block,
				stream,
				textPainter,
				tablePainter,
				0,
				0,
				images,
				media,
				heightPt,
				mcidCounter,
			);
		}

		// Render footer if present
		if (page.footer) {
			for (const block of page.footer.blocks) {
				this.renderBlock(
					block,
					stream,
					textPainter,
					tablePainter,
					page.contentArea.x,
					page.footer.rect.y,
					images,
					media,
					heightPt,
					mcidCounter,
				);
			}
		}
	}

	private renderBlock(
		block: LayoutBlock,
		stream: ContentStreamBuilder,
		textPainter: TextPainter,
		tablePainter: TablePainter,
		contentX: number,
		contentY: number,
		images: ImageEmbedder,
		media?: ReadonlyMap<string, JPMediaAsset>,
		pageHeightPt?: number,
		mcidCounter?: McidCounter,
	): void {
		if (isLayoutParagraph(block)) {
			// Wrap paragraph with marked content for tagged PDF
			if (mcidCounter) {
				const tag = nodeTypeToTag('paragraph', block.outlineLevel);
				stream.beginMarkedContent(tag, mcidCounter.next());
			}
			for (const line of block.lines) {
				textPainter.paintLine(line, contentX + block.rect.x, contentY + block.rect.y);
			}
			if (mcidCounter) {
				stream.endMarkedContent();
			}
		} else if (isLayoutTable(block)) {
			this.renderTable(block, stream, textPainter, tablePainter, contentX, contentY, mcidCounter);
		} else if (isLayoutImage(block)) {
			// Wrap image with marked content for tagged PDF
			if (mcidCounter) {
				stream.beginMarkedContent('Figure', mcidCounter.next());
			}
			this.renderImage(block, stream, images, media, contentX, contentY, pageHeightPt ?? 842);
			if (mcidCounter) {
				stream.endMarkedContent();
			}
		}
	}

	private renderImage(
		image: LayoutImage,
		stream: ContentStreamBuilder,
		images: ImageEmbedder,
		media: ReadonlyMap<string, JPMediaAsset> | undefined,
		contentX: number,
		contentY: number,
		pageHeightPt: number,
	): void {
		if (!media) return;

		const asset = media.get(image.src);
		if (!asset) return;

		const mimeType = image.mimeType ?? asset.contentType;
		const widthPt = round(pxToPt(image.rect.width));
		const heightPt = round(pxToPt(image.rect.height));
		const xPt = round(pxToPt(contentX + image.rect.x));
		const yPt = round(pageHeightPt - pxToPt(contentY + image.rect.y) - heightPt);

		const xobjName = images.addImage(image.src, asset.data, widthPt, heightPt, mimeType);

		// Draw the image using cm (transformation matrix) + Do operator
		stream.save();
		stream.setTransform(widthPt, 0, 0, heightPt, xPt, yPt);
		stream.drawXObject(xobjName);
		stream.restore();
	}

	private renderTable(
		table: LayoutTable,
		stream: ContentStreamBuilder,
		textPainter: TextPainter,
		tablePainter: TablePainter,
		contentX: number,
		contentY: number,
		mcidCounter?: McidCounter,
	): void {
		// Wrap table with marked content for tagged PDF
		if (mcidCounter) {
			stream.beginMarkedContent('Table', mcidCounter.next());
		}

		// Paint cell backgrounds and borders
		tablePainter.paintTableCells(table, contentX, contentY);
		tablePainter.paintTableBorder(table, contentX, contentY);

		// Paint cell content (with per-row and per-cell MCIDs for tagged PDF)
		for (const row of table.rows) {
			if (mcidCounter) {
				stream.beginMarkedContent('TR', mcidCounter.next());
			}
			for (const cell of row.cells) {
				this.renderCellContent(
					cell,
					stream,
					textPainter,
					contentX,
					contentY,
					row.isHeader,
					mcidCounter,
				);
			}
			if (mcidCounter) {
				stream.endMarkedContent();
			}
		}

		if (mcidCounter) {
			stream.endMarkedContent();
		}
	}

	private renderCellContent(
		cell: LayoutTableCell,
		stream: ContentStreamBuilder,
		textPainter: TextPainter,
		contentX: number,
		contentY: number,
		isHeader: boolean,
		mcidCounter?: McidCounter,
	): void {
		// Wrap cell with marked content for tagged PDF
		const cellTag = isHeader ? 'TH' : 'TD';
		if (mcidCounter) {
			stream.beginMarkedContent(cellTag, mcidCounter.next());
		}

		for (const block of cell.blocks) {
			if (isLayoutParagraph(block)) {
				// Wrap nested paragraph with marked content
				if (mcidCounter) {
					const tag = nodeTypeToTag('paragraph', block.outlineLevel);
					stream.beginMarkedContent(tag, mcidCounter.next());
				}
				for (const line of block.lines) {
					textPainter.paintLine(line, contentX + cell.contentRect.x, contentY + cell.contentRect.y);
				}
				if (mcidCounter) {
					stream.endMarkedContent();
				}
			}
		}

		if (mcidCounter) {
			stream.endMarkedContent();
		}
	}

	/**
	 * Render footnotes at the bottom of a page.
	 * Draws a thin separator line (0.5pt, 1/3 page width) followed by
	 * footnote text with superscript numbers at a smaller font size (8pt).
	 */
	private renderFootnotes(
		stream: ContentStreamBuilder,
		_textPainter: TextPainter,
		footnotes: readonly { number: number; text: string }[],
		pageWidthPt: number,
		_pageHeightPt: number,
		_page: LayoutPage,
	): void {
		if (footnotes.length === 0) return;

		const footnoteFontSize = 8;
		const lineHeight = footnoteFontSize * 1.4;
		const marginLeft = pxToPt(72); // ~1 inch left margin in points
		const marginBottom = pxToPt(72); // ~1 inch bottom margin in points

		// Calculate starting Y: place footnotes above the bottom margin
		const totalFootnoteHeight = footnotes.length * lineHeight + 10; // 10pt for separator gap
		const separatorY = marginBottom + totalFootnoteHeight;

		// Draw separator line: 0.5pt thick, 1/3 page width
		const separatorWidth = pageWidthPt / 3;
		stream
			.save()
			.setStrokeColor(0, 0, 0)
			.setLineWidth(0.5)
			.moveTo(round(marginLeft), round(separatorY))
			.lineTo(round(marginLeft + separatorWidth), round(separatorY))
			.stroke()
			.restore();

		// Render each footnote below the separator
		let currentY = separatorY - 8; // 8pt gap below separator

		for (const footnote of footnotes) {
			const noteNumStr = `${footnote.number}`;
			const noteText = ` ${footnote.text}`;

			// Render superscript number
			stream
				.beginText()
				.setFont('/F1', round(footnoteFontSize * 0.7))
				.setFillColor(0, 0, 0)
				.setTextPosition(round(marginLeft), round(currentY + 2))
				.showText(noteNumStr)
				.endText();

			// Measure the width of the superscript number approximately
			const numWidth = noteNumStr.length * footnoteFontSize * 0.35;

			// Render footnote text
			stream
				.beginText()
				.setFont('/F1', round(footnoteFontSize))
				.setFillColor(0, 0, 0)
				.setTextPosition(round(marginLeft + numWidth), round(currentY))
				.showText(noteText)
				.endText();

			currentY -= lineHeight;
		}
	}

	/**
	 * Render shapes on a page.
	 * Shapes are absolutely positioned (EMU from page origin)
	 * and painted as vector graphics in the PDF content stream.
	 */
	private renderShapes(
		shapePainter: ShapePainter,
		pageShapes: readonly JPShape[] | undefined,
		_page: LayoutPage,
	): void {
		if (!pageShapes || pageShapes.length === 0) return;

		for (const shape of pageShapes) {
			// Shapes use absolute EMU positioning from page origin.
			// pageX/pageY = 0 because EMU coordinates are already page-absolute.
			shapePainter.paintShape(shape, 0, 0);
		}
	}
}
