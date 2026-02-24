/**
 * Knuth-Plass optimal line breaking algorithm.
 *
 * This implements the algorithm described in:
 * "Breaking Paragraphs into Lines" by Donald E. Knuth and Michael F. Plass
 * (Software: Practice and Experience, Vol. 11, 1981)
 *
 * The algorithm finds the globally optimal set of line breaks that minimizes
 * total "demerits" (a measure of line quality), producing superior justified
 * text compared to the greedy algorithm.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A box represents non-breakable content (a word or glyph). */
export interface KPBox {
	readonly type: 'box';
	readonly width: number;
	readonly content: unknown; // reference to the original fragment/word
}

/** Glue represents stretchable/shrinkable space between boxes. */
export interface KPGlue {
	readonly type: 'glue';
	readonly width: number; // natural width
	readonly stretch: number; // maximum extra width
	readonly shrink: number; // maximum reduction
}

/** A penalty represents a potential break point with an associated cost. */
export interface KPPenalty {
	readonly type: 'penalty';
	readonly width: number; // width if break happens here (e.g., hyphen width)
	readonly penalty: number; // cost of breaking here (-Infinity = forced, +Infinity = forbidden)
	readonly flagged: boolean; // true for hyphens (to penalize consecutive hyphens)
}

export type KPItem = KPBox | KPGlue | KPPenalty;

export interface KPBreakpoint {
	readonly index: number; // index in items array where break occurs
	readonly line: number; // line number (0-based)
	readonly ratio: number; // adjustment ratio for this line
	readonly demerits: number; // accumulated demerits up to this point
}

export interface KPOptions {
	readonly lineWidths: number | readonly number[]; // width per line (or single width for all)
	readonly tolerance?: number; // default 1, max adjustment ratio
	readonly looseness?: number; // default 0, target line count delta
	readonly hyphenPenalty?: number; // default 50
	readonly doublePenalty?: number; // default 3000, consecutive hyphens penalty
	readonly fitness?: boolean; // default true, use fitness classes
}

