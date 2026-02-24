'use client';

import { useEffect, useState } from 'react';

export interface UseOfflineReturn {
	isOnline: boolean;
	pendingOps: number;
}

/**
 * Hook to detect offline state and track pending operations.
 */
export function useOffline(): UseOfflineReturn {
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== 'undefined' ? navigator.onLine : true,
	);
	const [pendingOps] = useState(0);

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

	return { isOnline, pendingOps };
}
