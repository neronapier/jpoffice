import type { LayoutImage } from '@jpoffice/layout';

/**
 * Renders images on a Canvas 2D context.
 * Caches loaded HTMLImageElement instances by src.
 * Supports crop, rotation, flip, and error placeholder.
 */
export class ImageRenderer {
	private cache = new Map<string, HTMLImageElement>();
	private loading = new Set<string>();
	private errors = new Set<string>();

	/**
	 * Render an image from the layout.
	 * If the image is not yet loaded, triggers async load and requests a re-render.
	 */
	renderImage(
		ctx: CanvasRenderingContext2D,
		image: LayoutImage,
		offsetX: number,
		offsetY: number,
		onNeedRerender?: () => void,
	): void {
		const x = offsetX + image.rect.x;
		const y = offsetY + image.rect.y;
		const w = image.rect.width;
		const h = image.rect.height;

		const cached = this.cache.get(image.src);
		if (!cached) {
			this.renderPlaceholder(ctx, x, y, w, h, this.errors.has(image.src) ? 'error' : 'loading');
			if (!this.loading.has(image.src) && !this.errors.has(image.src)) {
				this.startLoad(image.src, onNeedRerender);
			}
			return;
		}

		ctx.save();

		// Rotation + Flip transforms
		const rotation = image.rotation ?? 0;
		const flipH = image.flipH ?? false;
		const flipV = image.flipV ?? false;

		if (rotation !== 0 || flipH || flipV) {
			const cx = x + w / 2;
			const cy = y + h / 2;
			ctx.translate(cx, cy);
			if (rotation) ctx.rotate((rotation * Math.PI) / 180);
			if (flipH) ctx.scale(-1, 1);
			if (flipV) ctx.scale(1, -1);
			ctx.translate(-cx, -cy);
		}

		// Crop via clip
		const crop = image.crop;
		if (crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0)) {
			const cl = x + w * crop.left;
			const ct = y + h * crop.top;
			const cw = w * (1 - crop.left - crop.right);
			const ch = h * (1 - crop.top - crop.bottom);
			ctx.beginPath();
			ctx.rect(cl, ct, cw, ch);
			ctx.clip();
		}

		ctx.drawImage(cached, x, y, w, h);
		ctx.restore();
	}

	/**
	 * Clear the image cache.
	 */
	clearCache(): void {
		this.cache.clear();
		this.loading.clear();
		this.errors.clear();
	}

	private startLoad(src: string, onNeedRerender?: () => void): void {
		this.loading.add(src);
		const img = new Image();
		img.onload = () => {
			this.cache.set(src, img);
			this.loading.delete(src);
			onNeedRerender?.();
		};
		img.onerror = () => {
			this.loading.delete(src);
			this.errors.add(src);
			onNeedRerender?.();
		};
		img.src = src;
	}

	private renderPlaceholder(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		state: 'loading' | 'error',
	): void {
		ctx.save();
		ctx.fillStyle = state === 'error' ? '#fce4ec' : '#f0f0f0';
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = state === 'error' ? '#e57373' : '#cccccc';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, w, h);

		// Icon / text
		ctx.fillStyle = state === 'error' ? '#c62828' : '#999999';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		if (state === 'error') {
			// Broken image icon (X shape)
			const cx = x + w / 2;
			const cy = y + h / 2;
			const sz = Math.min(w, h, 24) * 0.3;
			ctx.strokeStyle = '#c62828';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(cx - sz, cy - sz);
			ctx.lineTo(cx + sz, cy + sz);
			ctx.moveTo(cx + sz, cy - sz);
			ctx.lineTo(cx - sz, cy + sz);
			ctx.stroke();
		} else {
			ctx.fillText('Loading...', x + w / 2, y + h / 2);
		}
		ctx.restore();
	}
}
