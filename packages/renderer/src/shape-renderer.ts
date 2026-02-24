import type { JPShapeFill, JPShapeGroup, JPShapeStroke, JPShapeType } from '@jpoffice/model';
import { emuToPx, isShapeGroup } from '@jpoffice/model';

/**
 * ShapeRenderer draws vector shapes onto a Canvas 2D context.
 * All position and dimension arguments are in pixels.
 */
export class ShapeRenderer {
	/**
	 * Draw a shape at the given position and size.
	 * Coordinates are in pixels, relative to page origin.
	 */
	drawShape(
		ctx: CanvasRenderingContext2D,
		shapeType: JPShapeType,
		x: number,
		y: number,
		width: number,
		height: number,
		fill?: JPShapeFill,
		stroke?: JPShapeStroke,
		rotation?: number,
		text?: string,
	): void {
		ctx.save();

		// Apply rotation around center
		if (rotation) {
			const cx = x + width / 2;
			const cy = y + height / 2;
			ctx.translate(cx, cy);
			ctx.rotate((rotation * Math.PI) / 180);
			ctx.translate(-cx, -cy);
		}

		// Build the path
		ctx.beginPath();
		this.buildShapePath(ctx, shapeType, x, y, width, height);

		// Apply fill
		this.applyFill(ctx, fill, x, y, width, height);

		// Apply stroke
		this.applyStroke(ctx, stroke);

		// Draw text centered in shape
		if (text) {
			this.drawShapeText(ctx, text, x, y, width, height);
		}

		ctx.restore();
	}

	/**
	 * Draw a shape from EMU coordinates, converting to pixels.
	 */
	drawShapeFromEmu(
		ctx: CanvasRenderingContext2D,
		shapeType: JPShapeType,
		xEmu: number,
		yEmu: number,
		widthEmu: number,
		heightEmu: number,
		pageX: number,
		pageY: number,
		fill?: JPShapeFill,
		stroke?: JPShapeStroke,
		rotation?: number,
		text?: string,
	): void {
		const x = pageX + emuToPx(xEmu);
		const y = pageY + emuToPx(yEmu);
		const w = emuToPx(widthEmu);
		const h = emuToPx(heightEmu);
		this.drawShape(ctx, shapeType, x, y, w, h, fill, stroke, rotation, text);
	}

	/**
	 * Draw a group of shapes. Each child shape is rendered with offsets
	 * from the group position.
	 */
	drawShapeGroup(
		ctx: CanvasRenderingContext2D,
		group: JPShapeGroup,
		pageX: number,
		pageY: number,
	): void {
		const groupPxX = pageX + emuToPx(group.x);
		const groupPxY = pageY + emuToPx(group.y);

		for (const child of group.children) {
			// Each child's x/y is relative to page origin in EMU.
			// When grouped, we render with page offsets.
			this.drawShapeFromEmu(
				ctx,
				child.shapeType,
				child.x,
				child.y,
				child.width,
				child.height,
				pageX,
				pageY,
				child.fill,
				child.stroke,
				child.rotation,
				child.text,
			);
		}

		// Suppress unused variable lint
		void groupPxX;
		void groupPxY;
	}

	/**
	 * Draw any shape or shape group node. Dispatches based on type.
	 */
	drawShapeOrGroup(
		ctx: CanvasRenderingContext2D,
		node: unknown,
		pageX: number,
		pageY: number,
	): void {
		if (isShapeGroup(node)) {
			this.drawShapeGroup(ctx, node, pageX, pageY);
		}
	}

	// ── Path builders ──────────────────────────────────────────

