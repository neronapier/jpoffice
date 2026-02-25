'use client';

import type { CollabProvider } from '@jpoffice/engine';
import { useEffect, useState } from 'react';

export interface UseOfflineReturn {
	isOnline: boolean;
	pendingOps: number;
}

/**
 * Hook to detect offline state and track pending operations.
 * Optionally accepts a CollabProvider to subscribe to pending ops count.
 */
export function useOffline(provider?: CollabProvider | null): UseOfflineReturn {
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== 'undefined' ? navigator.onLine : true,
	);
	const [pendingOps, setPendingOps] = useState(0);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	useEffect(() => {
		if (!provider) {
			setPendingOps(0);
			return;
		}
		const handler = (count: number) => setPendingOps(count);
		provider.onPendingOpsChange = handler;
		setPendingOps(provider.getPendingOpsCount());
		return () => {
			if (provider.onPendingOpsChange === handler) {
				provider.onPendingOpsChange = null;
			}
		};
	}, [provider]);

	return { isOnline, pendingOps };
}
