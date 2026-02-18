import type { LayoutImage } from '@jpoffice/layout';

/**
 * Renders images on a Canvas 2D context.
 * Caches loaded HTMLImageElement instances by src.
 */
export class ImageRenderer {
	private cache = new Map<string, HTMLImageElement>();
	private loading = new Set<string>();

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

		const cached = this.cache.get(image.src);
		if (cached) {
			ctx.drawImage(cached, x, y, image.rect.width, image.rect.height);
			return;
		}

		// Placeholder while loading
		ctx.save();
		ctx.fillStyle = '#f0f0f0';
		ctx.fillRect(x, y, image.rect.width, image.rect.height);
		ctx.strokeStyle = '#cccccc';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, image.rect.width, image.rect.height);

		// Draw placeholder icon
		ctx.fillStyle = '#999999';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Loading...', x + image.rect.width / 2, y + image.rect.height / 2);
		ctx.restore();

		// Start async load
		if (!this.loading.has(image.src)) {
			this.loading.add(image.src);
			const img = new Image();
			img.onload = () => {
				this.cache.set(image.src, img);
				this.loading.delete(image.src);
				onNeedRerender?.();
			};
			img.onerror = () => {
				this.loading.delete(image.src);
			};
			img.src = image.src;
		}
	}

	/**
	 * Clear the image cache.
	 */
	clearCache(): void {
		this.cache.clear();
		this.loading.clear();
	}
}
