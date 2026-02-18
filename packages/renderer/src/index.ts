// Main renderer
export { CanvasRenderer } from './canvas-renderer';
export type { CanvasRendererOptions } from './canvas-renderer';

// Sub-renderers
export { PageRenderer } from './page-renderer';
export type { PageChromeOptions } from './page-renderer';

export { TextRenderer } from './text-renderer';

export { TableRenderer } from './table-renderer';

export { ImageRenderer } from './image-renderer';

export { SelectionRenderer } from './selection-renderer';
export type { SelectionStyle } from './selection-renderer';

export { CursorRenderer } from './cursor-renderer';
export type { CursorStyle, CursorPosition } from './cursor-renderer';

// Hit testing
export { HitTester } from './hit-test';
export type { HitTestResult } from './hit-test';
