import type { LayoutPage } from '@jpoffice/layout';

export interface PageChromeOptions {
	/** Shadow blur radius in px. Default 4. */
	shadowBlur?: number;
	/** Shadow color. Default 'rgba(0,0,0,0.3)'. */
	shadowColor?: string;
	/** Background color of the page. Default '#ffffff'. */
	pageBackground?: string;
	/** Background color outside the page (workspace). Default '#e0e0e0'. */
	workspaceBackground?: string;
	/** Gap between pages in px. Default 20. */
	pageGap?: number;
}

const DEFAULTS: Required<PageChromeOptions> = {
	shadowBlur: 4,
	shadowColor: 'rgba(0,0,0,0.3)',
	pageBackground: '#ffffff',
	workspaceBackground: '#e0e0e0',
	pageGap: 20,
};

/**
 * Renders page chrome: background, shadow, margin guides.
 */
export class PageRenderer {
	private options: Required<PageChromeOptions>;

	constructor(options?: PageChromeOptions) {
		this.options = { ...DEFAULTS, ...options };
	}

	/**
	 * Calculate the total canvas height needed for all pages.
	 */
	getTotalHeight(pages: readonly LayoutPage[]): number {
		const { pageGap } = this.options;
		let total = pageGap; // top padding
		for (const page of pages) {
			total += page.height + pageGap;
		}
		return total;
	}

	/**
	 * Get the Y offset for a specific page index.
	 */
	getPageY(pages: readonly LayoutPage[], pageIndex: number): number {
		const { pageGap } = this.options;
		let y = pageGap;
		for (let i = 0; i < pageIndex && i < pages.length; i++) {
			y += pages[i].height + pageGap;
		}
		return y;
	}

	/**
	 * Clear the workspace area with background color.
	 */
	renderWorkspace(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		ctx.fillStyle = this.options.workspaceBackground;
		ctx.fillRect(0, 0, width, height);
	}

	/**
	 * Render a single page's chrome (background + shadow).
	 * pageX is the horizontal centering offset.
	 */
	renderPageChrome(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		pageX: number,
		pageY: number,
	): void {
		const { shadowBlur, shadowColor, pageBackground } = this.options;

		// Shadow
		ctx.save();
		ctx.shadowBlur = shadowBlur;
		ctx.shadowColor = shadowColor;
		ctx.shadowOffsetX = 2;
		ctx.shadowOffsetY = 2;

		// Page background
		ctx.fillStyle = pageBackground;
		ctx.fillRect(pageX, pageY, page.width, page.height);

		ctx.restore();

		// Page border
		ctx.strokeStyle = '#cccccc';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(pageX, pageY, page.width, page.height);
	}

	/**
	 * Render a watermark on the page (centered, rotated, semi-transparent).
	 */
	renderWatermark(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		pageX: number,
		pageY: number,
	): void {
		if (!page.watermark) return;
		const { text, fontFamily, fontSize, color, rotation, opacity } = page.watermark;

		ctx.save();
		ctx.globalAlpha = opacity;
		ctx.fillStyle = color;
		ctx.font = `${fontSize}pt "${fontFamily}", sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const centerX = pageX + page.width / 2;
		const centerY = pageY + page.height / 2;

		ctx.translate(centerX, centerY);
		ctx.rotate((rotation * Math.PI) / 180);
		ctx.fillText(text, 0, 0);

		ctx.restore();
	}

	/**
	 * Render page borders around the page or content area.
	 */
	renderPageBorders(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		pageX: number,
		pageY: number,
		pageIndexInSection: number,
	): void {
		if (!page.pageBorders) return;
		const borders = page.pageBorders;

		// Check display condition
		if (borders.display === 'firstPage' && pageIndexInSection !== 0) return;
		if (borders.display === 'notFirstPage' && pageIndexInSection === 0) return;

		// Determine border rectangle based on offsetFrom
		let bx: number;
		let by: number;
		let bw: number;
		let bh: number;
		if (borders.offsetFrom === 'text') {
			bx = pageX + page.contentArea.x;
			by = pageY + page.contentArea.y;
			bw = page.contentArea.width;
			bh = page.contentArea.height;
		} else {
			bx = pageX;
			by = pageY;
			bw = page.width;
			bh = page.height;
		}

		ctx.save();

		const drawBorder = (
			side: { style: string; color: string; width: number; space: number } | undefined,
			x1: number,
			y1: number,
			x2: number,
			y2: number,
		) => {
			if (!side) return;
			ctx.strokeStyle = side.color;
			ctx.lineWidth = side.width / 8; // eighths of a point to pixels approx
			if (side.style === 'dashed') {
				ctx.setLineDash([4, 2]);
			} else if (side.style === 'dotted') {
				ctx.setLineDash([1, 1]);
			} else if (side.style === 'double') {
				ctx.setLineDash([]);
				// Draw two lines
				const offset = ctx.lineWidth;
				ctx.beginPath();
				ctx.moveTo(x1, y1 - offset);
				ctx.lineTo(x2, y2 - offset);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(x1, y1 + offset);
				ctx.lineTo(x2, y2 + offset);
				ctx.stroke();
				return;
			} else {
				ctx.setLineDash([]);
			}
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		};

		const sp = (s: { space: number } | undefined) => (s ? s.space : 0);

		drawBorder(
			borders.top,
			bx - sp(borders.left),
			by - sp(borders.top),
			bx + bw + sp(borders.right),
			by - sp(borders.top),
		);
		drawBorder(
			borders.bottom,
			bx - sp(borders.left),
			by + bh + sp(borders.bottom),
			bx + bw + sp(borders.right),
			by + bh + sp(borders.bottom),
		);
		drawBorder(
			borders.left,
			bx - sp(borders.left),
			by - sp(borders.top),
			bx - sp(borders.left),
			by + bh + sp(borders.bottom),
		);
		drawBorder(
			borders.right,
			bx + bw + sp(borders.right),
			by - sp(borders.top),
			bx + bw + sp(borders.right),
			by + bh + sp(borders.bottom),
		);

		ctx.restore();
	}

	/**
	 * Render margin guides (optional, for debug or rulers).
	 */
	renderMargins(
		ctx: CanvasRenderingContext2D,
		page: LayoutPage,
		pageX: number,
		pageY: number,
	): void {
		const ca = page.contentArea;
		ctx.save();
		ctx.strokeStyle = 'rgba(100,150,255,0.15)';
		ctx.lineWidth = 0.5;
		ctx.setLineDash([4, 4]);
		ctx.strokeRect(pageX + ca.x, pageY + ca.y, ca.width, ca.height);
		ctx.restore();
	}
}
