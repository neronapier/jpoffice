import type { JPParagraphProperties, JPRunProperties, JPStyleRegistry } from '@jpoffice/model';
import {
	halfPointsToPx,
	resolveStyleParagraphProperties,
	resolveStyleRunProperties,
	twipsToPx,
} from '@jpoffice/model';
import type { ResolvedRunStyle } from './types';

/**
 * Default run properties when nothing is specified.
 */
const DEFAULT_RUN: Required<
	Pick<
		ResolvedRunStyle,
		| 'fontFamily'
		| 'fontSize'
		| 'bold'
		| 'italic'
		| 'underline'
		| 'strikethrough'
		| 'doubleStrikethrough'
		| 'superscript'
		| 'subscript'
		| 'color'
		| 'backgroundColor'
		| 'highlight'
		| 'allCaps'
		| 'smallCaps'
		| 'letterSpacing'
	>
> = {
	fontFamily: 'Calibri',
	fontSize: 14.67, // 11pt in px (22 half-points)
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	doubleStrikethrough: false,
	superscript: false,
	subscript: false,
	color: '#000000',
	backgroundColor: null,
	highlight: null,
	allCaps: false,
	smallCaps: false,
	letterSpacing: 0,
};

/**
 * Resolve a JPRunProperties into a fully resolved ResolvedRunStyle.
 * Merges style inheritance, paragraph defaults, and direct properties.
 */
export function resolveRunStyle(
	styles: JPStyleRegistry,
	paragraphProps: JPParagraphProperties,
	runProps: JPRunProperties,
): ResolvedRunStyle {
	// 1. Start with defaults
	let merged: JPRunProperties = {};

	// 2. Apply paragraph style's run properties
	if (paragraphProps.styleId) {
		const styleRun = resolveStyleRunProperties(styles, paragraphProps.styleId);
		merged = { ...merged, ...styleRun };
	}

	// 3. Apply paragraph's direct run properties
	if (paragraphProps.runProperties) {
		merged = { ...merged, ...paragraphProps.runProperties };
	}

	// 4. Apply run's own style
	if (runProps.styleId) {
		const styleRun = resolveStyleRunProperties(styles, runProps.styleId);
		merged = { ...merged, ...styleRun };
	}

	// 5. Apply run's direct properties (highest priority)
	merged = {
		...merged,
		...(stripUndefined(runProps as Record<string, unknown>) as JPRunProperties),
	};

	// 6. Convert to resolved (px-based) style
	return {
		fontFamily: merged.fontFamily ?? DEFAULT_RUN.fontFamily,
		fontSize: merged.fontSize ? halfPointsToPx(merged.fontSize) : DEFAULT_RUN.fontSize,
		bold: merged.bold ?? DEFAULT_RUN.bold,
		italic: merged.italic ?? DEFAULT_RUN.italic,
		underline: merged.underline && merged.underline !== 'none' ? merged.underline : false,
		strikethrough: merged.strikethrough ?? DEFAULT_RUN.strikethrough,
		doubleStrikethrough: merged.doubleStrikethrough ?? DEFAULT_RUN.doubleStrikethrough,
		superscript: merged.superscript ?? DEFAULT_RUN.superscript,
		subscript: merged.subscript ?? DEFAULT_RUN.subscript,
		color: merged.color ? ensureHashPrefix(merged.color) : DEFAULT_RUN.color,
		backgroundColor: merged.backgroundColor
			? ensureHashPrefix(merged.backgroundColor)
			: DEFAULT_RUN.backgroundColor,
		highlight: merged.highlight ?? DEFAULT_RUN.highlight,
		allCaps: merged.allCaps ?? DEFAULT_RUN.allCaps,
		smallCaps: merged.smallCaps ?? DEFAULT_RUN.smallCaps,
		letterSpacing: merged.letterSpacing
			? twipsToPx(merged.letterSpacing)
			: DEFAULT_RUN.letterSpacing,
	};
}

/**
 * Resolve paragraph spacing/indent to px values.
 */
export interface ResolvedParagraphLayout {
	readonly alignment: 'left' | 'center' | 'right' | 'justify';
	readonly spaceBefore: number; // px
	readonly spaceAfter: number; // px
	readonly lineSpacing: number; // multiplier (1.0 = single, 2.0 = double)
	readonly indentLeft: number; // px
	readonly indentRight: number; // px
	readonly indentFirstLine: number; // px (can be negative for hanging)
}

export function resolveParagraphLayout(
	styles: JPStyleRegistry,
	props: JPParagraphProperties,
): ResolvedParagraphLayout {
	// Merge style + direct props
	let merged: JPParagraphProperties = {};

	if (props.styleId) {
		merged = resolveStyleParagraphProperties(styles, props.styleId);
	}
	merged = {
		...merged,
		...(stripUndefined(props as Record<string, unknown>) as JPParagraphProperties),
	};

	const spacing = merged.spacing;
	const indent = merged.indent;

	// Line spacing: 240 = single in OOXML
	let lineSpacing = 1.15; // default
	if (spacing?.line) {
		if (spacing.lineRule === 'auto' || !spacing.lineRule) {
			lineSpacing = spacing.line / 240;
		}
		// exact and atLeast are handled differently in the layout engine
	}

	return {
		alignment: (merged.alignment as ResolvedParagraphLayout['alignment']) ?? 'left',
		spaceBefore: spacing?.before ? twipsToPx(spacing.before) : 0,
		spaceAfter: spacing?.after !== undefined ? twipsToPx(spacing.after) : twipsToPx(160),
		lineSpacing,
		indentLeft: indent?.left ? twipsToPx(indent.left) : 0,
		indentRight: indent?.right ? twipsToPx(indent.right) : 0,
		indentFirstLine: indent?.firstLine
			? twipsToPx(indent.firstLine)
			: indent?.hanging
				? -twipsToPx(indent.hanging)
				: 0,
	};
}

function ensureHashPrefix(color: string): string {
	return color.startsWith('#') ? color : `#${color}`;
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result;
}
