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
