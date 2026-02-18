/**
 * PdfDocument orchestrates the PDF generation pipeline.
 * Takes a LayoutResult and produces a complete PDF file.
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
import type { JPMediaAsset } from '@jpoffice/model';
import { ContentStreamBuilder } from './content-stream';
import { FontRegistry } from './font-map';
import { ImageEmbedder } from './image-embedder';
import { PdfWriter } from './pdf-writer';
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
}

export class PdfDocument {
	private options: PdfExportOptions;

	constructor(options: PdfExportOptions = {}) {
		this.options = { compress: true, ...options };
	}

	/** Generate a complete PDF from a LayoutResult. */
	generate(layoutResult: LayoutResult, media?: ReadonlyMap<string, JPMediaAsset>): Uint8Array {
		const writer = new PdfWriter(this.options.compress);
		const fonts = new FontRegistry();
		const images = new ImageEmbedder();

		// First pass: render all pages and collect font/image usage
		const pageStreamRefs: number[] = [];
		const pageWidths: number[] = [];
		const pageHeights: number[] = [];

		for (const page of layoutResult.pages) {
			const widthPt = round(pxToPt(page.width));
			const heightPt = round(pxToPt(page.height));
			pageWidths.push(widthPt);
			pageHeights.push(heightPt);

			const stream = new ContentStreamBuilder();
			const textPainter = new TextPainter(stream, fonts, heightPt);
			const tablePainter = new TablePainter(stream, heightPt);

			this.renderPage(page, stream, textPainter, tablePainter, images, media);

			const streamRef = writer.addStream(stream.build());
			pageStreamRefs.push(streamRef);
		}

		// Write image XObjects
		const imageRefs = images.writeObjects(writer);

		// Write font objects
		const fontObjRefs = new Map<string, number>();
		for (const [, fontInfo] of fonts.getAllFonts()) {
			const ref = writer.addObject(
				`<< /Type /Font /Subtype /Type1 /BaseFont /${fontInfo.baseName} /Encoding /${fontInfo.encoding} >>`,
			);
			fontObjRefs.set(fontInfo.pdfName, ref);
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

		// Reserve Pages object ID so Page objects can reference their parent
		const pagesRef = writer.reserveId();

		// Create Page objects
		const pageRefs: number[] = [];
		for (let i = 0; i < layoutResult.pages.length; i++) {
			const pageRef = writer.addObject(
				`<< /Type /Page /Parent ${pagesRef} 0 R ` +
					`/MediaBox [0 0 ${pageWidths[i]} ${pageHeights[i]}] ` +
					`/Contents ${pageStreamRefs[i]} 0 R ` +
					`/Resources ${resourceRef} 0 R >>`,
			);
			pageRefs.push(pageRef);
		}

		// Now fill in the Pages object with the kids
		const kids = pageRefs.map((r) => `${r} 0 R`).join(' ');
		writer.setObject(pagesRef, `<< /Type /Pages /Kids [${kids}] /Count ${pageRefs.length} >>`);

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

		const catalogRef = writer.addObject(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

		return writer.generate(catalogRef, infoRef);
	}

	private renderPage(
		page: LayoutPage,
		stream: ContentStreamBuilder,
		textPainter: TextPainter,
		tablePainter: TablePainter,
		images: ImageEmbedder,
		media?: ReadonlyMap<string, JPMediaAsset>,
	): void {
		const contentX = page.contentArea.x;
		const contentY = page.contentArea.y;
		const heightPt = round(pxToPt(page.height));

		// Render header if present
		if (page.header) {
			for (const block of page.header.blocks) {
				this.renderBlock(
					block,
					stream,
					textPainter,
					tablePainter,
					contentX,
					page.header.rect.y,
					images,
					media,
					heightPt,
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
				contentX,
				contentY,
				images,
				media,
				heightPt,
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
					contentX,
					page.footer.rect.y,
					images,
					media,
					heightPt,
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
	): void {
		if (isLayoutParagraph(block)) {
			for (const line of block.lines) {
				textPainter.paintLine(line, contentX + block.rect.x, contentY + block.rect.y);
			}
		} else if (isLayoutTable(block)) {
			this.renderTable(block, stream, textPainter, tablePainter, contentX, contentY);
		} else if (isLayoutImage(block)) {
			this.renderImage(block, stream, images, media, contentX, contentY, pageHeightPt ?? 842);
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
		_stream: ContentStreamBuilder,
		textPainter: TextPainter,
		tablePainter: TablePainter,
		contentX: number,
		contentY: number,
	): void {
		// Paint cell backgrounds and borders
		tablePainter.paintTableCells(table, contentX, contentY);
		tablePainter.paintTableBorder(table, contentX, contentY);

		// Paint cell content
		for (const row of table.rows) {
			for (const cell of row.cells) {
				this.renderCellContent(cell, textPainter, contentX, contentY);
			}
		}
	}

	private renderCellContent(
		cell: LayoutTableCell,
		textPainter: TextPainter,
		contentX: number,
		contentY: number,
	): void {
		for (const block of cell.blocks) {
			if (isLayoutParagraph(block)) {
				for (const line of block.lines) {
					textPainter.paintLine(line, contentX + cell.contentRect.x, contentY + cell.contentRect.y);
				}
			}
		}
	}
}
