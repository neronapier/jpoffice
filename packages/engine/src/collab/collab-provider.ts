import type { JPDocument, JPOperation } from '@jpoffice/model';
import type { JPEditor } from '../editor';
import {
	transformManyAgainstOperation,
	transformOperationAgainstMany,
} from './operation-transform';
import type { AwarenessState, ClientInfo, ConnectionStatus, SyncMessage } from './types';

/**
 * Transport interface for sending/receiving collaboration messages.
 * Implementations can use WebSocket, WebRTC, or any other protocol.
 */
export interface CollabTransport {
	/** Send a message to the collaboration server. */
	send(message: SyncMessage): void;
	/** Register a handler for incoming messages. */
	onMessage(handler: (message: SyncMessage) => void): void;
	/** Connect to a collaboration room. */
	connect(roomId: string): void;
	/** Disconnect from the current room. */
	disconnect(): void;
	/** Register a handler for connection status changes. */
	onStatusChange?(handler: (status: ConnectionStatus) => void): void;
}

/**
 * State of the OT client.
 *
 * The client can be in one of three states:
 * - `synchronized`: No pending ops. The local version matches the server.
 * - `awaiting-ack`: We sent ops to the server and are waiting for acknowledgment.
 * - `awaiting-ack-with-buffer`: While waiting for ack, more local ops were made.
 *   These are buffered and will be sent after the current ack arrives.
 */
type OTClientState = 'synchronized' | 'awaiting-ack' | 'awaiting-ack-with-buffer';

/**
 * CollabProvider implements the OT client protocol.
 *
 * It intercepts local editor operations, sends them to the server,
 * and applies incoming remote operations with proper transformation.
 *
 * Protocol:
 * 1. Local operations are sent to the server tagged with the current version.
 * 2. The server applies OT to reconcile concurrent edits and broadcasts.
 * 3. When we receive `ack` for our op, we advance version and flush buffer.
 * 4. When we receive `remote-op`, we transform against pending/buffer ops and apply.
 */
export class CollabProvider {
	private editor: JPEditor;
	private clientInfo: ClientInfo;
	private transport: CollabTransport;

	/** Server-confirmed document version. */
	private version = 0;

	/** OT client state machine. */
	private otState: OTClientState = 'synchronized';

	/** Operations sent to server but not yet acknowledged. */
	private pendingOps: JPOperation[] = [];

	/** Operations buffered while waiting for ack. */
	private buffer: JPOperation[] = [];

	/** Remote users' awareness states. */
	private awareness: Map<string, AwarenessState> = new Map();

	/** Current connection status. */
	private status: ConnectionStatus = 'disconnected';

	/** Whether the provider is actively collaborating. */
	private active = false;

	/** Unsubscribe from editor changes. */
	private unsubscribe: (() => void) | null = null;

	/** Debounce timer for awareness updates. */
	private awarenessTimer: ReturnType<typeof setTimeout> | null = null;

	/** Callback when remote awareness changes. */
	onAwarenessChange: ((states: ReadonlyMap<string, AwarenessState>) => void) | null = null;

	/** Callback when connection status changes. */
	onStatusChange: ((status: ConnectionStatus) => void) | null = null;

	/** Callback when pending ops count changes. */
	onPendingOpsChange: ((count: number) => void) | null = null;

	/** Flag to avoid re-entrant apply during remote op application. */
	private applyingRemote = false;

	constructor(editor: JPEditor, clientInfo: ClientInfo, transport: CollabTransport) {
		this.editor = editor;
		this.clientInfo = clientInfo;
		this.transport = transport;
	}

	// ── Public API ───────────────────────────────────────────────

	/**
	 * Start collaboration on a room.
	 */
	connect(roomId: string): void {
		if (this.active) return;
		this.active = true;

		// Listen for incoming messages
		this.transport.onMessage((msg) => this.handleMessage(msg));

		// Listen for status changes
		this.transport.onStatusChange?.((s) => this.setStatus(s));

		// Connect transport
		this.setStatus('connecting');
		this.transport.connect(roomId);

		// Subscribe to local editor changes to intercept ops
		this.unsubscribe = this.editor.subscribe(() => {
			if (this.applyingRemote) return;
			this.broadcastAwareness();
		});
	}

