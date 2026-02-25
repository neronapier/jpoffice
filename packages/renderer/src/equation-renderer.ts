/**
 * Renders LaTeX equations to Canvas.
 *
 * Uses a recursive descent parser to convert LaTeX into a tree of MathBox
 * nodes, each of which can measure and draw itself. Results are cached
 * by (latex, fontSize) key for performance.
 */

// ── Symbol map (LaTeX command → Unicode) ───────────────────────────

const SYMBOL_MAP: Record<string, string> = {
	// Greek lowercase
	'\\alpha': '\u03B1',
	'\\beta': '\u03B2',
	'\\gamma': '\u03B3',
	'\\delta': '\u03B4',
	'\\epsilon': '\u03B5',
	'\\zeta': '\u03B6',
	'\\eta': '\u03B7',
	'\\theta': '\u03B8',
	'\\iota': '\u03B9',
	'\\kappa': '\u03BA',
	'\\lambda': '\u03BB',
	'\\mu': '\u03BC',
	'\\nu': '\u03BD',
	'\\xi': '\u03BE',
	'\\pi': '\u03C0',
	'\\rho': '\u03C1',
	'\\sigma': '\u03C3',
	'\\tau': '\u03C4',
	'\\upsilon': '\u03C5',
	'\\phi': '\u03C6',
	'\\chi': '\u03C7',
	'\\psi': '\u03C8',
	'\\omega': '\u03C9',
	// Greek uppercase
	'\\Gamma': '\u0393',
	'\\Delta': '\u0394',
	'\\Theta': '\u0398',
	'\\Lambda': '\u039B',
	'\\Xi': '\u039E',
	'\\Pi': '\u03A0',
	'\\Sigma': '\u03A3',
	'\\Phi': '\u03A6',
	'\\Psi': '\u03A8',
	'\\Omega': '\u03A9',
	// Operators
	'\\pm': '\u00B1',
	'\\times': '\u00D7',
	'\\div': '\u00F7',
	'\\cdot': '\u22C5',
	'\\neq': '\u2260',
	'\\leq': '\u2264',
	'\\geq': '\u2265',
	'\\approx': '\u2248',
	'\\infty': '\u221E',
	'\\sum': '\u2211',
	'\\prod': '\u220F',
	'\\int': '\u222B',
	// Relations & logic
	'\\in': '\u2208',
	'\\notin': '\u2209',
	'\\subset': '\u2282',
	'\\subseteq': '\u2286',
	'\\cup': '\u222A',
	'\\cap': '\u2229',
	'\\emptyset': '\u2205',
	'\\forall': '\u2200',
	'\\exists': '\u2203',
	'\\neg': '\u00AC',
	'\\land': '\u2227',
	'\\lor': '\u2228',
	// Arrows
	'\\rightarrow': '\u2192',
	'\\leftarrow': '\u2190',
	'\\Rightarrow': '\u21D2',
	'\\Leftarrow': '\u21D0',
	'\\leftrightarrow': '\u2194',
	// Calculus
	'\\partial': '\u2202',
	'\\nabla': '\u2207',
	// Misc
	'\\ldots': '\u2026',
	'\\cdots': '\u22EF',
};

// ── MathBox types ──────────────────────────────────────────────────

interface MathBoxMetrics {
	width: number;
	height: number;
	baseline: number; // distance from top to baseline
}

interface MathBox {
	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics;
	draw(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number): void;
}

/** A simple text symbol or character. */
class TextBox implements MathBox {
	constructor(private text: string) {}

	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics {
		ctx.font = `${fontSize}px "Cambria Math", "STIX Two Math", serif`;
		const m = ctx.measureText(this.text);
		return {
			width: m.width,
			height: fontSize * 1.2,
			baseline: fontSize * 0.85,
		};
	}

	draw(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number): void {
		ctx.font = `${fontSize}px "Cambria Math", "STIX Two Math", serif`;
		ctx.fillText(this.text, x, y);
	}
}

