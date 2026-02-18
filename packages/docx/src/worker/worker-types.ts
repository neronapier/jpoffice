/**
 * Shared types for the DOCX Web Worker communication protocol.
 */

import type { DocxExportOptions } from '../exporter/docx-exporter';
import type { DocxImportOptions } from '../importer/docx-importer';
import type { DocExportOptions } from '../rtf/rtf-exporter';

export type WorkerRequest =
	| { type: 'import-docx'; data: Uint8Array; options?: DocxImportOptions }
	| { type: 'export-docx'; documentJson: string; options?: DocxExportOptions }
	| { type: 'export-doc'; documentJson: string; options?: DocExportOptions };

export type WorkerResponse =
	| { type: 'import-docx-result'; documentJson: string }
	| { type: 'export-docx-result'; data: Uint8Array }
	| { type: 'export-doc-result'; data: Uint8Array }
	| { type: 'error'; message: string };
