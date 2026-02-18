/**
 * Converts LayoutFragment objects into PDF text operators.
 * Mirrors the Canvas TextRenderer but outputs PDF content stream operations.
 */

import type { LayoutFragment, LayoutLine } from '@jpoffice/layout';
import type { ContentStreamBuilder } from './content-stream';
import type { FontRegistry } from './font-map';
import { colorToRgb, escapePdfString, flipY, pxToPt, round } from './unit-utils';

export class TextPainter {
	constructor(
		private stream: ContentStreamBuilder,
		private fonts: FontRegistry,
		private pageHeightPt: number,
	) {}

	/** Paint all fragments in a line. */
	paintLine(line: LayoutLine, offsetX: number, offsetY: number): void {
		for (const fragment of line.fragments) {
			this.paintHighlight(fragment, line, offsetX, offsetY);
		}
		for (const fragment of line.fragments) {
			this.paintFragment(fragment, line, offsetX, offsetY);
			this.paintDecorations(fragment, line, offsetX, offsetY);
		}
	}

	/** Paint a single text fragment. */
	paintFragment(
		fragment: LayoutFragment,
		line: LayoutLine,
		offsetX: number,
		offsetY: number,
	): void {
		const { style, text, rect } = fragment;
		if (!text) return;

		let displayText = text;
		if (style.allCaps) {
			displayText = displayText.toUpperCase();
		}

		let fontSize = pxToPt(style.fontSize);
		let yAdjust = 0;

		if (style.superscript) {
			fontSize *= 0.65;
			yAdjust = pxToPt(style.fontSize * 0.35);
		} else if (style.subscript) {
			fontSize *= 0.65;
			yAdjust = -pxToPt(style.fontSize * 0.15);
		}

		const fontInfo = this.fonts.getFont(style.fontFamily, style.bold, style.italic);

		const x = pxToPt(offsetX + rect.x);
		const baselineY = pxToPt(offsetY + line.rect.y + line.baseline);
		const pdfY = flipY(baselineY, this.pageHeightPt) + yAdjust;

		const [r, g, b] = colorToRgb(style.color);

		this.stream
			.beginText()
			.setFont(fontInfo.pdfName, round(fontSize))
			.setFillColor(r, g, b)
			.setTextPosition(round(x), round(pdfY))
			.showText(escapePdfString(displayText))
			.endText();
	}

	/** Paint highlight/background behind a fragment. */
	paintHighlight(
		fragment: LayoutFragment,
		_line: LayoutLine,
		offsetX: number,
		offsetY: number,
	): void {
		const { style, rect } = fragment;
		const bgColor = style.highlight ?? style.backgroundColor;
		if (!bgColor) return;

		const x = pxToPt(offsetX + rect.x);
		const y = pxToPt(offsetY + rect.y);
		const w = pxToPt(rect.width);
		const h = pxToPt(rect.height);
		const pdfY = flipY(y + h, this.pageHeightPt);

		const [r, g, b] = colorToRgb(bgColor);

		this.stream
			.save()
			.setFillColor(r, g, b)
			.rect(round(x), round(pdfY), round(w), round(h))
			.fill()
			.restore();
	}

	/** Paint underline and strikethrough decorations. */
	paintDecorations(
		fragment: LayoutFragment,
		line: LayoutLine,
		offsetX: number,
		offsetY: number,
	): void {
		const { style, rect } = fragment;
		const x = pxToPt(offsetX + rect.x);
		const lineEnd = x + pxToPt(rect.width);
		const baselineCanvasPt = pxToPt(offsetY + line.rect.y + line.baseline);

		const [r, g, b] = colorToRgb(style.color);

		// Underline
		if (style.underline && style.underline !== 'none') {
			const underlineOffset = pxToPt(2);
			const pdfUY = flipY(baselineCanvasPt + underlineOffset, this.pageHeightPt);
			const lineWidth = style.underline === 'double' || style.underline === 'thick' ? 1.5 : 0.75;

			this.stream
				.save()
				.setStrokeColor(r, g, b)
				.setLineWidth(lineWidth)
				.moveTo(round(x), round(pdfUY))
				.lineTo(round(lineEnd), round(pdfUY))
				.stroke();

			if (style.underline === 'double') {
				const pdfUY2 = pdfUY - pxToPt(2);
				this.stream.moveTo(round(x), round(pdfUY2)).lineTo(round(lineEnd), round(pdfUY2)).stroke();
			}

			this.stream.restore();
		}

		// Strikethrough
		if (style.strikethrough || style.doubleStrikethrough) {
			const strikeOffset = pxToPt(style.fontSize * 0.3);
			const pdfSY = flipY(baselineCanvasPt - strikeOffset, this.pageHeightPt);

			this.stream
				.save()
				.setStrokeColor(r, g, b)
				.setLineWidth(0.75)
				.moveTo(round(x), round(pdfSY))
				.lineTo(round(lineEnd), round(pdfSY))
				.stroke();

			if (style.doubleStrikethrough) {
				const pdfSY2 = pdfSY - pxToPt(2.5);
				this.stream.moveTo(round(x), round(pdfSY2)).lineTo(round(lineEnd), round(pdfSY2)).stroke();
			}

			this.stream.restore();
		}
	}
}
