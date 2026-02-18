/**
 * Low-level RTF document builder.
 * Builds the RTF header, font table, color table, and assembles the final document.
 */

export class RtfWriter {
	private fonts: Map<string, number> = new Map();
	private colors: string[] = []; // hex colors (without '#')
	private bodyContent = '';
	private info = '';

	/** Register a font and get its index. Returns existing index if already registered. */
	addFont(fontFamily: string): number {
		const existing = this.fonts.get(fontFamily);
		if (existing !== undefined) return existing;
		const idx = this.fonts.size;
		this.fonts.set(fontFamily, idx);
		return idx;
	}

	/** Get font index, registering if needed. */
	getFontIndex(fontFamily: string): number {
		return this.addFont(fontFamily);
	}

	/** Register a color and get its 1-based index (0 = auto/default in RTF color table). */
	addColor(hex: string): number {
		// Normalize: remove '#' if present
		const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
		const existing = this.colors.indexOf(normalized);
		if (existing >= 0) return existing + 1; // 1-based
		this.colors.push(normalized);
		return this.colors.length; // 1-based
	}

	/** Append body content (RTF commands and text). */
	appendBody(content: string): void {
		this.bodyContent += content;
	}

	/** Set document info (title, author, etc.). */
	setInfo(info: string): void {
		this.info = info;
	}

	/** Build the complete RTF string. */
	build(): string {
		let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0';

		// Font table
		rtf += '{\\fonttbl';
		for (const [name, idx] of this.fonts) {
			rtf += `{\\f${idx}\\fnil ${name};}`;
		}
		if (this.fonts.size === 0) {
			rtf += '{\\f0\\fnil Calibri;}';
		}
		rtf += '}';

		// Color table
		rtf += '{\\colortbl ;';
		for (const hex of this.colors) {
			const { r, g, b } = parseHexColor(hex);
			rtf += `\\red${r}\\green${g}\\blue${b};`;
		}
		rtf += '}';

		// Info
		if (this.info) {
			rtf += `{\\info${this.info}}`;
		}

		// Body
		rtf += this.bodyContent;

		rtf += '}';
		return rtf;
	}
}

/** Parse hex color string to RGB components. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
	const h = hex.startsWith('#') ? hex.slice(1) : hex;
	if (h.length === 3) {
		return {
			r: Number.parseInt(h[0] + h[0], 16),
			g: Number.parseInt(h[1] + h[1], 16),
			b: Number.parseInt(h[2] + h[2], 16),
		};
	}
	return {
		r: Number.parseInt(h.slice(0, 2), 16),
		g: Number.parseInt(h.slice(2, 4), 16),
		b: Number.parseInt(h.slice(4, 6), 16),
	};
}

/** Escape special RTF characters in text. */
export function escapeRtf(text: string): string {
	let result = '';
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		if (ch === 0x5c) {
			// backslash
			result += '\\\\';
		} else if (ch === 0x7b) {
			// {
			result += '\\{';
		} else if (ch === 0x7d) {
			// }
			result += '\\}';
		} else if (ch > 127) {
			// Unicode: \uN? where ? is the ANSI fallback
			result += `\\u${ch}?`;
		} else {
			result += text[i];
		}
	}
	return result;
}
