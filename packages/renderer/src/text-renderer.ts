import type { LayoutFragment, LayoutLine, ResolvedRunStyle } from '@jpoffice/layout';

/**
 * Renders text fragments on a Canvas 2D context.
 */
export class TextRenderer {
	/**
	 * Build a CSS font string from resolved run style.
	 */
	static buildFont(style: ResolvedRunStyle): string {
		const parts: string[] = [];
		if (style.italic) parts.push('italic');
		if (style.bold) parts.push('bold');
		parts.push(`${style.fontSize}px`);
		parts.push(`"${style.fontFamily}", sans-serif`);
		return parts.join(' ');
	}

	/**
	 * Render a single line of text fragments.
	 */
	renderLine(
		ctx: CanvasRenderingContext2D,
		line: LayoutLine,
		offsetX: number,
		offsetY: number,
	): void {
		for (const fragment of line.fragments) {
			this.renderFragment(ctx, fragment, line, offsetX, offsetY);
		}
	}

	/**
	 * Render a single text fragment.
	 */
	renderFragment(
		ctx: CanvasRenderingContext2D,
		fragment: LayoutFragment,
		line: LayoutLine,
		offsetX: number,
		offsetY: number,
	): void {
		const { style, text, rect } = fragment;

		const x = offsetX + rect.x;
		const y = offsetY + line.rect.y + line.baseline;

		// Background/highlight
		if (style.backgroundColor || style.highlight) {
			ctx.fillStyle = style.highlight ?? style.backgroundColor!;
			ctx.fillRect(offsetX + rect.x, offsetY + rect.y, rect.width, rect.height);
		}

		// Text rendering
		let displayText = text;
		if (style.allCaps) {
			displayText = displayText.toUpperCase();
		}

		ctx.save();
		ctx.font = TextRenderer.buildFont(style);

		// Revision-aware color: insertions use author color, deletions use red with transparency
		if (style.revision) {
			if (style.revision.type === 'deletion') {
				ctx.fillStyle = '#D32F2F';
				ctx.globalAlpha = 0.6;
			} else {
				ctx.fillStyle = style.revision.color;
			}
		} else {
			ctx.fillStyle = style.color;
		}
		ctx.textBaseline = 'alphabetic';

		// Superscript/subscript offset
		let textY = y;
		if (style.superscript) {
			ctx.font = TextRenderer.buildFont({
				...style,
				fontSize: style.fontSize * 0.65,
			});
			textY -= style.fontSize * 0.35;
		} else if (style.subscript) {
			ctx.font = TextRenderer.buildFont({
				...style,
				fontSize: style.fontSize * 0.65,
			});
			textY += style.fontSize * 0.15;
		}

		// Letter spacing
		if (style.letterSpacing !== 0) {
			this.renderWithLetterSpacing(ctx, displayText, x, textY, style.letterSpacing);
		} else {
			ctx.fillText(displayText, x, textY);
		}

		ctx.restore();

		// Decorations (underline, strikethrough)
		this.renderDecorations(ctx, fragment, offsetX, offsetY + line.rect.y, line.baseline);
	}

	private renderWithLetterSpacing(
		ctx: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
		spacing: number,
	): void {
		let currentX = x;
		for (const char of text) {
			ctx.fillText(char, currentX, y);
			currentX += ctx.measureText(char).width + spacing;
		}
	}

	private renderDecorations(
		ctx: CanvasRenderingContext2D,
		fragment: LayoutFragment,
		offsetX: number,
		lineY: number,
		baseline: number,
	): void {
		const { style, rect } = fragment;
		const x = offsetX + rect.x;
		const lineEnd = x + rect.width;

		ctx.save();
		// Revision-aware decoration color
		if (style.revision?.type === 'deletion') {
			ctx.strokeStyle = '#D32F2F';
		} else if (style.revision) {
			ctx.strokeStyle = style.revision.color;
		} else {
			ctx.strokeStyle = style.color;
		}

		// Revision: insertion → underline, deletion → strikethrough
		const effectiveUnderline = style.revision?.type === 'insertion' ? 'single' : style.underline;
		const effectiveStrikethrough = style.revision?.type === 'deletion' ? true : style.strikethrough;

		// Underline
		if (effectiveUnderline && effectiveUnderline !== 'none') {
			const underlineY = lineY + baseline + 2;
			ctx.lineWidth = effectiveUnderline === 'double' || effectiveUnderline === 'thick' ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(x, underlineY);
			ctx.lineTo(lineEnd, underlineY);
			ctx.stroke();

			if (effectiveUnderline === 'double') {
				ctx.beginPath();
				ctx.moveTo(x, underlineY + 2);
				ctx.lineTo(lineEnd, underlineY + 2);
				ctx.stroke();
			}
		}

		// Strikethrough
		if (effectiveStrikethrough || style.doubleStrikethrough) {
			const strikeY = lineY + baseline - style.fontSize * 0.3;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, strikeY);
			ctx.lineTo(lineEnd, strikeY);
			ctx.stroke();

			if (style.doubleStrikethrough) {
				ctx.beginPath();
				ctx.moveTo(x, strikeY + 2.5);
				ctx.lineTo(lineEnd, strikeY + 2.5);
				ctx.stroke();
			}
		}

		ctx.restore();
	}
}
