'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface ContextMenuItem {
	id: string;
	label: string;
	shortcut?: string;
	icon?: ReactNode;
	badge?: string;
	disabled?: boolean;
	submenu?: boolean;
}

export interface ContextMenuGroup {
	items: ContextMenuItem[];
}

export interface ContextMenuProps {
	x: number;
	y: number;
	groups: ContextMenuGroup[];
	onAction: (id: string) => void;
	onClose: () => void;
}

const overlayStyle: CSSProperties = {
	position: 'fixed',
	inset: 0,
	zIndex: 9999,
};

const menuStyle: CSSProperties = {
	position: 'fixed',
	backgroundColor: '#fff',
	borderRadius: 8,
	boxShadow: '0 2px 6px 2px rgba(60,64,67,0.15), 0 1px 2px rgba(60,64,67,0.3)',
	padding: '6px 0',
	minWidth: 260,
	zIndex: 10000,
	fontFamily: "'Google Sans Text', Roboto, sans-serif",
	fontSize: 13,
	color: '#202124',
};

const itemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 12,
	padding: '6px 16px',
	border: 'none',
	background: 'none',
	width: '100%',
	textAlign: 'left',
	cursor: 'pointer',
	fontSize: 13,
	color: '#202124',
	borderRadius: 0,
	lineHeight: '20px',
};

const separatorStyle: CSSProperties = {
	height: 1,
	backgroundColor: '#e8eaed',
	margin: '6px 0',
};

const shortcutStyle: CSSProperties = {
	marginLeft: 'auto',
	color: '#80868b',
	fontSize: 12,
	whiteSpace: 'nowrap',
	paddingLeft: 24,
};

const iconWrapStyle: CSSProperties = {
	width: 20,
	height: 20,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	color: '#5f6368',
	flexShrink: 0,
};

const badgeStyle: CSSProperties = {
	marginLeft: 8,
	backgroundColor: '#1a73e8',
	color: '#fff',
	fontSize: 10,
	fontWeight: 600,
	padding: '1px 6px',
	borderRadius: 4,
	lineHeight: '16px',
};

export function ContextMenu({ x, y, groups, onAction, onClose }: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const focusedIndexRef = useRef(-1);

	// Collect all non-disabled items for keyboard navigation
	const getAllItems = useCallback((): HTMLElement[] => {
		const menu = menuRef.current;
		if (!menu) return [];
		return Array.from(
			menu.querySelectorAll<HTMLElement>('button[role="menuitem"]:not([disabled])'),
		);
	}, []);

	const focusItem = useCallback(
		(index: number) => {
			const items = getAllItems();
			if (items.length === 0) return;
			const clamped = ((index % items.length) + items.length) % items.length;
			focusedIndexRef.current = clamped;
			items[clamped]?.focus();
		},
		[getAllItems],
	);

	// Adjust position to keep menu within viewport
	const adjustedPos = useCallback(() => {
		const menu = menuRef.current;
		if (!menu) return { left: x, top: y };
		const rect = menu.getBoundingClientRect();
		let left = x;
		let top = y;
		if (x + rect.width > window.innerWidth - 8) {
			left = window.innerWidth - rect.width - 8;
		}
		if (y + rect.height > window.innerHeight - 8) {
			top = window.innerHeight - rect.height - 8;
		}
		return { left: Math.max(8, left), top: Math.max(8, top) };
	}, [x, y]);

	useEffect(() => {
		const menu = menuRef.current;
		if (!menu) return;
		const pos = adjustedPos();
		menu.style.left = `${pos.left}px`;
		menu.style.top = `${pos.top}px`;

		// Focus the first item when menu opens
		requestAnimationFrame(() => {
			focusItem(0);
		});
	}, [adjustedPos, focusItem]);

	// Keyboard navigation: Escape, ArrowUp, ArrowDown, Enter
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'Escape':
					e.preventDefault();
					onClose();
					break;
				case 'ArrowDown':
					e.preventDefault();
					focusItem(focusedIndexRef.current + 1);
					break;
				case 'ArrowUp':
					e.preventDefault();
					focusItem(focusedIndexRef.current - 1);
					break;
				case 'Tab':
					// Trap focus within the context menu
					e.preventDefault();
					break;
				case 'Enter':
				case ' ': {
					e.preventDefault();
					const items = getAllItems();
					const idx = focusedIndexRef.current;
					if (idx >= 0 && idx < items.length) {
						items[idx]?.click();
					}
					break;
				}
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, [onClose, focusItem, getAllItems]);

	return (
		<>
			{/* Invisible overlay to catch clicks outside */}
			<div
				role="presentation"
				style={overlayStyle}
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') onClose();
				}}
				onContextMenu={(e) => {
					e.preventDefault();
					onClose();
				}}
			/>
			<div
				ref={menuRef}
				role="menu"
				aria-label="Context menu"
				style={{ ...menuStyle, left: x, top: y }}
			>
				{groups.map((group, gi) => (
					<div key={group.items[0]?.id ?? gi}>
						{gi > 0 && <hr style={{ ...separatorStyle, border: 'none' }} />}
						{group.items.map((item) => (
							<button
								key={item.id}
								type="button"
								role="menuitem"
								aria-disabled={item.disabled || undefined}
								tabIndex={-1}
								style={{
									...itemStyle,
									opacity: item.disabled ? 0.4 : 1,
									cursor: item.disabled ? 'default' : 'pointer',
								}}
								onClick={() => {
									if (!item.disabled) {
										onAction(item.id);
										onClose();
									}
								}}
								onMouseEnter={(e) => {
									if (!item.disabled) e.currentTarget.style.backgroundColor = '#f1f3f4';
									// Update focus tracking when hovering
									const items = getAllItems();
									const idx = items.indexOf(e.currentTarget);
									if (idx !== -1) focusedIndexRef.current = idx;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.backgroundColor = 'transparent';
								}}
							>
								<span style={iconWrapStyle} aria-hidden="true">
									{item.icon}
								</span>
								<span>{item.label}</span>
								{item.badge && <span style={badgeStyle}>{item.badge}</span>}
								{item.submenu && (
									<span style={shortcutStyle} aria-hidden="true">
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="#80868b"
											role="img"
											aria-hidden="true"
										>
											<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
										</svg>
									</span>
								)}
								{item.shortcut && !item.submenu && (
									<span style={shortcutStyle}>{item.shortcut}</span>
								)}
							</button>
						))}
					</div>
				))}
			</div>
		</>
	);
}

