'use client';

import type { JPDocument } from '@jpoffice/model';
import type { CSSProperties } from 'react';
import { JPOfficeEditor } from './JPOfficeEditor';

export interface JPOfficeViewerProps {
	document: JPDocument;
	className?: string;
	style?: CSSProperties;
}

/**
 * JPOfficeViewer is a read-only document viewer.
 * It renders the document without editing capabilities or toolbar.
 */
export function JPOfficeViewer({ document, className, style }: JPOfficeViewerProps) {
	return (
		<JPOfficeEditor
			document={document}
			readOnly
			showToolbar={false}
			className={className}
			style={style}
		/>
	);
}