	/**
	 * Stop collaboration.
	 */
	disconnect(): void {
		if (!this.active) return;
		this.active = false;

		this.transport.disconnect();
		this.unsubscribe?.();
		this.unsubscribe = null;

		if (this.awarenessTimer) {
			clearTimeout(this.awarenessTimer);
			this.awarenessTimer = null;
		}

		this.pendingOps = [];
		this.buffer = [];
		this.otState = 'synchronized';
		this.awareness.clear();
		this.setStatus('disconnected');
	}

	/**
	 * Get remote users' awareness states (excludes self).
	 */
	getAwareness(): ReadonlyMap<string, AwarenessState> {
		return this.awareness;
	}

	/**
	 * Get current connection status.
	 */
	getStatus(): ConnectionStatus {
		return this.status;
	}

	/**
	 * Send local operations to the collaboration server.
	 * Call this after applying operations to the editor locally.
	 */
	sendOperations(ops: readonly JPOperation[]): void {
		if (!this.active || ops.length === 0) return;

		switch (this.otState) {
			case 'synchronized': {
				// Send immediately
				this.pendingOps = [...ops];
				this.otState = 'awaiting-ack';
				this.transport.send({
					type: 'op',
					clientId: this.clientInfo.clientId,
					version: this.version,
					payload: ops,
				});
				break;
			}
			case 'awaiting-ack': {
				// Buffer while waiting for ack
				this.buffer.push(...ops);
				this.otState = 'awaiting-ack-with-buffer';
				break;
			}
			case 'awaiting-ack-with-buffer': {
				// Add to existing buffer
				this.buffer.push(...ops);
				break;
			}
		}
		this.notifyPendingOpsChange();
	}

	/**
	 * Get the current server version.
	 */
	getVersion(): number {
		return this.version;
	}

	/**
	 * Get the total number of pending (unacknowledged) operations.
	 */
	getPendingOpsCount(): number {
		return this.pendingOps.length + this.buffer.length;
	}

	// ── Message handling ─────────────────────────────────────────

	private handleMessage(msg: SyncMessage): void {
		switch (msg.type) {
			case 'ack':
				this.handleAck(msg);
				break;
			case 'remote-op':
				this.handleRemoteOp(msg);
				break;
			case 'sync-response':
				this.handleSyncResponse(msg);
				break;
			case 'awareness':
				this.handleAwareness(msg);
				break;
		}
	}

	/**
	 * Handle acknowledgment of our own operation.
	 * The server confirmed our op at the given version.
	 */
	private handleAck(msg: SyncMessage): void {
		this.version = msg.version;

		switch (this.otState) {
			case 'awaiting-ack': {
				// Our pending ops are confirmed
				this.pendingOps = [];
				this.otState = 'synchronized';
				break;
			}
			case 'awaiting-ack-with-buffer': {
				// Pending ops confirmed -- send the buffer
				this.pendingOps = [...this.buffer];
				this.buffer = [];
				this.otState = 'awaiting-ack';
				this.transport.send({
					type: 'op',
					clientId: this.clientInfo.clientId,
					version: this.version,
					payload: this.pendingOps,
				});
				break;
			}
			case 'synchronized': {
				// Unexpected ack -- ignore
				break;
			}
		}
		this.notifyPendingOpsChange();
	}

	/**
	 * Handle a remote operation from another client.
	 * We need to transform it against our pending/buffer ops and apply.
	 */
	private handleRemoteOp(msg: SyncMessage): void {
		this.version = msg.version;

		const remoteOps = msg.payload as JPOperation[];
		if (!remoteOps || remoteOps.length === 0) return;

		// Transform remote ops against our pending ops
		let transformedRemote = remoteOps;
		let newPending = this.pendingOps;

		// Transform each remote op against pending, updating both sides
		for (const remoteOp of transformedRemote) {
			const transformedOps: JPOperation[] = [];
			let currentRemote = remoteOp;
			const updatedPending: JPOperation[] = [];

			for (const pendingOp of newPending) {
				const transformedPending = transformManyAgainstOperation([pendingOp], currentRemote);
				currentRemote = transformOperationAgainstMany(currentRemote, [pendingOp]);
				updatedPending.push(...transformedPending);
			}

			newPending = updatedPending;
			transformedOps.push(currentRemote);
			transformedRemote = transformedOps;
		}

		this.pendingOps = newPending;

		// Also transform against buffer if present
		if (this.buffer.length > 0) {
			let newBuffer = this.buffer;
			for (const remoteOp of transformedRemote) {
				const updatedBuffer: JPOperation[] = [];
				let currentRemote = remoteOp;
				for (const bufOp of newBuffer) {
					const transformedBuf = transformManyAgainstOperation([bufOp], currentRemote);
					currentRemote = transformOperationAgainstMany(currentRemote, [bufOp]);
					updatedBuffer.push(...transformedBuf);
				}
				newBuffer = updatedBuffer;
				transformedRemote = [currentRemote];
			}
			this.buffer = newBuffer;
		}

		// Apply the transformed remote operations to the editor
		this.applyRemoteOps(transformedRemote);
	}

