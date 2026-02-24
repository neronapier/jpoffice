'use client';

import type { AriaRole, CSSProperties, ReactNode } from 'react';

export interface ScrollContainerProps {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	role?: AriaRole;
	'aria-label'?: string;
}

export function ScrollContainer({
	children,
	className,
	style,
	role,
	'aria-label': ariaLabel,
}: ScrollContainerProps) {
	return (
		<div
			className={className}
			role={role}
			aria-label={ariaLabel}
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
