/**
 * Converts LayoutFragment objects into PDF text operators.
 * Mirrors the Canvas TextRenderer but outputs PDF content stream operations.
 *
 * Supports two text encoding modes:
 * - Standard 14 fonts: literal string encoding (ASCII only)
 * - CID embedded fonts: hex string encoding (full Unicode)
 */

import type { LayoutFragment, LayoutLine } from '@jpoffice/layout';
import type { ContentStreamBuilder } from './content-stream';
import type { FontRegistry } from './font-map';
import { colorToRgb, escapePdfString, flipY, pxToPt, round } from './unit-utils';

/**
 * Check if a string contains RTL characters (Arabic/Hebrew Unicode ranges).
 */
function containsRtlChars(text: string): boolean {
	for (let i = 0; i < text.length; i++) {
		const cp = text.codePointAt(i);
		if (cp === undefined) continue;
		// Hebrew: U+0590-U+05FF, Arabic: U+0600-U+06FF, Arabic Supplement: U+0750-U+077F,
		// Arabic Extended: U+08A0-U+08FF
		if (
			(cp >= 0x0590 && cp <= 0x05ff) ||
			(cp >= 0x0600 && cp <= 0x06ff) ||
			(cp >= 0x0700 && cp <= 0x074f) ||
			(cp >= 0x0750 && cp <= 0x077f) ||
			(cp >= 0x0780 && cp <= 0x07bf) ||
			(cp >= 0x07c0 && cp <= 0x07ff) ||
			(cp >= 0x0800 && cp <= 0x083f) ||
			(cp >= 0x08a0 && cp <= 0x08ff)
		) {
			return true;
		}
		if (cp > 0xffff) i++; // skip surrogate pair
	}
	return false;
}

/**
 * Reverse the character order of a string for RTL display.
 * Handles surrogate pairs correctly.
 */
function reverseString(str: string): string {
	const chars = Array.from(str);
	chars.reverse();
	return chars.join('');
}

/** Maps font keys to glyph mappings for CID text encoding. */
export type GlyphMappings = ReadonlyMap<string, ReadonlyMap<number, number>>;

export class TextPainter {
	private glyphMappings: GlyphMappings;

	constructor(
		private stream: ContentStreamBuilder,
		private fonts: FontRegistry,
		private pageHeightPt: number,
		glyphMappings?: GlyphMappings,
	) {
		this.glyphMappings = glyphMappings ?? new Map();
	}

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

	/**
	 * Begin a marked content sequence for accessibility tagging.
	 * Call this before painting a paragraph's lines to wrap them with BDC/EMC.
	 */
	beginMarkedContent(tag: string, mcid: number): void {
		this.stream.beginMarkedContent(tag, mcid);
	}

	/**
	 * End a marked content sequence.
	 * Call this after painting all lines of a paragraph.
	 */
	endMarkedContent(): void {
		this.stream.endMarkedContent();
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

		// RTL text handling: if the text contains RTL characters,
		// reverse character order for correct display in PDF
		const isRtl = containsRtlChars(displayText);
		if (isRtl) {
			displayText = reverseString(displayText);
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

		// For RTL text, adjust x-position to right-align within the fragment's allocated space
		let x: number;
		if (isRtl) {
			// Right-align: position text so it ends at the right edge of the rect
			x = pxToPt(offsetX + rect.x + rect.width) - this.estimateTextWidth(displayText, fontSize);
		} else {
			x = pxToPt(offsetX + rect.x);
		}
		const baselineY = pxToPt(offsetY + line.rect.y + line.baseline);
		const pdfY = flipY(baselineY, this.pageHeightPt) + yAdjust;

		const [r, g, b] = colorToRgb(style.color);

		this.stream
			.beginText()
			.setFont(fontInfo.pdfName, round(fontSize))
			.setFillColor(r, g, b)
			.setTextPosition(round(x), round(pdfY));

		if (fontInfo.isCidFont && fontInfo.fontKey) {
			// CID font: encode as hex string using glyph mapping
			const hexStr = this.encodeTextAsHex(displayText, fontInfo.fontKey);
			this.stream.showTextHex(hexStr);
		} else {
			// Standard 14: use literal string (ASCII)
			this.stream.showText(escapePdfString(displayText));
		}

		this.stream.endText();
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

	/**
	 * Estimate the width of a text string in PDF points.
	 * Uses a rough approximation for Standard 14 fonts (average char width ~0.5 * fontSize).
	 */
	private estimateTextWidth(text: string, fontSize: number): number {
		// Approximate: average character width is ~0.5 of font size for proportional fonts
		return text.length * fontSize * 0.5;
	}

	/**
	 * Encode a text string as hex for CID font output.
	 * Each character's Unicode codepoint is looked up in the glyph mapping
	 * to find the corresponding glyph ID (CID), then encoded as a 4-digit hex value.
	 */
	private encodeTextAsHex(text: string, fontKey: string): string {
		const mapping = this.glyphMappings.get(fontKey);
		let hex = '';

		for (const char of text) {
			const codePoint = char.codePointAt(0) ?? 0;
			// Look up the glyph ID; fall back to 0 (.notdef) if not found
			const glyphId = mapping?.get(codePoint) ?? 0;
			hex += glyphId.toString(16).toUpperCase().padStart(4, '0');
		}

		return hex;
	}
}
