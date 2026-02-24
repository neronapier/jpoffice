/**
 * Converts JPShape nodes into PDF content stream operations.
 * Mirrors the Canvas ShapeRenderer but outputs PDF operators
 * (moveTo, lineTo, curveTo, rect, fill, stroke, etc.).
 *
 * Shapes are positioned using EMU coordinates from the model,
 * converted to pixels then to PDF points. PDF Y-axis is flipped
 * (origin bottom-left) using flipY().
 */

import type { JPShape, JPShapeFill, JPShapeStroke, JPShapeType } from '@jpoffice/model';
import { emuToPx } from '@jpoffice/model';
import type { ContentStreamBuilder } from './content-stream';
import { colorToRgb, escapePdfString, flipY, pxToPt, round } from './unit-utils';

export class ShapePainter {
	constructor(
		private stream: ContentStreamBuilder,
		private pageHeightPt: number,
	) {}

	/**
	 * Paint a shape into the PDF content stream.
	 * pageX/pageY are additional pixel offsets (e.g. content area origin).
	 */
	paintShape(shape: JPShape, pageX: number, pageY: number): void {
		const x = pageX + emuToPx(shape.x);
		const y = pageY + emuToPx(shape.y);
		const w = emuToPx(shape.width);
		const h = emuToPx(shape.height);

		this.stream.save();

		// Handle rotation around center
		if (shape.rotation) {
			const cxPt = pxToPt(x + w / 2);
			const cyPt = flipY(pxToPt(y + h / 2), this.pageHeightPt);
			const rad = (-shape.rotation * Math.PI) / 180;
			const cos = Math.cos(rad);
			const sin = Math.sin(rad);
			// Translate to center, rotate, translate back
			this.stream.setTransform(1, 0, 0, 1, cxPt, cyPt);
			this.stream.setTransform(cos, sin, -sin, cos, 0, 0);
			this.stream.setTransform(1, 0, 0, 1, -cxPt, -cyPt);
		}

		// Set fill color
		this.applyFillColor(shape.fill);

		// Set stroke style
		this.applyStrokeStyle(shape.stroke);

		// Convert to PDF coordinate space
		const pxPt = pxToPt(x);
		const pyPt = flipY(pxToPt(y + h), this.pageHeightPt);
		const wPt = pxToPt(w);
		const hPt = pxToPt(h);

		// Build path and paint
		this.buildPath(shape.shapeType, pxPt, pyPt, wPt, hPt);

		// Determine fill/stroke mode
		const hasFill = !shape.fill || shape.fill.type !== 'none';
		const hasStroke = shape.stroke !== undefined || !shape.stroke;
		if (hasFill && hasStroke) {
			this.stream.fillAndStroke();
		} else if (hasFill) {
			this.stream.fill();
		} else if (hasStroke) {
			this.stream.stroke();
		}

		// Draw text centered in the shape if present
		if (shape.text) {
			this.paintShapeText(shape.text, pxPt, pyPt, wPt, hPt);
		}

		this.stream.restore();
	}

	// -- Fill & Stroke setup --

	private applyFillColor(fill?: JPShapeFill): void {
		if (!fill || fill.type === 'none') {
			// Default light blue (#d0e2ff)
			this.stream.setFillColor(0.816, 0.886, 1);
			return;
		}
		if (fill.type === 'solid' && fill.color) {
			const [r, g, b] = colorToRgb(fill.color);
			this.stream.setFillColor(r, g, b);
		} else if (fill.type === 'gradient' && fill.gradientStops && fill.gradientStops.length > 0) {
			// PDF does not natively support gradient fills in a simple way;
			// approximate with the first stop color.
			const [r, g, b] = colorToRgb(fill.gradientStops[0].color);
			this.stream.setFillColor(r, g, b);
		} else {
			// Default light blue
			this.stream.setFillColor(0.816, 0.886, 1);
		}
	}