/** A sequence of boxes laid out horizontally. */
class HBox implements MathBox {
	constructor(private children: MathBox[]) {}

	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics {
		let width = 0;
		let maxAscent = 0;
		let maxDescent = 0;
		for (const child of this.children) {
			const m = child.measure(ctx, fontSize);
			width += m.width;
			maxAscent = Math.max(maxAscent, m.baseline);
			maxDescent = Math.max(maxDescent, m.height - m.baseline);
		}
		return { width, height: maxAscent + maxDescent, baseline: maxAscent };
	}

	draw(ctx: CanvasRenderingContext2D, x: number, baselineY: number, fontSize: number): void {
		const metrics = this.measure(ctx, fontSize);
		let cx = x;
		for (const child of this.children) {
			const m = child.measure(ctx, fontSize);
			// Align to common baseline
			const childBaselineY = baselineY + (metrics.baseline - m.baseline);
			child.draw(ctx, cx, childBaselineY, fontSize);
			cx += m.width;
		}
	}
}

/** Fraction: numerator over denominator with a line. */
class FractionBox implements MathBox {
	constructor(
		private num: MathBox,
		private den: MathBox,
	) {}

	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics {
		const childSize = fontSize * 0.75;
		const nm = this.num.measure(ctx, childSize);
		const dm = this.den.measure(ctx, childSize);
		const gap = 3;
		const lineThickness = 1;
		const width = Math.max(nm.width, dm.width) + 4;
		const height = nm.height + gap + lineThickness + gap + dm.height;
		return { width, height, baseline: nm.height + gap + lineThickness / 2 };
	}

	draw(ctx: CanvasRenderingContext2D, x: number, baselineY: number, fontSize: number): void {
		const childSize = fontSize * 0.75;
		const nm = this.num.measure(ctx, childSize);
		const dm = this.den.measure(ctx, childSize);
		const metrics = this.measure(ctx, fontSize);
		const gap = 3;
		const lineThickness = 1;

		// Draw numerator (centered above line)
		const numX = x + (metrics.width - nm.width) / 2;
		const numBaselineY = baselineY - gap - lineThickness / 2 - (nm.height - nm.baseline);
		this.num.draw(ctx, numX, numBaselineY, childSize);

		// Draw fraction line
		ctx.save();
		ctx.strokeStyle = ctx.fillStyle as string;
		ctx.lineWidth = lineThickness;
		ctx.beginPath();
		ctx.moveTo(x, baselineY);
		ctx.lineTo(x + metrics.width, baselineY);
		ctx.stroke();
		ctx.restore();

		// Draw denominator (centered below line)
		const denX = x + (metrics.width - dm.width) / 2;
		const denBaselineY = baselineY + gap + lineThickness / 2 + dm.baseline;
		this.den.draw(ctx, denX, denBaselineY, childSize);
	}
}

/** Square root: radical sign + content. */
class SqrtBox implements MathBox {
	constructor(private content: MathBox) {}

	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics {
		const cm = this.content.measure(ctx, fontSize);
		const radicalWidth = fontSize * 0.6;
		return {
			width: radicalWidth + cm.width + 2,
			height: cm.height + 3,
			baseline: cm.baseline + 3,
		};
	}

	draw(ctx: CanvasRenderingContext2D, x: number, baselineY: number, fontSize: number): void {
		const cm = this.content.measure(ctx, fontSize);
		const metrics = this.measure(ctx, fontSize);
		const radicalWidth = fontSize * 0.6;

		ctx.save();
		ctx.strokeStyle = ctx.fillStyle as string;
		ctx.lineWidth = 1;

		// Draw radical symbol
		const top = baselineY - cm.baseline;
		const bottom = baselineY + (cm.height - cm.baseline);
		ctx.beginPath();
		ctx.moveTo(x, baselineY - fontSize * 0.1);
		ctx.lineTo(x + radicalWidth * 0.3, bottom);
		ctx.lineTo(x + radicalWidth * 0.6, top);
		ctx.lineTo(x + metrics.width, top);
		ctx.stroke();
		ctx.restore();

		// Draw content
		this.content.draw(ctx, x + radicalWidth, baselineY, fontSize);
	}
}

