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

	/** Rectangle (re) */
	rect(x: number, y: number, w: number, h: number): this {
		this.parts.push(`${round(x)} ${round(y)} ${round(w)} ${round(h)} re`);
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

	// -- XObjects (images) --

	/** Draw XObject (Do) */
	drawXObject(name: string): this {
		this.parts.push(`${name} Do`);
		return this;
	}

	/** Build the content stream as a string. */
	build(): string {
		return this.parts.join('\n');
	}
}