	private applyStrokeStyle(stroke?: JPShapeStroke): void {
		if (!stroke) {
			// Default stroke: #4a86c8, 1px
			this.stream.setStrokeColor(0.29, 0.525, 0.784);
			this.stream.setLineWidth(0.75);
			return;
		}

		const [r, g, b] = colorToRgb(stroke.color);
		this.stream.setStrokeColor(r, g, b);
		const widthPt = pxToPt(emuToPx(stroke.width));
		this.stream.setLineWidth(round(widthPt));

		// Dash patterns
		if (stroke.dashStyle && stroke.dashStyle !== 'solid') {
			const lw = Math.max(widthPt, 0.5);
			switch (stroke.dashStyle) {
				case 'dash':
					this.stream.setDash([lw * 4, lw * 2], 0);
					break;
				case 'dot':
					this.stream.setDash([lw, lw * 2], 0);
					break;
				case 'dashDot':
					this.stream.setDash([lw * 4, lw * 2, lw, lw * 2], 0);
					break;
			}
		}
	}

	// -- Path construction --

	private buildPath(shapeType: JPShapeType, x: number, y: number, w: number, h: number): void {
		switch (shapeType) {
			case 'rectangle':
				this.stream.rect(round(x), round(y), round(w), round(h));
				break;
			case 'rounded-rectangle': {
				const r = Math.min(w, h) * 0.1;
				this.roundedRect(x, y, w, h, r);
				break;
			}
			case 'ellipse':
				this.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
				break;
			case 'triangle':
				this.polygon([
					[x + w / 2, y + h],
					[x + w, y],
					[x, y],
				]);
				break;
			case 'diamond':
				this.polygon([
					[x + w / 2, y + h],
					[x + w, y + h / 2],
					[x + w / 2, y],
					[x, y + h / 2],
				]);
				break;
			case 'pentagon':
				this.regularPolygon(x, y, w, h, 5, -Math.PI / 2);
				break;
			case 'hexagon':
				this.regularPolygon(x, y, w, h, 6, 0);
				break;
			case 'star':
				this.star(x, y, w, h, 5);
				break;
			case 'arrow-right':
				this.arrowRight(x, y, w, h);
				break;
			case 'arrow-left':
				this.arrowLeft(x, y, w, h);
				break;
			case 'arrow-up':
				this.arrowUp(x, y, w, h);
				break;
			case 'arrow-down':
				this.arrowDown(x, y, w, h);
				break;
			case 'line':
				this.stream.moveTo(round(x), round(y + h / 2));
				this.stream.lineTo(round(x + w), round(y + h / 2));
				break;
			case 'curved-line':
				// Quadratic Bezier approximated as cubic: Q(x0,y0, cp, x1,y1) ->
				// C(x0+2/3*(cpx-x0), y0+2/3*(cpy-y0), x1+2/3*(cpx-x1), y1+2/3*(cpy-y1), x1, y1)
				this.curvedLine(x, y, w, h);
				break;
			case 'connector':
				this.stream.moveTo(round(x), round(y + h / 2));
				this.stream.lineTo(round(x + w / 2), round(y + h / 2));
				this.stream.lineTo(round(x + w / 2), round(y + h));
				this.stream.lineTo(round(x + w), round(y + h));
				break;
			case 'callout':
				this.callout(x, y, w, h);
				break;
			case 'cloud':
				this.cloud(x, y, w, h);
				break;
			case 'heart':
				this.heart(x, y, w, h);
				break;
			default:
				// Fallback to rectangle
				this.stream.rect(round(x), round(y), round(w), round(h));
		}
	}

	// -- Shape path helpers --

