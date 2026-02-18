/**
 * Worker client API for async DOCX import/export.
 *
 * Provides Promise-based wrappers that offload heavy processing to a Web Worker.
 * Falls back to synchronous execution when Workers are unavailable (SSR).
 */

import type { JPDocument } from '@jpoffice/model';
import type { DocxExportOptions } from '../exporter/docx-exporter';
import type { DocxImportOptions } from '../importer/docx-importer';
import type { DocExportOptions } from '../rtf/rtf-exporter';
import { deserializeDocument, serializeDocument } from './serialization';
import type { WorkerRequest, WorkerResponse } from './worker-types';

let workerInstance: Worker | null = null;

function getOrCreateWorker(): Worker | null {
	if (typeof Worker === 'undefined') return null;

	if (!workerInstance) {
		try {
			// Create worker from the same module path — bundlers (Vite, webpack)
			// handle the worker import. We use a dynamic import URL pattern.
			const blob = new Blob(['import "./docx-worker";'], { type: 'application/javascript' });
			workerInstance = new Worker(URL.createObjectURL(blob), { type: 'module' });
		} catch {
			return null;
		}
	}
	return workerInstance;
}

function postAndWait(request: WorkerRequest, transfer?: Transferable[]): Promise<WorkerResponse> {
	const worker = getOrCreateWorker();
	if (!worker) {
		return Promise.reject(new Error('Web Workers not available'));
	}

	return new Promise((resolve, reject) => {
		const handler = (event: MessageEvent<WorkerResponse>) => {
			worker.removeEventListener('message', handler);
			worker.removeEventListener('error', errorHandler);
			if (event.data.type === 'error') {
				reject(new Error(event.data.message));
			} else {
				resolve(event.data);
			}
		};
		const errorHandler = (event: ErrorEvent) => {
			worker.removeEventListener('message', handler);
			worker.removeEventListener('error', errorHandler);
			reject(new Error(event.message));
		};
		worker.addEventListener('message', handler);
		worker.addEventListener('error', errorHandler);
		worker.postMessage(request, transfer ?? []);
	});
}

/**
 * Import a DOCX file asynchronously using a Web Worker.
 * Falls back to synchronous import if Workers are unavailable.
 */
export async function importDocxAsync(
	data: Uint8Array,
	options?: DocxImportOptions,
): Promise<JPDocument> {
	try {
		const response = await postAndWait({ type: 'import-docx', data, options }, [data.buffer]);
		if (response.type === 'import-docx-result') {
			return deserializeDocument(response.documentJson);
		}
		throw new Error('Unexpected worker response');
	} catch {
		// Fallback to synchronous
		const { importDocx } = await import('../importer/docx-importer');
		return importDocx(data, options);
	}
}

/**
 * Export a JPDocument to DOCX asynchronously using a Web Worker.
 * Falls back to synchronous export if Workers are unavailable.
 */
export async function exportDocxAsync(
	doc: JPDocument,
	options?: DocxExportOptions,
): Promise<Uint8Array> {
	try {
		const json = serializeDocument(doc);
		const response = await postAndWait({ type: 'export-docx', documentJson: json, options });
		if (response.type === 'export-docx-result') {
			return response.data;
		}
		throw new Error('Unexpected worker response');
	} catch {
		const { exportDocx } = await import('../exporter/docx-exporter');
		return exportDocx(doc, options);
	}
}

/**
 * Export a JPDocument to RTF/.doc asynchronously using a Web Worker.
 * Falls back to synchronous export if Workers are unavailable.
 */
export async function exportDocAsync(
	doc: JPDocument,
	options?: DocExportOptions,
): Promise<Uint8Array> {
	try {
		const json = serializeDocument(doc);
		const response = await postAndWait({ type: 'export-doc', documentJson: json, options });
		if (response.type === 'export-doc-result') {
			return response.data;
		}
		throw new Error('Unexpected worker response');
	} catch {
		const { exportDoc } = await import('../rtf/rtf-exporter');
		return exportDoc(doc, options);
	}
}

/** Terminate the worker if it exists. */
export function terminateDocxWorker(): void {
	if (workerInstance) {
		workerInstance.terminate();
		workerInstance = null;
	}
}
