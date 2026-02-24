'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const barStyle: CSSProperties = {
	position: 'absolute',
	top: 8,
	right: 16,
	zIndex: 1500,
	display: 'flex',
	flexDirection: 'column',
	gap: 6,
	backgroundColor: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	padding: '10px 12px',
	boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
	fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
	fontSize: 13,
};

const rowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 6,
};

const inputStyle: CSSProperties = {
	width: 220,
	height: 28,
	padding: '4px 8px',
	border: '1px solid #dadce0',
	borderRadius: 4,
	fontSize: 13,
	outline: 'none',
	color: '#202124',
	boxSizing: 'border-box',
};

const smallBtnStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 28,
	height: 28,
	border: 'none',
	borderRadius: 4,
	backgroundColor: 'transparent',
	cursor: 'pointer',
	fontSize: 14,
	color: '#5f6368',
	padding: 0,
};

const actionBtnStyle: CSSProperties = {
	height: 28,
	padding: '0 12px',
	border: '1px solid #dadce0',
	borderRadius: 4,
	backgroundColor: '#fff',
	cursor: 'pointer',
	fontSize: 12,
	color: '#202124',
};

const counterStyle: CSSProperties = {
	fontSize: 12,
	color: '#70757a',
	minWidth: 50,
	textAlign: 'center',
};

export interface FindReplaceBarProps {
	open: boolean;
	showReplace: boolean;
	matchCount: number;
	currentIndex: number;
	onSearch: (term: string, caseSensitive: boolean) => void;
	onNext: () => void;
	onPrevious: () => void;
	onReplace: (replacement: string) => void;
	onReplaceAll: (replacement: string) => void;
	onClose: () => void;
	onToggleReplace: () => void;
}

export function FindReplaceBar({
	open,
	showReplace,
	matchCount,
	currentIndex,
	onSearch,
	onNext,
	onPrevious,
	onReplace,
	onReplaceAll,
	onClose,
	onToggleReplace,
}: FindReplaceBarProps) {
	const [searchTerm, setSearchTerm] = useState('');
	const [replacement, setReplacement] = useState('');
	const [caseSensitive, setCaseSensitive] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setTimeout(() => searchRef.current?.focus(), 0);
		}
	}, [open]);

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchTerm(value);
			onSearch(value, caseSensitive);
		},
		[caseSensitive, onSearch],
	);

	const toggleCase = useCallback(() => {
		const newCase = !caseSensitive;
		setCaseSensitive(newCase);
		if (searchTerm) onSearch(searchTerm, newCase);
	}, [caseSensitive, searchTerm, onSearch]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (e.shiftKey) {
					onPrevious();
				} else {
					onNext();
				}
			}
		},
		[onClose, onNext, onPrevious],
	);

	if (!open) return null;

	const counter =
		matchCount > 0 ? `${currentIndex + 1} of ${matchCount}` : searchTerm ? 'No results' : '';

	return (
		<div style={barStyle} onKeyDown={handleKeyDown}>
			{/* Search row */}
			<div style={rowStyle}>
				{/* Toggle replace */}
				<button
					type="button"
					style={smallBtnStyle}
					title={showReplace ? 'Hide replace' : 'Show replace'}
					onClick={onToggleReplace}
				>
					{showReplace ? '▼' : '▶'}
				</button>

				<input
					ref={searchRef}
					type="text"
					style={inputStyle}
					placeholder="Find in document..."
					value={searchTerm}
					onChange={(e) => handleSearchChange(e.target.value)}
				/>

				<span style={counterStyle}>{counter}</span>

				{/* Case sensitive toggle */}
				<button
					type="button"
					style={{
						...smallBtnStyle,
						backgroundColor: caseSensitive ? '#c8d7f5' : 'transparent',
						fontWeight: 'bold',
						fontSize: 12,
					}}
					title="Match case"
					onClick={toggleCase}
				>
					Aa
				</button>

				{/* Navigation */}
				<button
					type="button"
					style={smallBtnStyle}
					title="Previous (Shift+Enter)"
					onClick={onPrevious}
					disabled={matchCount === 0}
				>
					↑
				</button>
				<button
					type="button"
					style={smallBtnStyle}
					title="Next (Enter)"
					onClick={onNext}
					disabled={matchCount === 0}
				>
					↓
				</button>

				{/* Close */}
				<button type="button" style={smallBtnStyle} title="Close (Esc)" onClick={onClose}>
					✕
				</button>
			</div>

			{/* Replace row */}
			{showReplace && (
				<div style={{ ...rowStyle, paddingLeft: 34 }}>
					<input
						type="text"
						style={inputStyle}
						placeholder="Replace with..."
						value={replacement}
						onChange={(e) => setReplacement(e.target.value)}
					/>
					<button
						type="button"
						style={actionBtnStyle}
						title="Replace current match"
						onClick={() => onReplace(replacement)}
						disabled={matchCount === 0}
					>
						Replace
					</button>
					<button
						type="button"
						style={actionBtnStyle}
						title="Replace all matches"
						onClick={() => onReplaceAll(replacement)}
						disabled={matchCount === 0}
					>
						All
					</button>
				</div>
			)}
		</div>
	);
}