	private ellipse(cx: number, cy: number, rx: number, ry: number): void {
		// Approximate ellipse with 4 cubic Bezier curves
		const k = 0.5522848; // magic number for circle approximation
		const kx = rx * k;
		const ky = ry * k;

		this.stream.moveTo(round(cx - rx), round(cy));
		this.stream.curveTo(
			round(cx - rx),
			round(cy + ky),
			round(cx - kx),
			round(cy + ry),
			round(cx),
			round(cy + ry),
		);
		this.stream.curveTo(
			round(cx + kx),
			round(cy + ry),
			round(cx + rx),
			round(cy + ky),
			round(cx + rx),
			round(cy),
		);
		this.stream.curveTo(
			round(cx + rx),
			round(cy - ky),
			round(cx + kx),
			round(cy - ry),
			round(cx),
			round(cy - ry),
		);
		this.stream.curveTo(
			round(cx - kx),
			round(cy - ry),
			round(cx - rx),
			round(cy - ky),
			round(cx - rx),
			round(cy),
		);
	}

	private roundedRect(x: number, y: number, w: number, h: number, r: number): void {
		const radius = Math.min(r, w / 2, h / 2);
		const k = 0.5522848 * radius;

		this.stream.moveTo(round(x + radius), round(y));
		this.stream.lineTo(round(x + w - radius), round(y));
		this.stream.curveTo(
			round(x + w - radius + k),
			round(y),
			round(x + w),
			round(y + radius - k),
			round(x + w),
			round(y + radius),
		);
		this.stream.lineTo(round(x + w), round(y + h - radius));
		this.stream.curveTo(
			round(x + w),
			round(y + h - radius + k),
			round(x + w - radius + k),
			round(y + h),
			round(x + w - radius),
			round(y + h),
		);
		this.stream.lineTo(round(x + radius), round(y + h));
		this.stream.curveTo(
			round(x + radius - k),
			round(y + h),
			round(x),
			round(y + h - radius + k),
			round(x),
			round(y + h - radius),
		);
		this.stream.lineTo(round(x), round(y + radius));
		this.stream.curveTo(
			round(x),
			round(y + radius - k),
			round(x + radius - k),
			round(y),
			round(x + radius),
			round(y),
		);
		this.stream.closePath();
	}

	private polygon(points: readonly [number, number][]): void {
		if (points.length < 2) return;
		this.stream.moveTo(round(points[0][0]), round(points[0][1]));
		for (let i = 1; i < points.length; i++) {
			this.stream.lineTo(round(points[i][0]), round(points[i][1]));
		}
		this.stream.closePath();
	}

	private regularPolygon(
		x: number,
		y: number,
		w: number,
		h: number,
		sides: number,
		startAngle: number,
	): void {
		const cx = x + w / 2;
		const cy = y + h / 2;
		const rx = w / 2;
		const ry = h / 2;
		const angleStep = (Math.PI * 2) / sides;

		for (let i = 0; i < sides; i++) {
			const angle = startAngle + i * angleStep;
			const px = cx + rx * Math.cos(angle);
			const py = cy + ry * Math.sin(angle);
			if (i === 0) {
				this.stream.moveTo(round(px), round(py));
			} else {
				this.stream.lineTo(round(px), round(py));
			}
		}
		this.stream.closePath();
	}

	private star(x: number, y: number, w: number, h: number, points: number): void {
		const cx = x + w / 2;
		const cy = y + h / 2;
		const outerRx = w / 2;
		const outerRy = h / 2;
		const innerRx = outerRx * 0.4;
		const innerRy = outerRy * 0.4;
		const angleStep = Math.PI / points;
		const startAngle = -Math.PI / 2;

		for (let i = 0; i < points * 2; i++) {
			const angle = startAngle + i * angleStep;
			const isOuter = i % 2 === 0;
			const rx = isOuter ? outerRx : innerRx;
			const ry = isOuter ? outerRy : innerRy;
			const px = cx + rx * Math.cos(angle);
			const py = cy + ry * Math.sin(angle);
			if (i === 0) {
				this.stream.moveTo(round(px), round(py));
			} else {
				this.stream.lineTo(round(px), round(py));
			}
		}
		this.stream.closePath();
	}

