'use client';

import { useCallback, useEffect, useState } from 'react';

/** Named breakpoint tiers. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** Responsive state returned by the hook. */
export interface ResponsiveState {
	/** Current named breakpoint. */
	breakpoint: Breakpoint;
	/** True when the viewport width is < 768px. */
	isMobile: boolean;
	/** True when the viewport width is >= 768px and <= 1024px. */
	isTablet: boolean;
	/** True when the viewport width is > 1024px. */
	isDesktop: boolean;
	/** True when the device supports touch input. */
	isTouchDevice: boolean;
	/** Current viewport width in pixels. */
	width: number;
}

/** Breakpoint thresholds in pixels. */
const MOBILE_MAX = 768;
const TABLET_MAX = 1024;

/** Debounce delay for resize events in milliseconds. */
const RESIZE_DEBOUNCE_MS = 150;

function detectTouchDevice(): boolean {
	if (typeof window === 'undefined') return false;
	return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function getBreakpoint(width: number): Breakpoint {
	if (width < MOBILE_MAX) return 'mobile';
	if (width <= TABLET_MAX) return 'tablet';
	return 'desktop';
}

function computeState(width: number): ResponsiveState {
	const breakpoint = getBreakpoint(width);
	return {
		breakpoint,
		isMobile: breakpoint === 'mobile',
		isTablet: breakpoint === 'tablet',
		isDesktop: breakpoint === 'desktop',
		isTouchDevice: detectTouchDevice(),
		width,
	};
}

/**
 * Hook that detects viewport size and returns responsive breakpoints.
 *
 * Breakpoint thresholds:
 * - mobile:  width < 768px
 * - tablet:  768px <= width <= 1024px
 * - desktop: width > 1024px
 *
 * Also detects whether the device supports touch input.
 *
 * The resize listener is debounced to avoid excessive re-renders.
 *
 * SSR-safe: returns desktop defaults when window is not available.
 */
export function useResponsive(): ResponsiveState {
	const [state, setState] = useState<ResponsiveState>(() => {
		if (typeof window === 'undefined') {
			// SSR fallback: assume desktop, no touch
			return {
				breakpoint: 'desktop',
				isMobile: false,
				isTablet: false,
				isDesktop: true,
				isTouchDevice: false,
				width: 1280,
			};
		}
		return computeState(window.innerWidth);
	});

	const handleResize = useCallback(() => {
		setState(computeState(window.innerWidth));
	}, []);

	useEffect(() => {
		// Run once on mount to correct SSR defaults
		handleResize();

		let timer: ReturnType<typeof setTimeout> | null = null;

		const debouncedResize = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(handleResize, RESIZE_DEBOUNCE_MS);
		};

		window.addEventListener('resize', debouncedResize);
		return () => {
			window.removeEventListener('resize', debouncedResize);
			if (timer) clearTimeout(timer);
		};
	}, [handleResize]);

	return state;
}
