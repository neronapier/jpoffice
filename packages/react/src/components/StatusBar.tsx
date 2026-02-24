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
	padding: '4px 16px',
	fontSize: '12px',
	color: '#5f6368',
	borderTop: '1px solid #dadce0',
	backgroundColor: '#f9fbfd',
	userSelect: 'none',
	flexShrink: 0,
	height: 24,
};

/**
 * StatusBar displays document statistics: current page, word count, character count.
 */
export function StatusBar({ language, className, style }: StatusBarProps) {
	const stats = useDocumentStats();
	const currentPage = useCurrentPage();

	return (
		<output
			className={className}
			aria-live="polite"
			aria-label="Document status"
			style={{ ...defaultStyle, ...style }}
		>
			<span>{`Page ${currentPage} of ${stats.pageCount}`}</span>
			<span aria-hidden="true" style={{ color: '#dadce0' }}>
				|
			</span>
			<span>{`Words: ${stats.wordCount}`}</span>
			<span aria-hidden="true" style={{ color: '#dadce0' }}>
				|
			</span>
			<span>{`Characters: ${stats.charCount}`}</span>
			{language && (
				<>
					<span aria-hidden="true" style={{ color: '#dadce0' }}>
						|
					</span>
					<span>{language}</span>
				</>
			)}
		</output>
	);
}
