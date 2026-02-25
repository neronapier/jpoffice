import type { CollabTransport } from './collab-provider';
import type { ConnectionStatus, SyncMessage } from './types';

/**
 * Default WebSocket-based transport for collaboration.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Offline message queue (buffers sends while disconnected)
 * - Heartbeat/ping to detect connection loss
 */
export class WebSocketTransport implements CollabTransport {
	private ws: WebSocket | null = null;
	private roomId: string | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private messageHandler: ((msg: SyncMessage) => void) | null = null;
	private statusHandler: ((status: ConnectionStatus) => void) | null = null;

	/** Messages queued while disconnected. */
	private offlineQueue: SyncMessage[] = [];

	/** Whether the user explicitly called disconnect(). */
	private intentionalDisconnect = false;

	/** Callback when the offline queue length changes. */
	onQueueChange?: (length: number) => void;

	/** Maximum number of reconnection attempts before giving up. */
	readonly maxReconnectAttempts: number;

	/** Heartbeat interval in milliseconds. */
	readonly heartbeatInterval: number;

	/** Base delay for reconnection backoff (ms). */
	readonly reconnectBaseDelay: number;

	constructor(
		private readonly serverUrl: string,
		options?: {
			maxReconnectAttempts?: number;
			heartbeatInterval?: number;
			reconnectBaseDelay?: number;
		},
	) {
		this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 10;
		this.heartbeatInterval = options?.heartbeatInterval ?? 30000;
		this.reconnectBaseDelay = options?.reconnectBaseDelay ?? 1000;
	}

	// ── CollabTransport implementation ───────────────────────────

	connect(roomId: string): void {
		this.roomId = roomId;
		this.intentionalDisconnect = false;
		this.reconnectAttempts = 0;
		this.openConnection();
	}

	disconnect(): void {
		this.intentionalDisconnect = true;
		this.cleanup();
		this.setStatus('disconnected');
	}

	send(message: SyncMessage): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			// Queue for when we reconnect
			this.offlineQueue.push(message);
			this.onQueueChange?.(this.offlineQueue.length);
		}
	}

	onMessage(handler: (msg: SyncMessage) => void): void {
		this.messageHandler = handler;
	}

	onStatusChange(handler: (status: ConnectionStatus) => void): void {
		this.statusHandler = handler;
	}

	// ── Connection management ────────────────────────────────────

	private openConnection(): void {
		if (!this.roomId) return;

		this.cleanup();
		this.setStatus('connecting');

		const url = `${this.serverUrl}?room=${encodeURIComponent(this.roomId)}`;

		try {
			this.ws = new WebSocket(url);
		} catch {
			this.setStatus('error');
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			this.setStatus('connected');
			this.startHeartbeat();
			this.flushOfflineQueue();
		};

		this.ws.onmessage = (event) => {
			if (!this.messageHandler) return;
			try {
				const data =
					typeof event.data === 'string'
						? event.data
						: new TextDecoder().decode(event.data as ArrayBuffer);
				const msg = JSON.parse(data) as SyncMessage;
				this.messageHandler(msg);
			} catch {
				// Ignore malformed messages
			}
		};

		this.ws.onclose = () => {
			this.stopHeartbeat();
			if (!this.intentionalDisconnect) {
				this.setStatus('disconnected');
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			// The error event is followed by a close event, so we handle
			// reconnection in onclose. Just update status here.
			this.setStatus('error');
		};
	}

	// ── Reconnection ─────────────────────────────────────────────

	private scheduleReconnect(): void {
		if (this.intentionalDisconnect) return;
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.setStatus('error');
			return;
		}

		// Exponential backoff with jitter
		const delay = this.reconnectBaseDelay * 2 ** this.reconnectAttempts + Math.random() * 500;
		this.reconnectAttempts++;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!this.intentionalDisconnect) {
				this.openConnection();
			}
		}, delay);
	}

	// ── Heartbeat ────────────────────────────────────────────────

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				// Send a lightweight ping message
				this.ws.send(JSON.stringify({ type: 'ping' }));
			}
		}, this.heartbeatInterval);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	// ── Offline queue ────────────────────────────────────────────

	private flushOfflineQueue(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const queued = [...this.offlineQueue];
		this.offlineQueue = [];

		for (const msg of queued) {
			this.ws.send(JSON.stringify(msg));
		}

		if (queued.length > 0) {
			this.onQueueChange?.(0);
		}
	}

	// ── Cleanup ──────────────────────────────────────────────────

	private cleanup(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.stopHeartbeat();
		if (this.ws) {
			// Remove handlers to prevent callbacks during cleanup
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close();
			}
			this.ws = null;
		}
	}

	private setStatus(status: ConnectionStatus): void {
		this.statusHandler?.(status);
	}

	/**
	 * Destroy the transport, closing the connection and clearing all state.
	 */
	destroy(): void {
		this.disconnect();
		this.offlineQueue = [];
		this.messageHandler = null;
		this.statusHandler = null;
	}
}
