'use client';

import { useEffect, useRef, useState } from 'react';

export interface MentionSuggestion {
	readonly label: string;
	readonly value: string;
	readonly type: 'person' | 'file' | 'date';
	readonly avatar?: string;
}

export interface MentionAutocompleteProps {
	readonly suggestions: MentionSuggestion[];
	readonly position: { x: number; y: number };
	readonly onSelect: (suggestion: MentionSuggestion) => void;
	readonly onDismiss: () => void;
}

const containerStyle: React.CSSProperties = {
	position: 'absolute',
	background: '#fff',
	border: '1px solid #e0e0e0',
	borderRadius: 6,
	boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
	maxHeight: 240,
	overflowY: 'auto',
	width: 250,
	zIndex: 100,
	padding: 4,
};

const itemStyle: React.CSSProperties = {
	padding: '8px 12px',
	cursor: 'pointer',
	borderRadius: 4,
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	fontSize: 14,
};

const activeItemStyle: React.CSSProperties = {
	...itemStyle,
	background: '#e8f0fe',
};

const avatarStyle: React.CSSProperties = {
	width: 24,
	height: 24,
	borderRadius: '50%',
	background: '#4285f4',
	color: '#fff',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: 12,
	fontWeight: 600,
	flexShrink: 0,
};

export function MentionAutocomplete({
	suggestions,
	position,
	onSelect,
	onDismiss,
}: MentionAutocompleteProps) {
	const [activeIndex, setActiveIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setActiveIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (suggestions[activeIndex]) onSelect(suggestions[activeIndex]);
			} else if (e.key === 'Escape') {
				onDismiss();
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [activeIndex, suggestions, onSelect, onDismiss]);

	if (suggestions.length === 0) return null;

	return (
		<div ref={containerRef} style={{ ...containerStyle, left: position.x, top: position.y }}>
			{suggestions.map((s, i) => (
				<div
					key={s.value}
					tabIndex={-1}
					style={i === activeIndex ? activeItemStyle : itemStyle}
					onMouseEnter={() => setActiveIndex(i)}
					onClick={() => onSelect(s)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onSelect(s);
						}
					}}
				>
					<div style={avatarStyle}>{s.label.charAt(0).toUpperCase()}</div>
					<div>
						<div style={{ fontWeight: 500 }}>{s.label}</div>
						<div style={{ fontSize: 12, color: '#666' }}>{s.type}</div>
					</div>
				</div>
			))}
		</div>
	);
}
