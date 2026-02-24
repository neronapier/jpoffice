import type { JPOperation } from '@jpoffice/model';

/** IndexedDB adapter for offline document storage and op queue. */
export class OfflineStore {
	private dbName: string;
	private db: IDBDatabase | null = null;

	constructor(dbName = 'jpoffice-offline') {
		this.dbName = dbName;
	}

	async open(): Promise<void> {
		if (typeof indexedDB === 'undefined') return;
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('documents')) {
					db.createObjectStore('documents', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('opQueue')) {
					db.createObjectStore('opQueue', {
						keyPath: 'id',
						autoIncrement: true,
					});
				}
			};
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};
			request.onerror = () => reject(request.error);
		});
	}

	async saveDocument(id: string, data: unknown): Promise<void> {
		if (!this.db) return;
		const tx = this.db.transaction('documents', 'readwrite');
		tx.objectStore('documents').put({ id, data, savedAt: Date.now() });
	}

	async loadDocument(id: string): Promise<unknown | null> {
		if (!this.db) return null;
		return new Promise((resolve) => {
			const tx = this.db!.transaction('documents', 'readonly');
			const req = tx.objectStore('documents').get(id);
			req.onsuccess = () => resolve(req.result?.data ?? null);
			req.onerror = () => resolve(null);
		});
	}

	async queueOp(op: JPOperation): Promise<void> {
		if (!this.db) return;
		const tx = this.db.transaction('opQueue', 'readwrite');
		tx.objectStore('opQueue').add({ op, timestamp: Date.now() });
	}

	async flushQueue(): Promise<JPOperation[]> {
		if (!this.db) return [];
		return new Promise((resolve) => {
			const tx = this.db!.transaction('opQueue', 'readwrite');
			const store = tx.objectStore('opQueue');
			const req = store.getAll();
			req.onsuccess = () => {
				const entries = req.result || [];
				store.clear();
				resolve(entries.map((e: { op: JPOperation }) => e.op));
			};
			req.onerror = () => resolve([]);
		});
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}
}