	private arrowRight(x: number, y: number, w: number, h: number): void {
		const shaftW = w * 0.6;
		const shaftH = h * 0.4;
		const sy = y + (h - shaftH) / 2;
		this.polygon([
			[x, sy],
			[x + shaftW, sy],
			[x + shaftW, y],
			[x + w, y + h / 2],
			[x + shaftW, y + h],
			[x + shaftW, sy + shaftH],
			[x, sy + shaftH],
		]);
	}

	private arrowLeft(x: number, y: number, w: number, h: number): void {
		const headW = w * 0.4;
		const shaftH = h * 0.4;
		const sy = y + (h - shaftH) / 2;
		this.polygon([
			[x, y + h / 2],
			[x + headW, y],
			[x + headW, sy],
			[x + w, sy],
			[x + w, sy + shaftH],
			[x + headW, sy + shaftH],
			[x + headW, y + h],
		]);
	}

	private arrowUp(x: number, y: number, w: number, h: number): void {
		const headH = h * 0.4;
		const shaftW = w * 0.4;
		const sx = x + (w - shaftW) / 2;
		this.polygon([
			[x + w / 2, y + h],
			[x + w, y + h - headH],
			[sx + shaftW, y + h - headH],
			[sx + shaftW, y],
			[sx, y],
			[sx, y + h - headH],
			[x, y + h - headH],
		]);
	}

	private arrowDown(x: number, y: number, w: number, h: number): void {
		const headH = h * 0.4;
		const shaftW = w * 0.4;
		const sx = x + (w - shaftW) / 2;
		const headTop = y + headH;
		this.polygon([
			[sx, y + h],
			[sx + shaftW, y + h],
			[sx + shaftW, headTop],
			[x + w, headTop],
			[x + w / 2, y],
			[x, headTop],
			[sx, headTop],
		]);
	}

	private curvedLine(x: number, y: number, w: number, h: number): void {
		// Quadratic bezier approximated as cubic bezier
		// Q(P0, CP, P1) -> C(P0, P0+2/3*(CP-P0), P1+2/3*(CP-P1), P1)
		const x0 = x;
		const y0 = y;
		const cpx = x + w / 2;
		const cpy = y + h;
		const x1 = x + w;
		const y1 = y;

		this.stream.moveTo(round(x0), round(y0));
		this.stream.curveTo(
			round(x0 + (2 / 3) * (cpx - x0)),
			round(y0 + (2 / 3) * (cpy - y0)),
			round(x1 + (2 / 3) * (cpx - x1)),
			round(y1 + (2 / 3) * (cpy - y1)),
			round(x1),
			round(y1),
		);
	}

	private callout(x: number, y: number, w: number, h: number): void {
		const bubbleH = h * 0.75;
		const r = Math.min(w, bubbleH) * 0.1;
		const radius = Math.min(r, w / 2, bubbleH / 2);
		const k = 0.5522848 * radius;
		const tailW = w * 0.15;
		const tailStartX = x + w * 0.2;

		// Rounded rectangle bubble with tail (PDF Y is bottom-up, but we're already in PDF space)
		this.stream.moveTo(round(x + radius), round(y + h));
		this.stream.lineTo(round(x + w - radius), round(y + h));
		this.stream.curveTo(
			round(x + w - radius + k),
			round(y + h),
			round(x + w),
			round(y + h - radius + k),
			round(x + w),
			round(y + h - radius),
		);
		this.stream.lineTo(round(x + w), round(y + h - bubbleH + radius));
		this.stream.curveTo(
			round(x + w),
			round(y + h - bubbleH + radius - k),
			round(x + w - radius + k),
			round(y + h - bubbleH),
			round(x + w - radius),
			round(y + h - bubbleH),
		);
		this.stream.lineTo(round(tailStartX + tailW), round(y + h - bubbleH));
		this.stream.lineTo(round(tailStartX), round(y)); // tail tip
		this.stream.lineTo(round(tailStartX), round(y + h - bubbleH));
		this.stream.lineTo(round(x + radius), round(y + h - bubbleH));
		this.stream.curveTo(
			round(x + radius - k),
			round(y + h - bubbleH),
			round(x),
			round(y + h - bubbleH + radius - k),
			round(x),
			round(y + h - bubbleH + radius),
		);
		this.stream.lineTo(round(x), round(y + h - radius));
		this.stream.curveTo(
			round(x),
			round(y + h - radius + k),
			round(x + radius - k),
			round(y + h),
			round(x + radius),
			round(y + h),
		);
		this.stream.closePath();
	}

