/**
 * Information about a connected collaboration client.
 */
export interface ClientInfo {
	readonly clientId: string;
	readonly name: string;
	readonly color: string;
}

/**
 * Awareness state broadcast by each client.
 * Contains identity info and cursor/selection position.
 */
export interface AwarenessState {
	readonly clientId: string;
	readonly name: string;
	readonly color: string;
	readonly cursor?: {
		readonly anchor: { readonly path: readonly number[]; readonly offset: number };
		readonly focus: { readonly path: readonly number[]; readonly offset: number };
	};
}

/**
 * Messages exchanged between collaboration clients and the server.
 *
 * - `op`: A client sends local operations to the server.
 * - `ack`: Server acknowledges a client's operation (with new version).
 * - `remote-op`: Server broadcasts a transformed operation from another client.
 * - `sync-request`: Client requests the full document state.
 * - `sync-response`: Server sends the full document state.
 * - `awareness`: Client broadcasts cursor/selection state.
 */
export interface SyncMessage {
	readonly type: 'op' | 'ack' | 'remote-op' | 'sync-request' | 'sync-response' | 'awareness';
	readonly clientId: string;
	readonly version: number;
	readonly payload: unknown;
}

/**
 * Connection status of the collaboration transport.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
