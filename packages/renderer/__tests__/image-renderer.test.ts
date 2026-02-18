import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageRenderer } from '../src/image-renderer';
import type { LayoutImage } from '@jpoffice/layout';

function makeLayoutImage(overrides: Partial<LayoutImage> = {}): LayoutImage {
	return {
		kind: 'image',
		rect: { x: 10, y: 20, width: 200, height: 150 },
		nodePath: [0, 0, 0],
		src: 'https://example.com/test.png',
		...overrides,
	};
}

function makeCanvasContext(): CanvasRenderingContext2D {
	return {
		drawImage: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		fillText: vi.fn(),
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		font: '',
		textAlign: 'left',
		textBaseline: 'alphabetic',
	} as unknown as CanvasRenderingContext2D;
}

// Mock Image constructor for testing async load
let mockImageInstances: Array<{ onload?: () => void; onerror?: () => void; src?: string }> = [];
const OriginalImage = globalThis.Image;

beforeEach(() => {
	mockImageInstances = [];
	globalThis.Image = vi.fn().mockImplementation(() => {
		const img = { onload: undefined, onerror: undefined, src: '' };
		mockImageInstances.push(img);
		return img;
	}) as unknown as typeof Image;
});

// Restore after all tests
afterAll(() => {
	globalThis.Image = OriginalImage;
});

import { afterAll } from 'vitest';

describe('ImageRenderer', () => {
	it('constructs', () => {
		const renderer = new ImageRenderer();
		expect(renderer).toBeDefined();
	});

	it('clearCache clears internal caches', () => {
		const renderer = new ImageRenderer();
		renderer.clearCache();
		renderer.clearCache();
	});

	it('draws placeholder when image is not cached', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 0, 0);

		expect(ctx.save).toHaveBeenCalled();
		expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 200, 150);
		expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 200, 150);
		expect(ctx.fillText).toHaveBeenCalledWith('Loading...', 110, 95);
		expect(ctx.restore).toHaveBeenCalled();
	});

	it('starts async image load on first render', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 0, 0);

		expect(mockImageInstances).toHaveLength(1);
		expect(mockImageInstances[0].src).toBe('https://example.com/test.png');
	});

	it('does not start duplicate loads for same src', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 0, 0);
		renderer.renderImage(ctx, image, 0, 0);

		expect(mockImageInstances).toHaveLength(1);
	});

	it('calls onNeedRerender when image loads', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();
		const onRerender = vi.fn();

		renderer.renderImage(ctx, image, 0, 0, onRerender);

		// Simulate image load
		mockImageInstances[0].onload?.();

		expect(onRerender).toHaveBeenCalledTimes(1);
	});

	it('uses drawImage from cache after load', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		// First render — triggers load
		renderer.renderImage(ctx, image, 0, 0);
		mockImageInstances[0].onload?.();

		// Second render — should use cache
		renderer.renderImage(ctx, image, 5, 10);

		expect(ctx.drawImage).toHaveBeenCalledTimes(1);
		expect(ctx.drawImage).toHaveBeenCalledWith(
			expect.anything(),
			15, // 5 + 10
			30, // 10 + 20
			200,
			150,
		);
	});

	it('applies offset to placeholder rendering', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 50, 100);

		expect(ctx.fillRect).toHaveBeenCalledWith(60, 120, 200, 150);
	});

	it('handles image load error gracefully', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 0, 0);
		mockImageInstances[0].onerror?.();

		// After error, should allow retry (new Image created)
		renderer.renderImage(ctx, image, 0, 0);
		expect(mockImageInstances).toHaveLength(2);
	});

	it('clearCache allows re-loading of images', () => {
		const renderer = new ImageRenderer();
		const ctx = makeCanvasContext();
		const image = makeLayoutImage();

		renderer.renderImage(ctx, image, 0, 0);
		mockImageInstances[0].onload?.();

		renderer.clearCache();

		// After clear, should create new Image (not use cache)
		renderer.renderImage(ctx, image, 0, 0);
		expect(mockImageInstances).toHaveLength(2);
	});
});
