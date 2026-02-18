import type { FontMetrics, ResolvedRunStyle, TextMeasurement } from './types';

/**
 * TextMeasurer provides text measurement using Canvas API.
 * It caches measurements for performance.
 *
 * On the server (SSR), it can work with OffscreenCanvas or
 * fall back to estimated metrics.
 */
export class TextMeasurer {
	private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
	private metricsCache = new Map<string, FontMetrics>();
	private widthCache = new Map<string, number>();

	constructor() {
		this.initContext();
	}

	private initContext(): void {
		if (typeof OffscreenCanvas !== 'undefined') {
			const canvas = new OffscreenCanvas(1, 1);
			this.ctx = canvas.getContext('2d');
		} else if (typeof document !== 'undefined') {
			const canvas = document.createElement('canvas');
			this.ctx = canvas.getContext('2d');
		}
		// If neither is available (SSR without OffscreenCanvas), ctx stays null
		// and we'll use estimated metrics
	}

	/**
	 * Build a CSS font string from a resolved style.
	 */
	buildFontString(style: ResolvedRunStyle): string {
		const parts: string[] = [];
		if (style.italic) parts.push('italic');
		if (style.bold) parts.push('bold');
		parts.push(`${style.fontSize}px`);
		parts.push(`"${style.fontFamily}", sans-serif`);
		return parts.join(' ');
	}

	/**
	 * Measure the width of a text string in a given style.
	 */
	measureText(text: string, style: ResolvedRunStyle): TextMeasurement {
		const font = this.buildFontString(style);
		const cacheKey = `${font}|${text}`;

		const cachedWidth = this.widthCache.get(cacheKey);
		if (cachedWidth !== undefined) {
			const metrics = this.getFontMetrics(style);
			return { width: cachedWidth, height: metrics.lineHeight };
		}

		let width: number;

		if (this.ctx) {
			this.ctx.font = font;
			const measured = this.ctx.measureText(text);
			width = measured.width;
		} else {
			// Fallback: estimate width based on character count and font size
			width = estimateTextWidth(text, style);
		}

		if (style.letterSpacing !== 0 && text.length > 1) {
			width += style.letterSpacing * (text.length - 1);
		}

		this.widthCache.set(cacheKey, width);
		const metrics = this.getFontMetrics(style);
		return { width, height: metrics.lineHeight };
	}

	/**
	 * Measure a single word width (no caching, faster for layout).
	 */
	measureWord(word: string, style: ResolvedRunStyle): number {
		return this.measureText(word, style).width;
	}

	/**
	 * Get font metrics (ascent, descent, line height) for a style.
	 */
	getFontMetrics(style: ResolvedRunStyle): FontMetrics {
		const font = this.buildFontString(style);
		const cached = this.metricsCache.get(font);
		if (cached) return cached;

		let ascent: number;
		let descent: number;

		if (this.ctx) {
			this.ctx.font = font;
			const m = this.ctx.measureText('Mg');
			ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? style.fontSize * 0.8;
			descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? style.fontSize * 0.2;
		} else {
			// Fallback estimates
			ascent = style.fontSize * 0.8;
			descent = style.fontSize * 0.2;
		}

		const lineHeight = (ascent + descent) * 1.15; // ~15% leading
		const metrics: FontMetrics = {
			ascent,
			descent,
			lineHeight,
			emSize: style.fontSize,
		};

		this.metricsCache.set(font, metrics);
		return metrics;
	}

	/**
	 * Clear all caches (e.g., after font loading).
	 */
	clearCache(): void {
		this.metricsCache.clear();
		this.widthCache.clear();
	}
}

/**
 * Estimate text width without Canvas.
 * Uses average character width ratios.
 */
function estimateTextWidth(text: string, style: ResolvedRunStyle): number {
	// Average character width is roughly 0.55 * fontSize for proportional fonts
	const avgCharWidth = style.fontSize * 0.55;
	let width = 0;

	for (const char of text) {
		if (char === ' ') {
			width += style.fontSize * 0.27;
		} else if (char === '\t') {
			width += style.fontSize * 2;
		} else if (isNarrowChar(char)) {
			width += avgCharWidth * 0.6;
		} else if (isWideChar(char)) {
			width += avgCharWidth * 1.4;
		} else {
			width += avgCharWidth;
		}
	}

	if (style.bold) width *= 1.05;

	return width;
}

function isNarrowChar(c: string): boolean {
	return 'iIl1|!.,;:\'"'.includes(c);
}

function isWideChar(c: string): boolean {
	return 'mMwWOQ@'.includes(c);
}
