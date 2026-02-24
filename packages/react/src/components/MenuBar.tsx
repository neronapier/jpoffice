'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEditor } from '../hooks/useEditor';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MenuItemDef {
	id: string;
	label: string;
	shortcut?: string;
	disabled?: boolean;
	separator?: boolean;
	submenu?: MenuItemDef[];
	/** When true, renders a table grid picker instead of a regular submenu */
	tableGrid?: boolean;
}

export interface MenuBarProps {
	onMenuAction?: (menu: string, action: string) => void;
	onOpenComments?: () => void;
	onOpenStyles?: () => void;
	onOpenTrackChanges?: () => void;
	onOpenEquationEditor?: () => void;
	onOpenFootnotes?: () => void;
	onOpenPageSetup?: () => void;
	onOpenTableProps?: () => void;
	onOpenShortcuts?: () => void;
	className?: string;
	style?: CSSProperties;
}

/* ------------------------------------------------------------------ */
/*  Menu definitions                                                   */
/* ------------------------------------------------------------------ */

const MENUS: Record<string, MenuItemDef[]> = {
	File: [
		{ id: 'file.new', label: 'Nuevo', shortcut: 'Ctrl+N' },
		{ id: 'file.open', label: 'Abrir', shortcut: 'Ctrl+O' },
		{ id: 'sep1', label: '', separator: true },
		{
			id: 'file.download',
			label: 'Descargar',
			submenu: [
				{ id: 'file.download.docx', label: 'Microsoft Word (.docx)' },
				{ id: 'file.download.pdf', label: 'Documento PDF (.pdf)' },
			],
		},
		{ id: 'sep2', label: '', separator: true },
		{ id: 'file.print', label: 'Imprimir', shortcut: 'Ctrl+P' },
	],
	Edit: [
		{ id: 'edit.undo', label: 'Deshacer', shortcut: 'Ctrl+Z' },
		{ id: 'edit.redo', label: 'Rehacer', shortcut: 'Ctrl+Y' },
		{ id: 'sep1', label: '', separator: true },
		{ id: 'edit.cut', label: 'Cortar', shortcut: 'Ctrl+X' },
		{ id: 'edit.copy', label: 'Copiar', shortcut: 'Ctrl+C' },
		{ id: 'edit.paste', label: 'Pegar', shortcut: 'Ctrl+V' },
		{ id: 'sep2', label: '', separator: true },
		{ id: 'edit.selectAll', label: 'Seleccionar todo', shortcut: 'Ctrl+A' },
		{ id: 'edit.find', label: 'Buscar y reemplazar', shortcut: 'Ctrl+H' },
	],
	View: [
		{ id: 'view.showRuler', label: 'Mostrar regla' },
		{ id: 'view.showOutline', label: 'Mostrar esquema' },
		{ id: 'sep1', label: '', separator: true },
		{ id: 'view.comments', label: 'Comentarios' },
		{ id: 'view.trackChanges', label: 'Control de cambios' },
		{ id: 'view.styles', label: 'Estilos' },
	],
	Insert: [
		{ id: 'insert.image', label: 'Imagen' },
		{ id: 'insert.table', label: 'Tabla', tableGrid: true },
		{ id: 'insert.link', label: 'Enlace', shortcut: 'Ctrl+K' },
		{ id: 'sep1', label: '', separator: true },
		{ id: 'insert.equation', label: 'Ecuacion' },
		{ id: 'insert.footnote', label: 'Nota al pie' },
		{ id: 'sep2', label: '', separator: true },
		{ id: 'insert.pageBreak', label: 'Salto de pagina', shortcut: 'Ctrl+Enter' },
	],
	Format: [
		{ id: 'format.bold', label: 'Negrita', shortcut: 'Ctrl+B' },
		{ id: 'format.italic', label: 'Cursiva', shortcut: 'Ctrl+I' },
		{ id: 'format.underline', label: 'Subrayado', shortcut: 'Ctrl+U' },
		{ id: 'format.strikethrough', label: 'Tachado' },
		{ id: 'sep1', label: '', separator: true },
		{ id: 'format.clearFormatting', label: 'Borrar formato' },
		{ id: 'sep2', label: '', separator: true },
		{ id: 'format.pageSetup', label: 'Configuracion de pagina' },
		{ id: 'format.tableProperties', label: 'Propiedades de tabla' },
	],
	Tools: [
		{ id: 'tools.wordCount', label: 'Recuento de palabras' },
		{ id: 'tools.spellcheck', label: 'Corrector ortografico', disabled: true },
	],
	Extensions: [{ id: 'extensions.manage', label: 'Complementos', disabled: true }],
	Help: [
		{ id: 'help.shortcuts', label: 'Combinaciones de teclas' },
		{ id: 'help.about', label: 'Acerca de' },
	],
};

