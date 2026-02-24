// Main renderer
export { CanvasRenderer } from './canvas-renderer';
export type {
	CanvasRendererOptions,
	VisibleRange,
	TableAtCoordsResult,
	ColumnBorderResult,
	RowBorderResult,
} from './canvas-renderer';

// Sub-renderers
export { PageRenderer } from './page-renderer';
export type { PageChromeOptions } from './page-renderer';

export { TextRenderer } from './text-renderer';

export { TableRenderer } from './table-renderer';

export { ImageRenderer } from './image-renderer';

export { SelectionRenderer } from './selection-renderer';
export type { SelectionStyle, SearchHighlight } from './selection-renderer';

export { CursorRenderer } from './cursor-renderer';
export type { CursorStyle, CursorPosition } from './cursor-renderer';

// Squiggly line (spell check / grammar)
export { drawSquigglyLine } from './squiggly-renderer';

// Remote cursors (collaboration)
export { drawRemoteCursors } from './remote-cursor-renderer';
export type { RemoteCursorInfo, PositionResolver } from './remote-cursor-renderer';

// Shapes
export { ShapeRenderer, drawShape } from './shape-renderer';

// Hit testing
export { HitTester } from './hit-test';
export type { HitTestResult } from './hit-test';