	private cloud(x: number, y: number, w: number, h: number): void {
		const cx = x + w / 2;
		const cy = y + h / 2;

		// Approximate cloud with overlapping ellipses
		const bumps: [number, number, number, number][] = [
			[cx - w * 0.25, cy + h * 0.1, w * 0.28, h * 0.28],
			[cx, cy - h * 0.15, w * 0.3, h * 0.3],
			[cx + w * 0.22, cy + h * 0.05, w * 0.25, h * 0.25],
			[cx + w * 0.1, cy + h * 0.25, w * 0.22, h * 0.2],
			[cx - w * 0.15, cy + h * 0.25, w * 0.24, h * 0.2],
			[cx - w * 0.35, cy + h * 0.15, w * 0.2, h * 0.18],
			[cx - w * 0.35, cy - h * 0.05, w * 0.22, h * 0.22],
			[cx - w * 0.15, cy - h * 0.2, w * 0.25, h * 0.22],
			[cx + w * 0.15, cy - h * 0.18, w * 0.22, h * 0.22],
			[cx + w * 0.32, cy - h * 0.05, w * 0.2, h * 0.2],
		];

		for (const [bx, by, bw, bh] of bumps) {
			this.ellipse(bx, by, bw, bh);
		}
	}

	private heart(x: number, y: number, w: number, h: number): void {
		const topY = y + h * 0.7; // PDF Y is flipped, top of heart is higher Y
		const bottomY = y;
		const cx = x + w / 2;

		this.stream.moveTo(round(cx), round(topY - h * 0.1));
		// Left lobe
		this.stream.curveTo(
			round(cx - w * 0.02),
			round(topY + h * 0.05),
			round(x),
			round(y + h),
			round(x),
			round(topY),
		);
		this.stream.curveTo(
			round(x),
			round(topY - h * 0.2),
			round(cx),
			round(topY - h * 0.35),
			round(cx),
			round(bottomY),
		);
		// Right lobe
		this.stream.moveTo(round(cx), round(topY - h * 0.1));
		this.stream.curveTo(
			round(cx + w * 0.02),
			round(topY + h * 0.05),
			round(x + w),
			round(y + h),
			round(x + w),
			round(topY),
		);
		this.stream.curveTo(
			round(x + w),
			round(topY - h * 0.2),
			round(cx),
			round(topY - h * 0.35),
			round(cx),
			round(bottomY),
		);
		this.stream.closePath();
	}

	// -- Text inside shapes --

	private paintShapeText(text: string, x: number, y: number, w: number, h: number): void {
		const fontSize = Math.max(6, Math.min(w, h) * 0.12);
		// Estimate text width roughly (0.5 * fontSize per char for Helvetica)
		const textWidth = text.length * fontSize * 0.5;
		const tx = x + (w - textWidth) / 2;
		const ty = y + h / 2 - fontSize / 3;

		this.stream
			.beginText()
			.setFont('/F1', round(fontSize))
			.setFillColor(0, 0, 0)
			.setTextPosition(round(tx), round(ty))
			.showText(escapePdfString(text))
			.endText();
	}
}
