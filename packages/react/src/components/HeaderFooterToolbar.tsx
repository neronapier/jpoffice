'use client';

/**
 * HeaderFooterToolbar displays a floating toolbar when editing headers/footers.
 * Provides buttons for inserting page numbers, toggling first-page/odd-even,
 * and closing the editor.
 */

import type { JPEditor } from '@jpoffice/engine';
import { useCallback } from 'react';
import type { CSSProperties, ReactElement } from 'react';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const toolbarStyle: CSSProperties = {
	position: 'absolute',
	top: 0,
	left: '50%',
	transform: 'translateX(-50%)',
	display: 'flex',
	alignItems: 'center',
	gap: 4,
	padding: '6px 12px',
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: '0 0 8px 8px',
	boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
	zIndex: 20,
	fontSize: 13,
};

const btnStyle: CSSProperties = {
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 12,
	color: '#3c4043',
	padding: '4px 10px',
	borderRadius: 4,
	whiteSpace: 'nowrap',
};

const closeBtnStyle: CSSProperties = {
	...btnStyle,
	background: '#1a73e8',
	color: '#fff',
	border: '1px solid #1a73e8',
	marginLeft: 8,
};

const separatorStyle: CSSProperties = {
	width: 1,
	height: 20,
	background: '#dadce0',
	margin: '0 4px',
};

const labelStyle: CSSProperties = {
	fontSize: 12,
	color: '#5f6368',
	marginRight: 4,
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface HeaderFooterToolbarProps {
	editor: JPEditor;
	zone: 'header' | 'footer';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HeaderFooterToolbar({ editor, zone }: HeaderFooterToolbarProps): ReactElement {
	const handleInsertPageNumber = useCallback(() => {
		editor.executeCommand('headerFooter.insertPageNumber');
	}, [editor]);

	const handleInsertPageCount = useCallback(() => {
		editor.executeCommand('headerFooter.insertPageCount');
	}, [editor]);

	const handleToggleFirstPage = useCallback(() => {
		editor.executeCommand('headerFooter.toggleDifferentFirstPage');
	}, [editor]);

	const handleToggleOddEven = useCallback(() => {
		editor.executeCommand('headerFooter.toggleDifferentOddEven');
	}, [editor]);

	const handleClose = useCallback(() => {
		editor.executeCommand('headerFooter.exitEdit');
	}, [editor]);

	return (
		<div style={toolbarStyle}>
			<span style={labelStyle}>{zone === 'header' ? 'Header' : 'Footer'}</span>
			<div style={separatorStyle} />
			<button
				type="button"
				style={btnStyle}
				onClick={handleInsertPageNumber}
				title="Insert page number"
			>
				Page #
			</button>
			<button
				type="button"
				style={btnStyle}
				onClick={handleInsertPageCount}
				title="Insert total pages"
			>
				Total Pages
			</button>
			<div style={separatorStyle} />
			<button
				type="button"
				style={btnStyle}
				onClick={handleToggleFirstPage}
				title="Different first page"
			>
				First Page
			</button>
			<button
				type="button"
				style={btnStyle}
				onClick={handleToggleOddEven}
				title="Different odd/even pages"
			>
				Odd/Even
			</button>
			<div style={separatorStyle} />
			<button type="button" style={closeBtnStyle} onClick={handleClose}>
				Close
			</button>
		</div>
	);
}
