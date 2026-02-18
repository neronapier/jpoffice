import { describe, it, expect } from 'vitest';
import { PageRenderer } from '../src/page-renderer';
import type { LayoutPage } from '@jpoffice/layout';

function makePage(height: number, width = 612): LayoutPage {
	return {
		index: 0,
		width,
		height,
		contentArea: { x: 72, y: 72, width: width - 144, height: height - 144 },
		blocks: [],
	};
}

describe('PageRenderer', () => {
	it('constructs with defaults', () => {
		const renderer = new PageRenderer();
		expect(renderer).toBeDefined();
	});

	it('getTotalHeight with single page', () => {
		const renderer = new PageRenderer({ pageGap: 20 });
		const pages = [makePage(792)];
		// top gap (20) + page height (792) + bottom gap (20) = 832
		expect(renderer.getTotalHeight(pages)).toBe(832);
	});

	it('getTotalHeight with multiple pages', () => {
		const renderer = new PageRenderer({ pageGap: 10 });
		const pages = [makePage(100), makePage(200), makePage(150)];
		// top gap (10) + 100 + gap (10) + 200 + gap (10) + 150 + gap (10) = 490
		expect(renderer.getTotalHeight(pages)).toBe(490);
	});

	it('getTotalHeight with empty pages', () => {
		const renderer = new PageRenderer({ pageGap: 20 });
		expect(renderer.getTotalHeight([])).toBe(20);
	});

	it('getPageY returns correct offset for first page', () => {
		const renderer = new PageRenderer({ pageGap: 20 });
		const pages = [makePage(792)];
		expect(renderer.getPageY(pages, 0)).toBe(20);
	});

	it('getPageY returns correct offset for second page', () => {
		const renderer = new PageRenderer({ pageGap: 20 });
		const pages = [makePage(100), makePage(200)];
		// First page at Y=20, height=100, gap=20 → second at 20+100+20=140
		expect(renderer.getPageY(pages, 1)).toBe(140);
	});

	it('getPageY returns correct offset for third page', () => {
		const renderer = new PageRenderer({ pageGap: 10 });
		const pages = [makePage(100), makePage(200), makePage(300)];
		// Y(0) = 10
		// Y(1) = 10 + 100 + 10 = 120
		// Y(2) = 120 + 200 + 10 = 330
		expect(renderer.getPageY(pages, 2)).toBe(330);
	});

	it('custom options override defaults', () => {
		const renderer = new PageRenderer({ pageGap: 50 });
		const pages = [makePage(100)];
		expect(renderer.getPageY(pages, 0)).toBe(50);
		expect(renderer.getTotalHeight(pages)).toBe(200); // 50 + 100 + 50
	});
});
