import type { AwarenessState, ConnectionStatus } from '@jpoffice/engine';
import { CollabProvider, WebSocketTransport } from '@jpoffice/engine';
import type { JPEditor } from '@jpoffice/engine';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Options for configuring the collaboration hook.
 */
export interface CollaborationOptions {
	/** Unique room identifier for the collaboration session. */
	readonly roomId: string;
	/** Unique user identifier. */
	readonly userId: string;
	/** Display name for the user. */
	readonly userName: string;
	/** WebSocket server URL (e.g., "wss://collab.example.com"). */
	readonly serverUrl: string;
	/** User color for cursor/selection display. */
	readonly userColor?: string;
}

/**
 * Return value of the useCollaboration hook.
 */
export interface CollaborationState {
	/** Current connection status. */
	readonly status: ConnectionStatus;
	/** List of remote users with their awareness state (cursor/selection). */
	readonly users: readonly AwarenessState[];
	/** Manually trigger a connection. */
	readonly connect: () => void;
	/** Manually disconnect from collaboration. */
	readonly disconnect: () => void;
	/** Send local operations to the collaboration server. */
	readonly sendOperations: (ops: readonly import('@jpoffice/model').JPOperation[]) => void;
}

/** Default colors for remote users (cycled). */
const DEFAULT_COLORS = [
	'#e91e63',
	'#9c27b0',
	'#673ab7',
	'#3f51b5',
	'#2196f3',
	'#009688',
	'#4caf50',
	'#ff9800',
	'#ff5722',
	'#795548',
];

/**
 * React hook for real-time collaboration on a JPOffice document.
 *
 * Provides connection management, awareness of remote users,
 * and integration with the editor's operation system.
 *
 * @param editor - The JPEditor instance to collaborate on. Pass null to disable.
 * @param options - Collaboration configuration. Pass null to disable.
 *
 * @example
 * ```tsx
 * const { status, users, connect, disconnect } = useCollaboration(editor, {
 *   roomId: 'doc-123',
 *   userId: 'user-abc',
 *   userName: 'Alice',
 *   serverUrl: 'wss://collab.example.com',
 * });
 * ```
 */
export function useCollaboration(
	editor: JPEditor | null,
	options: CollaborationOptions | null,
): CollaborationState {
	const [status, setStatus] = useState<ConnectionStatus>('disconnected');
	const [users, setUsers] = useState<readonly AwarenessState[]>([]);

	const providerRef = useRef<CollabProvider | null>(null);
	const transportRef = useRef<WebSocketTransport | null>(null);

	// Extract primitive values to use as stable deps (avoids object identity issues)
	const roomId = options?.roomId ?? null;
	const userId = options?.userId ?? null;
	const userName = options?.userName ?? null;
	const serverUrl = options?.serverUrl ?? null;
	const userColor = options?.userColor ?? null;

	// Stable ref for roomId so connect() callback can read latest
	const roomIdRef = useRef(roomId);
	roomIdRef.current = roomId;

	// Create and manage the provider
	useEffect(() => {
		if (!editor || !roomId || !userId || !userName || !serverUrl) {
			// Clean up if disabled
			providerRef.current?.destroy();
			providerRef.current = null;
			transportRef.current?.destroy();
			transportRef.current = null;
			setStatus('disconnected');
			setUsers([]);
			return;
		}

		const color = userColor ?? DEFAULT_COLORS[Math.abs(hashString(userId)) % DEFAULT_COLORS.length];

		const transport = new WebSocketTransport(serverUrl);
		const provider = new CollabProvider(
			editor,
			{
				clientId: userId,
				name: userName,
				color,
			},
			transport,
		);

		provider.onStatusChange = (newStatus) => {
			setStatus(newStatus);
		};

		provider.onAwarenessChange = (states) => {
			setUsers(Array.from(states.values()));
		};

		providerRef.current = provider;
		transportRef.current = transport;

		// Auto-connect
		provider.connect(roomId);

		return () => {
			provider.destroy();
			transport.destroy();
			providerRef.current = null;
			transportRef.current = null;
		};
	}, [editor, roomId, userId, userName, serverUrl, userColor]);

	const connect = useCallback(() => {
		const currentRoomId = roomIdRef.current;
		if (providerRef.current && currentRoomId) {
			providerRef.current.connect(currentRoomId);
		}
	}, []);

	const disconnect = useCallback(() => {
		providerRef.current?.disconnect();
	}, []);

	const sendOperations = useCallback((ops: readonly import('@jpoffice/model').JPOperation[]) => {
		providerRef.current?.sendOperations(ops);
	}, []);

	return {
		status,
		users,
		connect,
		disconnect,
		sendOperations,
	};
}

/**
 * Simple string hash for deterministic color assignment.
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0; // Convert to 32-bit integer
	}
	return hash;
}
