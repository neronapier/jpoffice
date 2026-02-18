'use client';

import { useMemo } from 'react';
import { useLayout } from './useLayout';
import { useSelection } from './useSelection';

/**
 * Determine which page the cursor is currently on.
 * Returns a 1-based page number.
 */
export function useCurrentPage(): number {
	const layout = useLayout();
	const selection = useSelection();

	return useMemo(() => {
		if (!layout || !selection) return 1;

		const focusPath = selection.focus.path;
		if (focusPath.length === 0) return 1;

		// Walk through pages to find which one contains the focus block.
		// The focus path starts with [bodyIdx, sectionIdx, blockIdx, ...].
		// Layout blocks store nodePath which matches the document path.
		// Simple heuristic: check each page's blocks for a matching nodePath prefix.
		for (let pi = 0; pi < layout.pages.length; pi++) {
			const page = layout.pages[pi];
			for (const block of page.blocks) {
				if ('nodePath' in block) {
					const blockPath = block.nodePath;
					if (pathMatches(blockPath, focusPath)) {
						return pi + 1;
					}
				}
				if ('path' in block) {
					const blockPath = (block as { path: readonly number[] }).path;
					if (pathMatches(blockPath, focusPath)) {
						return pi + 1;
					}
				}
			}
		}

		return 1;
	}, [layout, selection]);
}

function pathMatches(blockPath: readonly number[], focusPath: readonly number[]): boolean {
	if (blockPath.length === 0) return false;
	// Check if focus path starts with block path
	for (let i = 0; i < blockPath.length && i < focusPath.length; i++) {
		if (blockPath[i] !== focusPath[i]) return false;
	}
	return true;
}
