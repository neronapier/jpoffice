'use client';

import type { CSSProperties, ReactNode } from 'react';

export interface ScrollContainerProps {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

export function ScrollContainer({ children, className, style }: ScrollContainerProps) {
	return (
		<div
			className={className}
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				...style,
			}}
		>
			{children}
		</div>
	);
}
