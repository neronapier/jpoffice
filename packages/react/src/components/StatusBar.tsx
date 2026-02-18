'use client';

import type { CSSProperties } from 'react';
import { useCurrentPage } from '../hooks/useCurrentPage';
import { useDocumentStats } from '../hooks/useDocumentStats';

export interface StatusBarProps {
	language?: string;
	className?: string;
	style?: CSSProperties;
}

const defaultStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '16px',
	padding: '4px 12px',
	fontSize: '12px',
	color: '#666',
	borderTop: '1px solid #e0e0e0',
	backgroundColor: '#fafafa',
	userSelect: 'none',
	flexShrink: 0,
};

/**
 * StatusBar displays document statistics: current page, word count, character count.
 */
export function StatusBar({ language, className, style }: StatusBarProps) {
	const stats = useDocumentStats();
	const currentPage = useCurrentPage();

	return (
		<div className={className} style={{ ...defaultStyle, ...style }}>
			<span>{`Page ${currentPage} of ${stats.pageCount}`}</span>
			<span style={{ color: '#ccc' }}>|</span>
			<span>{`Words: ${stats.wordCount}`}</span>
			<span style={{ color: '#ccc' }}>|</span>
			<span>{`Characters: ${stats.charCount}`}</span>
			{language && (
				<>
					<span style={{ color: '#ccc' }}>|</span>
					<span>{language}</span>
				</>
			)}
		</div>
	);
}
