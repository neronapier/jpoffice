import type { JPOperation } from '@jpoffice/model';

export interface Client {
	readonly id: string;
	readonly name: string;
	readonly color: string;
	send(data: string): void;
}

export interface AwarenessState {
	readonly clientId: string;
	readonly name: string;
	readonly color: string;
	readonly selection?: { anchor: number[]; focus: number[] };
	readonly cursor?: { path: number[]; offset: number };
}

/**
 * A collaboration room managing document state and connected clients.
 */
export class Room {
	readonly id: string;
	private version = 0;
	private clients = new Map<string, Client>();
	private opLog: Array<{
		version: number;
		clientId: string;
		ops: JPOperation[];
	}> = [];
	private awareness = new Map<string, AwarenessState>();

	constructor(id: string) {
		this.id = id;
	}

	getVersion(): number {
		return this.version;
	}

	getClientCount(): number {
		return this.clients.size;
	}

	addClient(client: Client): void {
		this.clients.set(client.id, client);
		// Notify others
		this.broadcastExcept(
			client.id,
			JSON.stringify({
				type: 'client-joined',
				clientId: client.id,
				name: client.name,
				color: client.color,
			}),
		);
		// Send current state to new client
		client.send(
			JSON.stringify({
				type: 'sync',
				version: this.version,
				clients: Array.from(this.clients.values()).map((c) => ({
					id: c.id,
					name: c.name,
					color: c.color,
				})),
				awareness: Array.from(this.awareness.values()),
			}),
		);
	}

	removeClient(clientId: string): void {
		this.clients.delete(clientId);
		this.awareness.delete(clientId);
		this.broadcastExcept(
			clientId,
			JSON.stringify({
				type: 'client-left',
				clientId,
			}),
		);
	}

	/**
	 * Apply operations from a client.
	 * Validates version, transforms against concurrent ops if needed,
	 * applies, and broadcasts.
	 */
	applyOps(clientId: string, clientVersion: number, ops: JPOperation[]): boolean {
		if (clientVersion > this.version) return false;

		// In a full implementation, we would collect concurrent ops:
		//   const concurrentOps = this.opLog
		//     .filter(e => e.version >= clientVersion && e.clientId !== clientId)
		//     .flatMap(e => e.ops);
		// ...and transform ops against them using transformOperationAgainstMany.
		// For now, we accept and broadcast (last-writer-wins for concurrent edits).
		this.version++;
		this.opLog.push({ version: this.version, clientId, ops });

		// Trim old ops (keep last 500)
		if (this.opLog.length > 1000) {
			this.opLog = this.opLog.slice(-500);
		}

		// Broadcast to all clients (including sender for ack)
		this.broadcast(
			JSON.stringify({
				type: 'ops',
				version: this.version,
				clientId,
				ops,
			}),
		);

		return true;
	}

	updateAwareness(clientId: string, state: Partial<AwarenessState>): void {
		const existing = this.awareness.get(clientId);
		const client = this.clients.get(clientId);
		if (!client) return;

		const updated: AwarenessState = {
			clientId,
			name: state.name ?? existing?.name ?? client.name,
			color: state.color ?? existing?.color ?? client.color,
			selection: state.selection ?? existing?.selection,
			cursor: state.cursor ?? existing?.cursor,
		};

		this.awareness.set(clientId, updated);
		this.broadcastExcept(
			clientId,
			JSON.stringify({
				type: 'awareness',
				state: updated,
			}),
		);
	}

	private broadcast(data: string): void {
		for (const client of this.clients.values()) {
			try {
				client.send(data);
			} catch {
				/* client disconnected */
			}
		}
	}

	private broadcastExcept(excludeId: string, data: string): void {
		for (const [id, client] of this.clients) {
			if (id === excludeId) continue;
			try {
				client.send(data);
			} catch {
				/* client disconnected */
			}
		}
	}
}