export interface KPResult {
	readonly breakpoints: readonly KPBreakpoint[];
	readonly demerits: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INFINITY_PENALTY = 10000;
const NEGATIVE_INFINITY_PENALTY = -INFINITY_PENALTY;
const MAX_BADNESS = 10000;

/** Fitness classes based on adjustment ratio. */
const FITNESS_TIGHT = 0;
const FITNESS_NORMAL = 1;
const FITNESS_LOOSE = 2;
const FITNESS_VERY_LOOSE = 3;

/** Penalty for adjacent lines with fitness class difference > 1. */
const FITNESS_CLASS_DEMERIT = 3000;

// ── Internal types ───────────────────────────────────────────────────────────

/** An active node in the dynamic programming search. */
interface ActiveNode {
	/** Index in the items array where this breakpoint occurs. */
	index: number;
	/** Line number (0-based) of the line ending at this breakpoint. */
	line: number;
	/** Fitness class of the line ending at this breakpoint. */
	fitness: number;
	/** Total width of items from the start to just after this breakpoint. */
	totalWidth: number;
	/** Total stretch of glue from the start to just after this breakpoint. */
	totalStretch: number;
	/** Total shrink of glue from the start to just after this breakpoint. */
	totalShrink: number;
	/** Total accumulated demerits. */
	demerits: number;
	/** Adjustment ratio of the line ending at this breakpoint. */
	ratio: number;
	/** Link to the previous active node in the optimal path. */
	previous: ActiveNode | null;
}

// ── Main algorithm ───────────────────────────────────────────────────────────

/**
 * Get the line width for a given line number.
 */
function getLineWidth(lineWidths: number | readonly number[], lineNumber: number): number {
	if (typeof lineWidths === 'number') {
		return lineWidths;
	}
	if (lineNumber < lineWidths.length) {
		return lineWidths[lineNumber];
	}
	return lineWidths[lineWidths.length - 1];
}

/**
 * Determine the fitness class from an adjustment ratio.
 */
function fitnessClass(ratio: number): number {
	if (ratio < -0.5) return FITNESS_TIGHT;
	if (ratio <= 0.5) return FITNESS_NORMAL;
	if (ratio <= 1.0) return FITNESS_LOOSE;
	return FITNESS_VERY_LOOSE;
}

/**
 * Compute badness from an adjustment ratio.
 * badness = 100 * |r|^3, capped at MAX_BADNESS.
 */
function computeBadness(ratio: number): number {
	const absR = Math.abs(ratio);
	if (absR > 10) return MAX_BADNESS;
	const badness = Math.round(100 * absR * absR * absR);
	return Math.min(badness, MAX_BADNESS);
}

/**
 * Compute the sum of widths, stretch, and shrink from a starting position.
 * This is used for computing running totals after a breakpoint.
 */
function computeTotalsAfterBreak(
	items: readonly KPItem[],
	breakIndex: number,
): { width: number; stretch: number; shrink: number } {
	let width = 0;
	let stretch = 0;
	let shrink = 0;

	// After a break, skip any glue immediately following the break
	for (let i = breakIndex; i < items.length; i++) {
		const item = items[i];
		if (item.type === 'box') {
			break;
		}
		if (item.type === 'glue') {
			width += item.width;
			stretch += item.stretch;
			shrink += item.shrink;
		}
		if (item.type === 'penalty' && item.penalty === NEGATIVE_INFINITY_PENALTY) {
			break;
		}
	}

	return { width, stretch, shrink };
}

/**
 * Find optimal line break points using the Knuth-Plass algorithm.
 * Returns null if no solution found within tolerance (caller should fall back to greedy).
 */
export function knuthPlassBreak(items: readonly KPItem[], options: KPOptions): KPResult | null {
	if (items.length === 0) {
		return { breakpoints: [], demerits: 0 };
	}

	const tolerance = options.tolerance ?? 1;
	const looseness = options.looseness ?? 0;
	const doublePenalty = options.doublePenalty ?? 3000;
	const useFitness = options.fitness !== false;

	// Pre-compute running totals for width, stretch, and shrink.
	// totalWidth[i] = sum of widths of items[0..i-1]
	const n = items.length;
	const sumWidth: number[] = new Array(n + 1);
	const sumStretch: number[] = new Array(n + 1);
	const sumShrink: number[] = new Array(n + 1);
	sumWidth[0] = 0;
	sumStretch[0] = 0;
	sumShrink[0] = 0;

	for (let i = 0; i < n; i++) {
		const item = items[i];
		if (item.type === 'box') {
			sumWidth[i + 1] = sumWidth[i] + item.width;
			sumStretch[i + 1] = sumStretch[i];
			sumShrink[i + 1] = sumShrink[i];
		} else if (item.type === 'glue') {
			sumWidth[i + 1] = sumWidth[i] + item.width;
			sumStretch[i + 1] = sumStretch[i] + item.stretch;
			sumShrink[i + 1] = sumShrink[i] + item.shrink;
		} else {
			// penalty: width only contributes if we break here
			sumWidth[i + 1] = sumWidth[i];
			sumStretch[i + 1] = sumStretch[i];
			sumShrink[i + 1] = sumShrink[i];
		}
	}

	// Initialize the active list with a single node at the start
	const startNode: ActiveNode = {
		index: 0,
		line: 0,
		fitness: FITNESS_NORMAL,
		totalWidth: 0,
		totalStretch: 0,
		totalShrink: 0,
		demerits: 0,
		ratio: 0,
		previous: null,
	};

	let activeNodes: ActiveNode[] = [startNode];

	// Process each item
	for (let i = 0; i < n; i++) {
		const item = items[i];

		// We only consider breakpoints at:
		// 1. Glue items (break before the glue)
		// 2. Penalty items with penalty < +infinity
		const isLegalBreak =
			(item.type === 'glue' && i > 0 && items[i - 1].type === 'box') ||
			(item.type === 'penalty' && item.penalty < INFINITY_PENALTY);

		if (!isLegalBreak) continue;

		// For each active node, compute the cost of breaking here
		const newActiveNodes: ActiveNode[] = [];
		const deactivateIndices = new Set<number>();

		// Best candidates by fitness class for adding to active list
		const bestByFitness: (ActiveNode | null)[] = [null, null, null, null];

		for (let ai = 0; ai < activeNodes.length; ai++) {
			const active = activeNodes[ai];

			// Compute the width of the line from the active node to this breakpoint
			let lineWidth = sumWidth[i] - active.totalWidth;
			const lineStretch = sumStretch[i] - active.totalStretch;
			const lineShrink = sumShrink[i] - active.totalShrink;

			// If breaking at a penalty, add the penalty's width (e.g., hyphen)
			if (item.type === 'penalty') {
				lineWidth += item.width;
			}

			// Subtract any glue that was skipped after the previous break
			// (The active node's totalWidth already accounts for skipped glue)

			const targetWidth = getLineWidth(options.lineWidths, active.line);

			// Compute adjustment ratio
			let ratio: number;
			if (lineWidth < targetWidth) {
				// Line is too short — need to stretch
				if (lineStretch > 0) {
					ratio = (targetWidth - lineWidth) / lineStretch;
				} else {
					// No glue to stretch. Use a large ratio that will produce
					// high demerits but is still finite, so the algorithm can
					// still consider this break as a last resort.
					ratio = tolerance + 1;
				}
			} else if (lineWidth > targetWidth) {
				// Line is too long — need to shrink
				if (lineShrink > 0) {
					ratio = (targetWidth - lineWidth) / lineShrink;
				} else {
					// No glue to shrink — line is overfull
					ratio = -1;
				}
			} else {
				ratio = 0; // Perfect fit
			}

			// Determine if this break is forced (mandatory line break)
			const isForcedBreak = item.type === 'penalty' && item.penalty <= NEGATIVE_INFINITY_PENALTY;

			// Check if this active node should be deactivated:
			// 1. If the line is overfull (ratio < -1), the active node can never
			//    produce a feasible line by extending further.
			// 2. If this is a forced break, ALL active nodes must break here —
			//    they cannot continue past a forced break.
			if (ratio < -1 || isForcedBreak) {
				deactivateIndices.add(ai);
			}

			if (ratio < -1) {
				// Line is overfull — only allow if this is a forced break
				if (!isForcedBreak) {
					continue;
				}
				// Cap for demerit calculation
				ratio = -1;
			} else if (ratio > tolerance && !isForcedBreak) {
				// Line is very loose (underfull). Still consider it, but with
				// a capped ratio that will produce high demerits. This allows
				// the algorithm to find solutions for difficult paragraphs
				// (e.g., a very short word alone on a line) rather than failing.
				ratio = tolerance;
			}

			// Compute demerits
			const badness = computeBadness(ratio);
			let linePenalty = 0;
			if (item.type === 'penalty') {
				linePenalty = item.penalty;
			}

			let demerits: number;
			if (linePenalty >= 0) {
				demerits = (1 + badness + linePenalty) * (1 + badness + linePenalty);
			} else if (linePenalty > NEGATIVE_INFINITY_PENALTY) {
				demerits = (1 + badness) * (1 + badness) - linePenalty * linePenalty;
			} else {
				// Forced break
				demerits = (1 + badness) * (1 + badness);
			}

			// Penalize consecutive flagged breaks (hyphens)
			if (
				item.type === 'penalty' &&
				item.flagged &&
				active.index > 0 &&
				items[active.index]?.type === 'penalty' &&
				(items[active.index] as KPPenalty).flagged
			) {
				demerits += doublePenalty;
			}

			// Fitness class penalty
			const fc = fitnessClass(ratio);
			if (useFitness && Math.abs(fc - active.fitness) > 1) {
				demerits += FITNESS_CLASS_DEMERIT;
			}

			demerits += active.demerits;

			// Compute totals after this break for the new active node
			const afterBreak = computeTotalsAfterBreak(items, i + 1);
			const newTotalWidth = sumWidth[i + 1] + afterBreak.width;
			const newTotalStretch = sumStretch[i + 1] + afterBreak.stretch;
			const newTotalShrink = sumShrink[i + 1] + afterBreak.shrink;

			const candidate: ActiveNode = {
				index: i,
				line: active.line + 1,
				fitness: fc,
				totalWidth: newTotalWidth,
				totalStretch: newTotalStretch,
				totalShrink: newTotalShrink,
				demerits,
				ratio,
				previous: active,
			};

			// Keep only the best candidate per fitness class
			const best = bestByFitness[fc];
			if (best === null || demerits < best.demerits) {
				bestByFitness[fc] = candidate;
			}
		}

		// Remove deactivated nodes
		if (deactivateIndices.size > 0) {
			activeNodes = activeNodes.filter((_, idx) => !deactivateIndices.has(idx));
		}

		// Add best candidates to active list
		for (const candidate of bestByFitness) {
			if (candidate) {
				newActiveNodes.push(candidate);
			}
		}

		activeNodes.push(...newActiveNodes);

		// If no active nodes remain, the algorithm fails
		if (activeNodes.length === 0) {
			return null;
		}
	}

	// Find the best active node that reaches the end of the paragraph.
	// Only nodes created at the last legal breakpoint (the forced break at
	// the end) represent complete solutions. Other active nodes are still
	// "in progress" and don't cover all the text.
	if (activeNodes.length === 0) {
		return null;
	}

	// Find the maximum index among all active nodes — this is the last
	// breakpoint that was processed (should be the forced break at the end).
	const maxIndex = activeNodes.reduce((max, node) => Math.max(max, node.index), 0);

	// Filter to only nodes at the final breakpoint
	const finalNodes = activeNodes.filter((node) => node.index === maxIndex);
	if (finalNodes.length === 0) {
		return null;
	}

	let bestNode = finalNodes[0];
	for (let i = 1; i < finalNodes.length; i++) {
		if (looseness === 0) {
			// Simply pick lowest demerits
			if (finalNodes[i].demerits < bestNode.demerits) {
				bestNode = finalNodes[i];
			}
		} else {
			// Pick the solution closest to the target line count
			const targetLines = bestNode.line + looseness;
			const bestDiff = Math.abs(bestNode.line - targetLines);
			const currDiff = Math.abs(finalNodes[i].line - targetLines);
			if (
				currDiff < bestDiff ||
				(currDiff === bestDiff && finalNodes[i].demerits < bestNode.demerits)
			) {
				bestNode = finalNodes[i];
			}
		}
	}

	// Backtrack from the best node to collect all breakpoints
	const breakpoints: KPBreakpoint[] = [];
	let node: ActiveNode | null = bestNode;
	while (node && node.previous !== null) {
		breakpoints.push({
			index: node.index,
			line: node.line - 1, // line number for the line ending at this break
			ratio: node.ratio,
			demerits: node.demerits,
		});
		node = node.previous;
	}

	breakpoints.reverse();

	return {
		breakpoints,
		demerits: bestNode.demerits,
	};
}

// ── Fragment conversion ──────────────────────────────────────────────────────

/**
 * Convert layout fragments/words to Knuth-Plass items.
 * Spaces become glue, words become boxes, potential hyphens become penalties.
 * A forced break (penalty -infinity) is appended at the end.
 */
export function fragmentsToKPItems(
	fragments: readonly { width: number; isSpace: boolean; content: unknown }[],
	spaceWidth: number,
): readonly KPItem[] {
	const items: KPItem[] = [];

	// Glue stretch/shrink ratios relative to the natural space width:
	// stretch = 50% of space width (can grow by up to half)
	// shrink = 33% of space width (can shrink by up to a third)
	const stretchFactor = 0.5;
	const shrinkFactor = 0.33;

	for (const fragment of fragments) {
		if (fragment.isSpace) {
			items.push({
				type: 'glue',
				width: fragment.width,
				stretch: spaceWidth * stretchFactor,
				shrink: spaceWidth * shrinkFactor,
			});
		} else {
			items.push({
				type: 'box',
				width: fragment.width,
				content: fragment.content,
			});
		}
	}

	// Append finishing glue + forced break at end
	items.push({
		type: 'glue',
		width: 0,
		stretch: INFINITY_PENALTY,
		shrink: 0,
	});
	items.push({
		type: 'penalty',
		width: 0,
		penalty: NEGATIVE_INFINITY_PENALTY,
		flagged: false,
	});

	return items;
}