	/**
	 * Handle a full document sync response.
	 * This replaces the entire document state.
	 */
	private handleSyncResponse(msg: SyncMessage): void {
		const payload = msg.payload as {
			document: JPDocument;
			version: number;
		};
		this.version = payload.version;
		this.pendingOps = [];
		this.buffer = [];
		this.otState = 'synchronized';
		this.editor.setDocument(payload.document);
		this.setStatus('connected');
	}

	/**
	 * Handle awareness update from a remote client.
	 */
	private handleAwareness(msg: SyncMessage): void {
		if (msg.clientId === this.clientInfo.clientId) return;
		const state = msg.payload as AwarenessState;
		if (state) {
			this.awareness.set(msg.clientId, state);
		} else {
			this.awareness.delete(msg.clientId);
		}
		this.onAwarenessChange?.(this.awareness);
	}

	// ── Internal helpers ─────────────────────────────────────────

	/**
	 * Apply remote operations to the editor without triggering
	 * the local operation send flow.
	 */
	private applyRemoteOps(ops: readonly JPOperation[]): void {
		this.applyingRemote = true;
		try {
			for (const op of ops) {
				// Skip no-op operations (e.g., empty text inserts/deletes)
				if (op.type === 'insert_text' && op.text === '') continue;
				if (op.type === 'delete_text' && op.text === '') continue;
				if (op.type === 'remove_node' && op.path.length === 1 && op.path[0] === -1) continue;

				this.editor.apply(op);
			}
		} finally {
			this.applyingRemote = false;
		}
	}

	/**
	 * Broadcast our cursor/selection state to other clients.
	 * Debounced to avoid flooding the network.
	 */
	private broadcastAwareness(): void {
		if (this.awarenessTimer) {
			clearTimeout(this.awarenessTimer);
		}
		this.awarenessTimer = setTimeout(() => {
			this.awarenessTimer = null;
			if (!this.active) return;

			const selection = this.editor.getSelection();
			const awarenessState: AwarenessState = {
				clientId: this.clientInfo.clientId,
				name: this.clientInfo.name,
				color: this.clientInfo.color,
				cursor: selection
					? {
							anchor: {
								path: [...selection.anchor.path],
								offset: selection.anchor.offset,
							},
							focus: {
								path: [...selection.focus.path],
								offset: selection.focus.offset,
							},
						}
					: undefined,
			};

			this.transport.send({
				type: 'awareness',
				clientId: this.clientInfo.clientId,
				version: this.version,
				payload: awarenessState,
			});
		}, 50);
	}

	/**
	 * Request a full document sync from the server.
	 */
	requestSync(): void {
		this.transport.send({
			type: 'sync-request',
			clientId: this.clientInfo.clientId,
			version: this.version,
			payload: null,
		});
	}

	private notifyPendingOpsChange(): void {
		this.onPendingOpsChange?.(this.getPendingOpsCount());
	}

	private setStatus(status: ConnectionStatus): void {
		if (this.status === status) return;
		this.status = status;
		this.onStatusChange?.(status);

		if (status === 'connected') {
			// Request sync when first connected
			this.requestSync();
		}
	}

	/**
	 * Destroy the provider, disconnecting and cleaning up.
	 */
	destroy(): void {
		this.disconnect();
		this.onAwarenessChange = null;
		this.onStatusChange = null;
		this.onPendingOpsChange = null;
	}
}