const MENU_KEYS = Object.keys(MENUS);

/* ------------------------------------------------------------------ */
/*  Command mapping                                                    */
/* ------------------------------------------------------------------ */

const MENU_COMMAND_MAP: Record<string, { commandId: string; args?: unknown }> = {
	'edit.undo': { commandId: 'history.undo' },
	'edit.redo': { commandId: 'history.redo' },
	'edit.cut': { commandId: 'clipboard.cut' },
	'edit.copy': { commandId: 'clipboard.copy' },
	'edit.paste': { commandId: 'clipboard.paste' },
	'edit.selectAll': { commandId: 'selection.selectAll' },
	'edit.find': { commandId: 'find.showUI', args: { replace: true } },
	'insert.link': { commandId: 'link.showDialog' },
	'insert.pageBreak': { commandId: 'text.insertPageBreak' },
	'format.bold': { commandId: 'format.bold' },
	'format.italic': { commandId: 'format.italic' },
	'format.underline': { commandId: 'format.underline' },
	'format.strikethrough': { commandId: 'format.strikethrough' },
	'format.clearFormatting': { commandId: 'format.clearFormatting' },
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const barStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	height: 28,
	padding: '0 8px 0 56px',
	backgroundColor: '#fff',
	flexShrink: 0,
	gap: 0,
};

const menuBtnStyle: CSSProperties = {
	padding: '2px 8px',
	border: 'none',
	background: 'transparent',
	fontSize: 13,
	color: '#202124',
	fontFamily: "'Google Sans Text', Roboto, sans-serif",
	lineHeight: '28px',
	borderRadius: 4,
	cursor: 'pointer',
	whiteSpace: 'nowrap',
};

const dropdownStyle: CSSProperties = {
	position: 'absolute',
	top: '100%',
	left: 0,
	zIndex: 1000,
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	padding: '6px 0',
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
	minWidth: 240,
};

const itemStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	width: '100%',
	padding: '6px 16px',
	border: 'none',
	background: 'transparent',
	fontSize: 13,
	color: '#202124',
	fontFamily: "'Google Sans Text', Roboto, sans-serif",
	cursor: 'pointer',
	textAlign: 'left',
	whiteSpace: 'nowrap',
};

const shortcutStyle: CSSProperties = {
	fontSize: 12,
	color: '#70757a',
	marginLeft: 32,
};

const separatorItemStyle: CSSProperties = {
	height: 1,
	backgroundColor: '#e8eaed',
	margin: '4px 0',
};

const submenuContainerStyle: CSSProperties = {
	position: 'relative',
};

const submenuDropdownStyle: CSSProperties = {
	position: 'absolute',
	top: -6,
	left: '100%',
	zIndex: 1001,
	background: '#fff',
	border: '1px solid #dadce0',
	borderRadius: 8,
	padding: '6px 0',
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
	minWidth: 200,
};

/* ------------------------------------------------------------------ */
/*  TableGridPicker component                                          */
/* ------------------------------------------------------------------ */

const GRID_COLS = 10;
const GRID_ROWS = 6;
const CELL_SIZE = 20;
const CELL_GAP = 2;

/** Pre-computed grid cells so we don't use array indices as keys */
const GRID_CELLS: { key: string; row: number; col: number }[] = [];
for (let r = 0; r < GRID_ROWS; r++) {
	for (let c = 0; c < GRID_COLS; c++) {
		GRID_CELLS.push({ key: `cell-${r}-${c}`, row: r, col: c });
	}
}

const gridContainerStyle: CSSProperties = {
	padding: '8px 12px',
};

const gridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
	gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
	gap: CELL_GAP,
};

const gridLabelStyle: CSSProperties = {
	fontSize: 12,
	color: '#70757a',
	fontFamily: "'Google Sans Text', Roboto, sans-serif",
	textAlign: 'center',
	marginTop: 8,
	minHeight: 16,
};

