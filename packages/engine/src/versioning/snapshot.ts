import type { JPDocument } from '@jpoffice/model';

/**
 * A point-in-time snapshot of a document.
 */
export interface DocumentSnapshot {
	readonly id: string;
	readonly timestamp: number;
	readonly label?: string;
	readonly document: string; // JSON-serialized JPDocument
	readonly size: number; // approximate byte size
}

let _snapshotCounter = 0;

function generateSnapshotId(): string {
	return `snap_${Date.now()}_${++_snapshotCounter}`;
}

/**
 * Custom JSON replacer that handles Map and Uint8Array serialization.
 * - Map -> { __type: 'Map', entries: [...] }
 * - Uint8Array -> { __type: 'Uint8Array', data: base64string }
 */
function replacer(_key: string, value: unknown): unknown {
	if (value instanceof Map) {
		return {
			__type: 'Map',
			entries: Array.from(value.entries()),
		};
	}
	if (value instanceof Uint8Array) {
		return {
			__type: 'Uint8Array',
			data: uint8ArrayToBase64(value),
		};
	}
	return value;
}

/**
 * Custom JSON reviver that restores Map and Uint8Array.
 */
function reviver(_key: string, value: unknown): unknown {
	if (
		value !== null &&
		typeof value === 'object' &&
		'__type' in (value as Record<string, unknown>)
	) {
		const obj = value as Record<string, unknown>;
		if (obj.__type === 'Map') {
			return new Map(obj.entries as Array<[string, unknown]>);
		}
		if (obj.__type === 'Uint8Array') {
			return base64ToUint8Array(obj.data as string);
		}
	}
	return value;
}

/**
 * Convert a Uint8Array to a base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Serialize a JPDocument to a compact JSON string.
 * Handles Map and Uint8Array fields that are not natively JSON-serializable.
 */
export function serializeDocument(doc: JPDocument): string {
	return JSON.stringify(doc, replacer);
}

/**
 * Deserialize a JSON string back to a JPDocument.
 * Restores Map and Uint8Array fields from their serialized form.
 */
export function deserializeDocument(json: string): JPDocument {
	return JSON.parse(json, reviver) as JPDocument;
}

/**
 * Create a snapshot from a document.
 */
export function createSnapshot(doc: JPDocument, label?: string): DocumentSnapshot {
	const serialized = serializeDocument(doc);
	return {
		id: generateSnapshotId(),
		timestamp: Date.now(),
		label,
		document: serialized,
		size: serialized.length,
	};
}