// --- Default menu icons ---

const cmIcon = (d: string) => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
		<path d={d} />
	</svg>
);

export const contextMenuIcons = {
	cut: cmIcon(
		'M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z',
	),
	copy: cmIcon(
		'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
	),
	paste: cmIcon(
		'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z',
	),
	pasteNoFormat: cmIcon(
		'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z',
	),
	delete: cmIcon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
	sparkle: cmIcon(
		'M19.46 8l.79-1.75L22 5.46c.39-.18.39-.73 0-.91l-1.75-.79L19.46 2c-.18-.39-.73-.39-.91 0l-.79 1.75-1.76.79c-.39.18-.39.73 0 .91l1.75.79.79 1.76c.18.39.74.39.92 0zM11.5 9.5L9.91 6c-.35-.78-1.47-.78-1.82 0L6.5 9.5 3 11.09c-.78.36-.78 1.47 0 1.82l3.5 1.59L8.09 18c.36.78 1.47.78 1.82 0l1.59-3.5 3.5-1.59c.78-.36.78-1.47 0-1.82L11.5 9.5z',
	),
	comment: cmIcon(
		'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
	),
	suggest: cmIcon('M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z'),
	emoji: cmIcon(
		'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
	),
	link: cmIcon(
		'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
	),
	define: cmIcon(
		'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
	),
	formatOptions: cmIcon(
		'M5 17v2h14v-2H5zm4.5-4.2h5l.9 2.2h2.1L12.75 4h-1.5L6.5 15h2.1l.9-2.2zM12 5.98L13.87 11h-3.74L12 5.98z',
	),
	clearFormat: cmIcon(
		'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
	),
};

// --- Table context menu icons ---

const tableIcons = {
	insertRowAbove: cmIcon(
		'M21 3H3v2h18V3zm0 4H3v2h18V7zM3 19h18v2H3v-2zm0-4h18v-2H3v2zm9-4l-4 4h8l-4-4z',
	),
	insertRowBelow: cmIcon(
		'M21 3H3v2h18V3zM3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-8h18V7H3v2zm9 4l4-4H8l4 4z',
	),
	insertColLeft: cmIcon(
		'M3 3v18h2V3H3zm4 0v18h2V3H7zm12 0v18h2V3h-2zm-4 0v18h2V3h-2zm-4 9l4-4v8l-4-4z',
	),
	insertColRight: cmIcon(
		'M3 3v18h2V3H3zm16 0v18h2V3h-2zm-4 0v18h2V3h-2zm-8 0v18h2V3H7zm4 9l-4-4v8l4-4z',
	),
	deleteRow: cmIcon(
		'M21 11H3v2h18v-2zm0 4H3v2h18v-2zM3 7h18V5H3v2zm0 14h18v-2H3v2z',
	),
	deleteCol: cmIcon(
		'M11 3v18h2V3h-2zm4 0v18h2V3h-2zM7 3v18H5V3h2zm14 0v18h-2V3h2z',
	),
	mergeCells: cmIcon(
		'M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h4v4H7V7zm6 0h4v4h-4V7zm-6 6h4v4H7v-4zm6 0h4v4h-4v-4z',
	),
	splitCell: cmIcon(
		'M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z',
	),
	tableProperties: cmIcon(
		'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 18H4v-6h8v6zm0-8H4V6h8v6zm10 8h-8v-6h8v6zm0-8h-8V6h8v6z',
	),
};