/** Superscript/subscript. */
class SuperSubBox implements MathBox {
	constructor(
		private base: MathBox,
		private sup?: MathBox,
		private sub?: MathBox,
	) {}

	measure(ctx: CanvasRenderingContext2D, fontSize: number): MathBoxMetrics {
		const bm = this.base.measure(ctx, fontSize);
		const scriptSize = fontSize * 0.65;
		let scriptWidth = 0;
		let extraHeight = 0;
		if (this.sup) {
			const sm = this.sup.measure(ctx, scriptSize);
			scriptWidth = Math.max(scriptWidth, sm.width);
			extraHeight += sm.height * 0.3;
		}
		if (this.sub) {
			const sm = this.sub.measure(ctx, scriptSize);
			scriptWidth = Math.max(scriptWidth, sm.width);
			extraHeight += sm.height * 0.3;
		}
		return {
			width: bm.width + scriptWidth,
			height: bm.height + extraHeight,
			baseline: bm.baseline + (this.sup ? fontSize * 0.2 : 0),
		};
	}

	draw(ctx: CanvasRenderingContext2D, x: number, baselineY: number, fontSize: number): void {
		const bm = this.base.measure(ctx, fontSize);
		const scriptSize = fontSize * 0.65;

		this.base.draw(ctx, x, baselineY, fontSize);

		if (this.sup) {
			const supY = baselineY - fontSize * 0.35;
			this.sup.draw(ctx, x + bm.width, supY, scriptSize);
		}
		if (this.sub) {
			const subY = baselineY + fontSize * 0.15;
			this.sub.draw(ctx, x + bm.width, subY, scriptSize);
		}
	}
}

// ── LaTeX Parser ───────────────────────────────────────────────────

function parseLatex(latex: string): MathBox {
	const tokens = tokenize(latex);
	const boxes = parseTokens(tokens, 0, tokens.length);
	return boxes.length === 1 ? boxes[0] : new HBox(boxes);
}

function tokenize(latex: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	while (i < latex.length) {
		if (latex[i] === '\\') {
			// Command: \word or \char
			let j = i + 1;
			if (j < latex.length && /[a-zA-Z]/.test(latex[j])) {
				while (j < latex.length && /[a-zA-Z]/.test(latex[j])) j++;
				tokens.push(latex.slice(i, j));
			} else if (j < latex.length) {
				tokens.push(latex.slice(i, j + 1));
				j++;
			}
			i = j;
		} else if (latex[i] === '{' || latex[i] === '}' || latex[i] === '^' || latex[i] === '_') {
			tokens.push(latex[i]);
			i++;
		} else if (latex[i] === ' ') {
			i++; // skip spaces
		} else {
			tokens.push(latex[i]);
			i++;
		}
	}
	return tokens;
}