	private buildShapePath(
		ctx: CanvasRenderingContext2D,
		shapeType: JPShapeType,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		switch (shapeType) {
			case 'rectangle':
				ctx.rect(x, y, w, h);
				break;
			case 'rounded-rectangle':
				this.roundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.1);
				break;
			case 'ellipse':
				ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
				break;
			case 'triangle':
				this.polygon(ctx, [
					[x + w / 2, y],
					[x + w, y + h],
					[x, y + h],
				]);
				break;
			case 'diamond':
				this.polygon(ctx, [
					[x + w / 2, y],
					[x + w, y + h / 2],
					[x + w / 2, y + h],
					[x, y + h / 2],
				]);
				break;
			case 'pentagon':
				this.regularPolygon(ctx, x, y, w, h, 5, -Math.PI / 2);
				break;
			case 'hexagon':
				this.regularPolygon(ctx, x, y, w, h, 6, 0);
				break;
			case 'star':
				this.star(ctx, x, y, w, h, 5);
				break;
			case 'arrow-right':
				this.arrowRight(ctx, x, y, w, h);
				break;
			case 'arrow-left':
				this.arrowLeft(ctx, x, y, w, h);
				break;
			case 'arrow-up':
				this.arrowUp(ctx, x, y, w, h);
				break;
			case 'arrow-down':
				this.arrowDown(ctx, x, y, w, h);
				break;
			case 'line':
				ctx.moveTo(x, y + h / 2);
				ctx.lineTo(x + w, y + h / 2);
				break;
			case 'curved-line':
				ctx.moveTo(x, y + h);
				ctx.quadraticCurveTo(x + w / 2, y, x + w, y + h);
				break;
			case 'connector':
				ctx.moveTo(x, y + h / 2);
				ctx.lineTo(x + w / 2, y + h / 2);
				ctx.lineTo(x + w / 2, y);
				ctx.lineTo(x + w, y);
				break;
			case 'callout':
				this.callout(ctx, x, y, w, h);
				break;
			case 'cloud':
				this.cloud(ctx, x, y, w, h);
				break;
			case 'heart':
				this.heart(ctx, x, y, w, h);
				break;
		}
	}

	private roundedRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number,
	): void {
		const radius = Math.min(r, w / 2, h / 2);
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + w - radius, y);
		ctx.arcTo(x + w, y, x + w, y + radius, radius);
		ctx.lineTo(x + w, y + h - radius);
		ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
		ctx.lineTo(x + radius, y + h);
		ctx.arcTo(x, y + h, x, y + h - radius, radius);
		ctx.lineTo(x, y + radius);
		ctx.arcTo(x, y, x + radius, y, radius);
		ctx.closePath();
	}

	private polygon(ctx: CanvasRenderingContext2D, points: readonly [number, number][]): void {
		if (points.length < 2) return;
		ctx.moveTo(points[0][0], points[0][1]);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i][0], points[i][1]);
		}
		ctx.closePath();
	}

	private regularPolygon(
		ctx: CanvasRenderingContext2D,
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
				ctx.moveTo(px, py);
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.closePath();
	}

	private star(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		points: number,
	): void {
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
				ctx.moveTo(px, py);
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.closePath();
	}

	private arrowRight(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		const shaftW = w * 0.6;
		const shaftH = h * 0.4;
		const sy = y + (h - shaftH) / 2;
		this.polygon(ctx, [
			[x, sy],
			[x + shaftW, sy],
			[x + shaftW, y],
			[x + w, y + h / 2],
			[x + shaftW, y + h],
			[x + shaftW, sy + shaftH],
			[x, sy + shaftH],
		]);
	}

	private arrowLeft(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		const headW = w * 0.4;
		const shaftH = h * 0.4;
		const sy = y + (h - shaftH) / 2;
		this.polygon(ctx, [
			[x, y + h / 2],
			[x + headW, y],
			[x + headW, sy],
			[x + w, sy],
			[x + w, sy + shaftH],
			[x + headW, sy + shaftH],
			[x + headW, y + h],
		]);
	}

	private arrowUp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
		const headH = h * 0.4;
		const shaftW = w * 0.4;
		const sx = x + (w - shaftW) / 2;
		this.polygon(ctx, [
			[x + w / 2, y],
			[x + w, y + headH],
			[sx + shaftW, y + headH],
			[sx + shaftW, y + h],
			[sx, y + h],
			[sx, y + headH],
			[x, y + headH],
		]);
	}

	private arrowDown(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		const headH = h * 0.4;
		const shaftW = w * 0.4;
		const sx = x + (w - shaftW) / 2;
		const headTop = y + h - headH;
		this.polygon(ctx, [
			[sx, y],
			[sx + shaftW, y],
			[sx + shaftW, headTop],
			[x + w, headTop],
			[x + w / 2, y + h],
			[x, headTop],
			[sx, headTop],
		]);
	}

	private callout(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
		const bubbleH = h * 0.75;
		const r = Math.min(w, bubbleH) * 0.1;
		const tailW = w * 0.15;
		const tailStartX = x + w * 0.2;

		// Rounded rectangle bubble with tail
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.arcTo(x + w, y, x + w, y + r, r);
		ctx.lineTo(x + w, y + bubbleH - r);
		ctx.arcTo(x + w, y + bubbleH, x + w - r, y + bubbleH, r);
		ctx.lineTo(tailStartX + tailW, y + bubbleH);
		ctx.lineTo(tailStartX, y + h); // tail tip
		ctx.lineTo(tailStartX, y + bubbleH);
		ctx.lineTo(x + r, y + bubbleH);
		ctx.arcTo(x, y + bubbleH, x, y + bubbleH - r, r);
		ctx.lineTo(x, y + r);
		ctx.arcTo(x, y, x + r, y, r);
		ctx.closePath();
	}

	private cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
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
			ctx.moveTo(bx + bw, by);
			ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
		}
	}

	private heart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
		const topY = y + h * 0.3;
		const bottomY = y + h;
		const cx = x + w / 2;

		ctx.moveTo(cx, topY + h * 0.1);
		// Left lobe
		ctx.bezierCurveTo(cx - w * 0.02, topY - h * 0.05, x, y, x, topY);
		ctx.bezierCurveTo(x, topY + h * 0.2, cx, topY + h * 0.35, cx, bottomY);
		// Right lobe
		ctx.moveTo(cx, topY + h * 0.1);
		ctx.bezierCurveTo(cx + w * 0.02, topY - h * 0.05, x + w, y, x + w, topY);
		ctx.bezierCurveTo(x + w, topY + h * 0.2, cx, topY + h * 0.35, cx, bottomY);
		ctx.closePath();
	}

	// ── Fill & Stroke ──────────────────────────────────────────

	private applyFill(
		ctx: CanvasRenderingContext2D,
		fill: JPShapeFill | undefined,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		if (!fill || fill.type === 'none') {
			// Default: light blue fill
			ctx.fillStyle = '#d0e2ff';
			ctx.fill();
			return;
		}

		if (fill.type === 'solid') {
			ctx.fillStyle = fill.color ?? '#d0e2ff';
			ctx.fill();
		} else if (fill.type === 'gradient' && fill.gradientStops && fill.gradientStops.length >= 2) {
			const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
			for (const stop of fill.gradientStops) {
				gradient.addColorStop(stop.offset, stop.color);
			}
			ctx.fillStyle = gradient;
			ctx.fill();
		}
	}

	private applyStroke(ctx: CanvasRenderingContext2D, stroke: JPShapeStroke | undefined): void {
		if (!stroke) {
			// Default stroke
			ctx.strokeStyle = '#4a86c8';
			ctx.lineWidth = 1;
			ctx.stroke();
			return;
		}

		ctx.strokeStyle = stroke.color;
		ctx.lineWidth = emuToPx(stroke.width);

		if (stroke.dashStyle && stroke.dashStyle !== 'solid') {
			const lineW = ctx.lineWidth || 1;
			switch (stroke.dashStyle) {
				case 'dash':
					ctx.setLineDash([lineW * 4, lineW * 2]);
					break;
				case 'dot':
					ctx.setLineDash([lineW, lineW * 2]);
					break;
				case 'dashDot':
					ctx.setLineDash([lineW * 4, lineW * 2, lineW, lineW * 2]);
					break;
			}
		}

		ctx.stroke();
		ctx.setLineDash([]); // Reset dash
	}

	// ── Text ───────────────────────────────────────────────────

	private drawShapeText(
		ctx: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		ctx.save();
		const fontSize = Math.max(10, Math.min(w, h) * 0.15);
		ctx.font = `${fontSize}px sans-serif`;
		ctx.fillStyle = '#333333';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Simple text wrapping within the shape bounds
		const maxWidth = w * 0.8;
		const words = text.split(' ');
		const lines: string[] = [];
		let currentLine = '';

		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const metrics = ctx.measureText(testLine);
			if (metrics.width > maxWidth && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) lines.push(currentLine);

		const lineHeight = fontSize * 1.3;
		const totalHeight = lines.length * lineHeight;
		const startY = y + (h - totalHeight) / 2 + lineHeight / 2;
		const centerX = x + w / 2;

		for (let i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], centerX, startY + i * lineHeight, maxWidth);
		}

		ctx.restore();
	}
}

/**
 * Standalone function to draw a shape. Creates a temporary renderer instance.
 */
export function drawShape(
	ctx: CanvasRenderingContext2D,
	shapeType: JPShapeType,
	x: number,
	y: number,
	width: number,
	height: number,
	fill?: JPShapeFill,
	stroke?: JPShapeStroke,
	rotation?: number,
	text?: string,
): void {
	const renderer = new ShapeRenderer();
	renderer.drawShape(ctx, shapeType, x, y, width, height, fill, stroke, rotation, text);
}
