/**
 * Web Worker script for offloading DOCX import/export from the main thread.
 *
 * This module is designed to be bundled as an inline worker via blob URL.
 * It receives messages with typed requests and responds with results.
 */

import { exportDocx } from '../exporter/docx-exporter';
import { importDocx } from '../importer/docx-importer';
import { exportDoc } from '../rtf/rtf-exporter';
import { deserializeDocument, serializeDocument } from './serialization';
import type { WorkerRequest, WorkerResponse } from './worker-types';

// eslint-disable-next-line -- worker global
const workerSelf = self as unknown as {
	onmessage: ((event: MessageEvent) => void) | null;
	postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

workerSelf.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;

	try {
		let response: WorkerResponse;

		switch (request.type) {
			case 'import-docx': {
				const doc = importDocx(request.data, request.options);
				const json = serializeDocument(doc);
				response = { type: 'import-docx-result', documentJson: json };
				break;
			}
			case 'export-docx': {
				const doc = deserializeDocument(request.documentJson);
				const data = exportDocx(doc, request.options);
				response = { type: 'export-docx-result', data };
				workerSelf.postMessage(response, [data.buffer] as unknown as Transferable[]);
				return;
			}
			case 'export-doc': {
				const doc = deserializeDocument(request.documentJson);
				const data = exportDoc(doc, request.options);
				response = { type: 'export-doc-result', data };
				workerSelf.postMessage(response, [data.buffer] as unknown as Transferable[]);
				return;
			}
		}

		workerSelf.postMessage(response!);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const response: WorkerResponse = { type: 'error', message };
		workerSelf.postMessage(response);
	}
};
