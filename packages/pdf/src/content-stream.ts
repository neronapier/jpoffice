/**
 * Builds a PDF content stream using PDF operators.
 * Provides a fluent API for text and graphics operations.
 */

import { round } from './unit-utils';

export class ContentStreamBuilder {
	private parts: string[] = [];

	// -- Graphics state --

	/** Save graphics state (q) */
	save(): this {
		this.parts.push('q');
		return this;
	}

	/** Restore graphics state (Q) */
	restore(): this {
		this.parts.push('Q');
		return this;
	}

	/** Set current transformation matrix (cm) */
	setTransform(a: number, b: number, c: number, d: number, e: number, f: number): this {
		this.parts.push(
			`${round(a, 4)} ${round(b, 4)} ${round(c, 4)} ${round(d, 4)} ${round(e)} ${round(f)} cm`,
		);
		return this;
	}

	// -- Text --

	/** Begin text object (BT) */
	beginText(): this {
		this.parts.push('BT');
		return this;
	}

	/** End text object (ET) */
	endText(): this {
		this.parts.push('ET');
		return this;
	}

	/** Set text font and size (Tf) */
	setFont(name: string, size: number): this {
		this.parts.push(`${name} ${round(size)} Tf`);
		return this;
	}

	/** Set text position (Td) */
	setTextPosition(x: number, y: number): this {
		this.parts.push(`${round(x)} ${round(y)} Td`);
		return this;
	}

	/** Show text string (Tj) — string must be already escaped */
	showText(escapedText: string): this {
		this.parts.push(`(${escapedText}) Tj`);
		return this;
	}

	/** Show text as hex string (Tj) — for CID fonts with Identity-H encoding. */
	showTextHex(hexString: string): this {
		this.parts.push(`<${hexString}> Tj`);
		return this;
	}

	// -- Color --

	/** Set fill color RGB (rg) — values 0-1 */
	setFillColor(r: number, g: number, b: number): this {
		this.parts.push(`${round(r, 3)} ${round(g, 3)} ${round(b, 3)} rg`);
		return this;
	}

	/** Set stroke color RGB (RG) — values 0-1 */
	setStrokeColor(r: number, g: number, b: number): this {
		this.parts.push(`${round(r, 3)} ${round(g, 3)} ${round(b, 3)} RG`);
		return this;
	}

	// -- Path construction --

	/** Move to point (m) */
	moveTo(x: number, y: number): this {
		this.parts.push(`${round(x)} ${round(y)} m`);
		return this;
	}

	/** Line to point (l) */
	lineTo(x: number, y: number): this {
		this.parts.push(`${round(x)} ${round(y)} l`);
		return this;
	}

	/** Bezier curve to point (c) — two control points + end point */
	curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
		this.parts.push(
			`${round(x1)} ${round(y1)} ${round(x2)} ${round(y2)} ${round(x3)} ${round(y3)} c`,
		);
		return this;
	}

	/** Rectangle (re) */
	rect(x: number, y: number, w: number, h: number): this {
		this.parts.push(`${round(x)} ${round(y)} ${round(w)} ${round(h)} re`);
		return this;
	}

	/** Close subpath (h) */
	closePath(): this {
		this.parts.push('h');
		return this;
	}

	// -- Path painting --

	/** Stroke path (S) */
	stroke(): this {
		this.parts.push('S');
		return this;
	}

	/** Fill path (f) */
	fill(): this {
		this.parts.push('f');
		return this;
	}

	/** Fill and stroke path (B) */
	fillAndStroke(): this {
		this.parts.push('B');
		return this;
	}

	// -- Line attributes --

	/** Set line width (w) */
	setLineWidth(w: number): this {
		this.parts.push(`${round(w)} w`);
		return this;
	}

	/** Set line dash pattern (d) */
	setDash(dashArray: readonly number[], phase: number): this {
		const arr = dashArray.map((v) => round(v)).join(' ');
		this.parts.push(`[${arr}] ${round(phase)} d`);
		return this;
	}

	// -- XObjects (images) --

	/** Draw XObject (Do) */
	drawXObject(name: string): this {
		this.parts.push(`${name} Do`);
		return this;
	}

	// -- Marked content (Tagged PDF) --

	/**
	 * Begin a marked content sequence with a tag and MCID (BDC).
	 * Used for Tagged PDF accessibility: wraps content with structure info.
	 * Outputs: /Tag <</MCID N>> BDC
	 */
	beginMarkedContent(tag: string, mcid: number): this {
		this.parts.push(`/${tag} <</MCID ${mcid}>> BDC`);
		return this;
	}

	/**
	 * End a marked content sequence (EMC).
	 * Must be paired with a preceding beginMarkedContent().
	 */
	endMarkedContent(): this {
		this.parts.push('EMC');
		return this;
	}

	/** Build the content stream as a string. */
	build(): string {
		return this.parts.join('\n');
	}
}
