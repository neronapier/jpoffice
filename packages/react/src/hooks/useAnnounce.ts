'use client';

import { useCallback, useId, useRef } from 'react';
import { createElement } from 'react';
import type { FC } from 'react';

/**
 * Visually hidden style for screen-reader-only content.
 * The element remains in the accessibility tree but is invisible.
 */
const srOnlyStyle: React.CSSProperties = {
	position: 'absolute',
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: 'hidden',
	clip: 'rect(0, 0, 0, 0)',
	whiteSpace: 'nowrap',
	border: 0,
};

/**
 * Hook that creates an aria-live region for screen reader announcements.
 *
 * Returns:
 * - `announce(message, priority?)` - triggers a screen reader announcement
 * - `AnnouncerRegion` - React component to render (contains hidden aria-live regions)
 *
 * Usage:
 * ```tsx
 * const { announce, AnnouncerRegion } = useAnnounce();
 * announce('Cursor moved to line 5');
 * announce('Error: could not paste', 'assertive');
 * // Render <AnnouncerRegion /> somewhere in the component tree
 * ```
 */
export function useAnnounce(): {
	announce: (message: string, priority?: 'polite' | 'assertive') => void;
	AnnouncerRegion: FC;
} {
	const politeRef = useRef<HTMLDivElement | null>(null);
	const assertiveRef = useRef<HTMLDivElement | null>(null);
	const uniqueId = useId();

	const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
		const el = priority === 'assertive' ? assertiveRef.current : politeRef.current;
		if (!el) return;

		// Clear and re-set to ensure screen readers re-announce
		el.textContent = '';
		// Use rAF to ensure the DOM change is detected as a new announcement
		requestAnimationFrame(() => {
			el.textContent = message;
		});
	}, []);

	const AnnouncerRegion: FC = useCallback(
		() =>
			createElement(
				'div',
				{ style: srOnlyStyle },
				createElement('div', {
					ref: politeRef,
					role: 'status',
					'aria-live': 'polite',
					'aria-atomic': 'true',
					id: `${uniqueId}-announce-polite`,
				}),
				createElement('div', {
					ref: assertiveRef,
					role: 'alert',
					'aria-live': 'assertive',
					'aria-atomic': 'true',
					id: `${uniqueId}-announce-assertive`,
				}),
			),
		[uniqueId],
	);

	return { announce, AnnouncerRegion };
}