export function getTableContextMenuGroups(): ContextMenuGroup[] {
	return [
		{
			items: [
				{
					id: 'table.insertRow.above',
					label: 'Insertar fila arriba',
					icon: tableIcons.insertRowAbove,
				},
				{
					id: 'table.insertRow.below',
					label: 'Insertar fila abajo',
					icon: tableIcons.insertRowBelow,
				},
				{
					id: 'table.insertCol.left',
					label: 'Insertar columna a la izquierda',
					icon: tableIcons.insertColLeft,
				},
				{
					id: 'table.insertCol.right',
					label: 'Insertar columna a la derecha',
					icon: tableIcons.insertColRight,
				},
			],
		},
		{
			items: [
				{
					id: 'table.deleteRow',
					label: 'Eliminar fila',
					icon: tableIcons.deleteRow,
				},
				{
					id: 'table.deleteCol',
					label: 'Eliminar columna',
					icon: tableIcons.deleteCol,
				},
			],
		},
		{
			items: [
				{
					id: 'table.mergeCells',
					label: 'Combinar celdas',
					icon: tableIcons.mergeCells,
				},
				{
					id: 'table.splitCell',
					label: 'Dividir celda',
					icon: tableIcons.splitCell,
				},
			],
		},
		{
			items: [
				{
					id: 'table.properties',
					label: 'Propiedades de tabla',
					icon: tableIcons.tableProperties,
				},
			],
		},
	];
}

export function getDefaultContextMenuGroups(): ContextMenuGroup[] {
	return [
		{
			items: [
				{
					id: 'cut',
					label: 'Cortar',
					shortcut: 'Ctrl+X',
					icon: contextMenuIcons.cut,
				},
				{
					id: 'copy',
					label: 'Copiar',
					shortcut: 'Ctrl+C',
					icon: contextMenuIcons.copy,
				},
				{
					id: 'paste',
					label: 'Pegar',
					shortcut: 'Ctrl+V',
					icon: contextMenuIcons.paste,
				},
				{
					id: 'paste-no-format',
					label: 'Pegar sin formato',
					shortcut: 'Ctrl+Shift+V',
					icon: contextMenuIcons.pasteNoFormat,
				},
				{
					id: 'delete',
					label: 'Eliminar',
					icon: contextMenuIcons.delete,
				},
			],
		},
		{
			items: [
				{
					id: 'help-write',
					label: 'Ayúdame a escribir',
					icon: contextMenuIcons.sparkle,
					badge: 'Nuevo',
				},
				{
					id: 'comment',
					label: 'Comentario',
					shortcut: 'Ctrl+Alt+M',
					icon: contextMenuIcons.comment,
				},
				{
					id: 'suggest-edits',
					label: 'Sugerir ediciones',
					icon: contextMenuIcons.suggest,
				},
			],
		},
		{
			items: [
				{
					id: 'insert-emoji',
					label: 'Insertar emoji',
					icon: contextMenuIcons.emoji,
				},
				{
					id: 'insert-link',
					label: 'Insertar enlace',
					shortcut: 'Ctrl+K',
					icon: contextMenuIcons.link,
				},
			],
		},
		{
			items: [
				{
					id: 'define',
					label: 'Definir',
					shortcut: 'Ctrl+Shift+Y',
					icon: contextMenuIcons.define,
				},
			],
		},
		{
			items: [
				{
					id: 'format-options',
					label: 'Opciones de formato',
					icon: contextMenuIcons.formatOptions,
					submenu: true,
				},
				{
					id: 'clear-format',
					label: 'Borrar formato',
					shortcut: 'Ctrl+\\',
					icon: contextMenuIcons.clearFormat,
				},
			],
		},
	];
}
