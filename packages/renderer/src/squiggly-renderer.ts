/**
 * Draw a squiggly (wavy) underline on a canvas context.
 *
 * Uses quadratic Bezier curves to create a smooth wave pattern
 * typically used for spell check (red) or grammar check (blue) indicators.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Start X coordinate
 * @param y - Y coordinate (baseline of the squiggly line)
 * @param width - Width of the squiggly line
 * @param color - Stroke color (e.g., 'red' for spelling, 'blue' for grammar)
 * @param amplitude - Wave amplitude in pixels (default 2)
 * @param wavelength - Full wavelength in pixels (default 4)
 */
export function drawSquigglyLine(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	color: string,
	amplitude = 2,
	wavelength = 4,
): void {
	if (width <= 0) return;

	const halfWave = wavelength / 2;

	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, y);

	let cx = x;
	let up = true;

	while (cx < x + width) {
		const nextX = Math.min(cx + halfWave, x + width);
		const cpX = (cx + nextX) / 2;
		const cpY = up ? y - amplitude : y + amplitude;

		ctx.quadraticCurveTo(cpX, cpY, nextX, y);

		cx = nextX;
		up = !up;
	}

	ctx.stroke();
	ctx.restore();
}