function TableGridPicker({
	onSelect,
}: {
	onSelect: (rows: number, cols: number) => void;
}) {
	const [hoverRow, setHoverRow] = useState(0);
	const [hoverCol, setHoverCol] = useState(0);

	return (
		<div style={gridContainerStyle}>
			<div
				style={gridStyle}
				onMouseLeave={() => {
					setHoverRow(0);
					setHoverCol(0);
				}}
			>
				{GRID_CELLS.map(({ key, row, col }) => {
					const isHighlighted = row < hoverRow && col < hoverCol;
					return (
						<div
							key={key}
							style={{
								width: CELL_SIZE,
								height: CELL_SIZE,
								border: `1px solid ${isHighlighted ? '#1a73e8' : '#dadce0'}`,
								borderRadius: 2,
								backgroundColor: isHighlighted ? '#d2e3fc' : '#fff',
								cursor: 'pointer',
							}}
							onMouseEnter={() => {
								setHoverRow(row + 1);
								setHoverCol(col + 1);
							}}
							onMouseDown={(e) => {
								e.preventDefault();
								onSelect(row + 1, col + 1);
							}}
						/>
					);
				})}
			</div>
			<div style={gridLabelStyle}>
				{hoverRow > 0 && hoverCol > 0 ? `${hoverCol} x ${hoverRow}` : ''}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  MenuItem component                                                 */
/* ------------------------------------------------------------------ */

function MenuItem({
	item,
	onAction,
	onTableInsert,
}: {
	item: MenuItemDef;
	onAction: (id: string) => void;
	onTableInsert?: (rows: number, cols: number) => void;
}) {
	const [hovered, setHovered] = useState(false);
	const [submenuOpen, setSubmenuOpen] = useState(false);

	if (item.separator) {
		return <hr style={{ ...separatorItemStyle, border: 'none' }} />;
	}

	// Table grid picker submenu
	if (item.tableGrid && onTableInsert) {
		return (
			<div
				role="menuitem"
				aria-haspopup="true"
				aria-expanded={submenuOpen}
				tabIndex={0}
				style={submenuContainerStyle}
				onMouseEnter={() => {
					setHovered(true);
					setSubmenuOpen(true);
				}}
				onMouseLeave={() => {
					setHovered(false);
					setSubmenuOpen(false);
				}}
			>
				<div
					style={{
						...itemStyle,
						backgroundColor: hovered ? '#e8eaed' : 'transparent',
					}}
				>
					<span>{item.label}</span>
					<span aria-hidden="true" style={{ fontSize: 11, color: '#70757a' }}>
						▸
					</span>
				</div>
				{submenuOpen && (
					<div role="menu" aria-label={item.label} style={submenuDropdownStyle}>
						<TableGridPicker onSelect={onTableInsert} />
					</div>
				)}
			</div>
		);
	}

	if (item.submenu) {
		return (
			<div
				role="menuitem"
				aria-haspopup="true"
				aria-expanded={submenuOpen}
				tabIndex={0}
				style={submenuContainerStyle}
				onMouseEnter={() => {
					setHovered(true);
					setSubmenuOpen(true);
				}}
				onMouseLeave={() => {
					setHovered(false);
					setSubmenuOpen(false);
				}}
			>
				<div
					style={{
						...itemStyle,
						backgroundColor: hovered ? '#e8eaed' : 'transparent',
					}}
				>
					<span>{item.label}</span>
					<span aria-hidden="true" style={{ fontSize: 11, color: '#70757a' }}>
						▸
					</span>
				</div>
				{submenuOpen && (
					<div role="menu" aria-label={item.label} style={submenuDropdownStyle}>
						{item.submenu.map((sub) => (
							<MenuItem key={sub.id} item={sub} onAction={onAction} />
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<button
			type="button"
			role="menuitem"
			disabled={item.disabled}
			aria-disabled={item.disabled || undefined}
			style={{
				...itemStyle,
				backgroundColor: hovered ? '#e8eaed' : 'transparent',
				opacity: item.disabled ? 0.5 : 1,
				cursor: item.disabled ? 'default' : 'pointer',
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onMouseDown={(e) => {
				e.preventDefault();
				if (!item.disabled) onAction(item.id);
			}}
		>
			<span>{item.label}</span>
			{item.shortcut && <span style={shortcutStyle}>{item.shortcut}</span>}
		</button>
	);
}

/* ------------------------------------------------------------------ */
/*  MenuBar                                                            */
/* ------------------------------------------------------------------ */

export function MenuBar({
	onMenuAction,
	onOpenComments,
	onOpenStyles,
	onOpenTrackChanges,
	onOpenEquationEditor,
	onOpenFootnotes,
	onOpenPageSetup,
	onOpenTableProps,
	onOpenShortcuts,
	className,
	style,
}: MenuBarProps) {
	const editor = useEditor();
	const [openMenu, setOpenMenu] = useState<string | null>(null);
	const [focusedItemIndex, setFocusedItemIndex] = useState(-1);
	const barRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!openMenu) return;
		const handler = (e: MouseEvent) => {
			if (barRef.current && !barRef.current.contains(e.target as Node)) {
				setOpenMenu(null);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [openMenu]);

	// Close on Escape and keyboard navigation
	useEffect(() => {
		if (!openMenu) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpenMenu(null);
				setFocusedItemIndex(-1);
				return;
			}

			// Arrow Left/Right: move between top-level menus
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				e.preventDefault();
				const idx = MENU_KEYS.indexOf(openMenu);
				if (idx === -1) return;
				const next =
					e.key === 'ArrowRight'
						? (idx + 1) % MENU_KEYS.length
						: (idx - 1 + MENU_KEYS.length) % MENU_KEYS.length;
				setOpenMenu(MENU_KEYS[next]);
				setFocusedItemIndex(-1);
				return;
			}

			// Arrow Up/Down: move within dropdown items
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				const dropdown = dropdownRef.current;
				if (!dropdown) return;
				const items = Array.from(
					dropdown.querySelectorAll<HTMLElement>(
						'button[role="menuitem"]:not([disabled]), [role="menuitem"][aria-haspopup]',
					),
				);
				if (items.length === 0) return;
				const nextIdx =
					e.key === 'ArrowDown'
						? (focusedItemIndex + 1) % items.length
						: (focusedItemIndex - 1 + items.length) % items.length;
				setFocusedItemIndex(nextIdx);
				items[nextIdx]?.focus();
				return;
			}

			// Enter: activate focused item
			if (e.key === 'Enter') {
				const dropdown = dropdownRef.current;
				if (!dropdown) return;
				const items = Array.from(
					dropdown.querySelectorAll<HTMLElement>('button[role="menuitem"]:not([disabled])'),
				);
				if (focusedItemIndex >= 0 && focusedItemIndex < items.length) {
					e.preventDefault();
					items[focusedItemIndex]?.click();
				}
			}
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	}, [openMenu, focusedItemIndex]);

	const handleTableInsert = useCallback(
		(rows: number, cols: number) => {
			setOpenMenu(null);
			try {
				editor.executeCommand('table.insert', { rows, cols });
			} catch {
				/* command not registered */
			}
		},
		[editor],
	);

	const handleAction = useCallback(
		(id: string) => {
			setOpenMenu(null);

			// Panel open actions
			switch (id) {
				case 'view.comments':
					onOpenComments?.();
					return;
				case 'view.styles':
					onOpenStyles?.();
					return;
				case 'view.trackChanges':
					onOpenTrackChanges?.();
					return;
				case 'insert.equation':
					onOpenEquationEditor?.();
					return;
				case 'insert.footnote':
					onOpenFootnotes?.();
					return;
				case 'format.pageSetup':
					onOpenPageSetup?.();
					return;
				case 'format.tableProperties':
					onOpenTableProps?.();
					return;
				case 'help.shortcuts':
					onOpenShortcuts?.();
					return;
			}

			// Try mapped command first
			const mapping = MENU_COMMAND_MAP[id];
			if (mapping) {
				try {
					editor.executeCommand(mapping.commandId, mapping.args);
				} catch {
					/* command not registered */
				}
				return;
			}

			// Special cases
			if (id === 'insert.image') {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = 'image/*';
				input.onchange = () => {
					const file = input.files?.[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = () => {
						const img = new Image();
						img.onload = () => {
							try {
								editor.executeCommand('image.insert', {
									src: reader.result as string,
									mimeType: file.type,
									width: Math.min(img.width, 600),
									height: Math.min(img.height, 400),
								});
							} catch {
								/* */
							}
						};
						img.src = reader.result as string;
					};
					reader.readAsDataURL(file);
				};
				input.click();
				return;
			}

			if (id === 'file.print') {
				window.print();
				return;
			}

			// Forward to external handler
			onMenuAction?.(id, 'execute');
		},
		[
			editor,
			onMenuAction,
			onOpenComments,
			onOpenStyles,
			onOpenTrackChanges,
			onOpenEquationEditor,
			onOpenFootnotes,
			onOpenPageSetup,
			onOpenTableProps,
			onOpenShortcuts,
		],
	);

	return (
		<div
			ref={barRef}
			role="menubar"
			aria-label="Menu bar"
			className={className}
			style={{ ...barStyle, ...style }}
		>
			{MENU_KEYS.map((menuName) => (
				<div key={menuName} style={{ position: 'relative' }}>
					<button
						type="button"
						role="menuitem"
						aria-haspopup="true"
						aria-expanded={openMenu === menuName}
						style={{
							...menuBtnStyle,
							backgroundColor: openMenu === menuName ? '#e8eaed' : 'transparent',
						}}
						onMouseDown={(e) => {
							e.preventDefault();
							setOpenMenu(openMenu === menuName ? null : menuName);
							setFocusedItemIndex(-1);
						}}
						onMouseEnter={() => {
							if (openMenu !== null && openMenu !== menuName) {
								setOpenMenu(menuName);
								setFocusedItemIndex(-1);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								setOpenMenu(menuName);
								setFocusedItemIndex(0);
							}
						}}
					>
						{menuName}
					</button>
					{openMenu === menuName && MENUS[menuName] && (
						<div
							ref={dropdownRef}
							role="menu"
							aria-label={`${menuName} menu`}
							style={dropdownStyle}
						>
							{MENUS[menuName].map((item) => (
								<MenuItem
									key={item.id}
									item={item}
									onAction={handleAction}
									onTableInsert={handleTableInsert}
								/>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