function parseTokens(tokens: string[], start: number, end: number): MathBox[] {
	const boxes: MathBox[] = [];
	let i = start;

	while (i < end) {
		const tok = tokens[i];

		if (tok === '{') {
			// Find matching brace
			const closeIdx = findMatchingBrace(tokens, i);
			const inner = parseTokens(tokens, i + 1, closeIdx);
			boxes.push(inner.length === 1 ? inner[0] : new HBox(inner));
			i = closeIdx + 1;
		} else if (tok === '\\frac') {
			// \frac{num}{den}
			i++;
			const [numBox, nextI] = parseGroup(tokens, i, end);
			const [denBox, nextI2] = parseGroup(tokens, nextI, end);
			boxes.push(new FractionBox(numBox, denBox));
			i = nextI2;
		} else if (tok === '\\sqrt') {
			i++;
			const [contentBox, nextI] = parseGroup(tokens, i, end);
			boxes.push(new SqrtBox(contentBox));
			i = nextI;
		} else if (tok === '^' || tok === '_') {
			// Super/subscript: attach to previous box
			const base = boxes.length > 0 ? boxes.pop()! : new TextBox('');
			i++;
			const [scriptBox, nextI] = parseGroup(tokens, i, end);

			// Check if there's also the other script
			let otherScriptBox: MathBox | undefined;
			if (
				nextI < end &&
				(tokens[nextI] === '^' || tokens[nextI] === '_') &&
				tokens[nextI] !== tok
			) {
				const [other, nextI2] = parseGroup(tokens, nextI + 1, end);
				otherScriptBox = other;
				i = nextI2;
			} else {
				i = nextI;
			}

			if (tok === '^') {
				boxes.push(new SuperSubBox(base, scriptBox, otherScriptBox));
			} else {
				boxes.push(new SuperSubBox(base, otherScriptBox, scriptBox));
			}
		} else if (tok in SYMBOL_MAP) {
			boxes.push(new TextBox(SYMBOL_MAP[tok]));
			i++;
		} else if (tok.startsWith('\\')) {
			// Unknown command: render as text
			boxes.push(new TextBox(tok.slice(1)));
			i++;
		} else {
			boxes.push(new TextBox(tok));
			i++;
		}
	}

	return boxes;
}

function parseGroup(tokens: string[], i: number, end: number): [MathBox, number] {
	if (i >= end) return [new TextBox(''), i];

	if (tokens[i] === '{') {
		const closeIdx = findMatchingBrace(tokens, i);
		const inner = parseTokens(tokens, i + 1, closeIdx);
		const box = inner.length === 1 ? inner[0] : new HBox(inner);
		return [box, closeIdx + 1];
	}
	// Single token
	const box = tokens[i] in SYMBOL_MAP ? new TextBox(SYMBOL_MAP[tokens[i]]) : new TextBox(tokens[i]);
	return [box, i + 1];
}

function findMatchingBrace(tokens: string[], openIdx: number): number {
	let depth = 1;
	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i] === '{') depth++;
		if (tokens[i] === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return tokens.length - 1; // fallback
}

// ── Cache ──────────────────────────────────────────────────────────

interface CachedEquation {
	box: MathBox;
	metrics: MathBoxMetrics;
}

// ── Public API ─────────────────────────────────────────────────────

export class EquationRenderer {
	private cache = new Map<string, CachedEquation>();

	private getCacheKey(latex: string, fontSize: number): string {
		return `${fontSize}:${latex}`;
	}

	/**
	 * Measure an equation without drawing it.
	 */
	measure(
		ctx: CanvasRenderingContext2D,
		latex: string,
		fontSize: number,
	): { width: number; height: number; baseline: number } {
		const key = this.getCacheKey(latex, fontSize);
		let cached = this.cache.get(key);
		if (!cached) {
			const box = parseLatex(latex);
			const metrics = box.measure(ctx, fontSize);
			cached = { box, metrics };
			this.cache.set(key, cached);
		}
		return cached.metrics;
	}

	/**
	 * Render an equation at (x, baselineY).
	 */
	render(
		ctx: CanvasRenderingContext2D,
		latex: string,
		fontSize: number,
		x: number,
		baselineY: number,
	): void {
		const key = this.getCacheKey(latex, fontSize);
		let cached = this.cache.get(key);
		if (!cached) {
			const box = parseLatex(latex);
			const metrics = box.measure(ctx, fontSize);
			cached = { box, metrics };
			this.cache.set(key, cached);
		}
		cached.box.draw(ctx, x, baselineY, fontSize);
	}

	/**
	 * Clear the rendering cache.
	 */
	clearCache(): void {
		this.cache.clear();
	}
}
