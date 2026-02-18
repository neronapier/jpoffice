/**
 * Unit conversion utilities for PDF export.
 * Layout engine uses pixels (96 DPI), PDF uses points (72 DPI).
 * Canvas Y origin is top-left, PDF Y origin is bottom-left.
 */

/** Convert pixels (96 DPI) to PDF points (72 DPI). */
export function pxToPt(px: number): number {
	return px * 0.75;
}

/** Flip Y coordinate from canvas (top-left origin) to PDF (bottom-left origin). */
export function flipY(canvasY: number, pageHeightPt: number): number {
	return pageHeightPt - canvasY;
}

/** Parse hex color '#RRGGBB' or '#RGB' to normalized [r, g, b] (0-1). */
export function colorToRgb(hex: string): [number, number, number] {
	let r = 0;
	let g = 0;
	let b = 0;

	const h = hex.startsWith('#') ? hex.slice(1) : hex;

	if (h.length === 3) {
		r = Number.parseInt(h[0] + h[0], 16) / 255;
		g = Number.parseInt(h[1] + h[1], 16) / 255;
		b = Number.parseInt(h[2] + h[2], 16) / 255;
	} else if (h.length === 6) {
		r = Number.parseInt(h.slice(0, 2), 16) / 255;
		g = Number.parseInt(h.slice(2, 4), 16) / 255;
		b = Number.parseInt(h.slice(4, 6), 16) / 255;
	}

	return [r, g, b];
}

/** Escape a string for use in a PDF literal string `(text)`. */
export function escapePdfString(str: string): string {
	let result = '';
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		if (ch === 0x5c) {
			// backslash
			result += '\\\\';
		} else if (ch === 0x28) {
			// (
			result += '\\(';
		} else if (ch === 0x29) {
			// )
			result += '\\)';
		} else if (ch > 0x7e || ch < 0x20) {
			// Outside printable ASCII — replace with ?
			result += '?';
		} else {
			result += str[i];
		}
	}
	return result;
}

/** Round a number to N decimal places for compact PDF output. */
export function round(n: number, decimals = 2): number {
	const factor = 10 ** decimals;
	return Math.round(n * factor) / factor;
}
