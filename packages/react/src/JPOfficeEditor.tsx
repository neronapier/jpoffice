'use client';

import {
	AutoCorrectPlugin,
	ClipboardPlugin,
	CommentPlugin,
	DragDropPlugin,
	EquationPlugin,
	FieldPlugin,
	FindReplacePlugin,
	FootnotePlugin,
	FormattingPlugin,
	HeaderFooterPlugin,
	HeadingPlugin,
	ImagePlugin,
	JPEditor,
	LinkPlugin,
	ListPlugin,
	PageSetupPlugin,
	ShapePlugin,
	SpellcheckPlugin,
	StylesPlugin,
	TablePlugin,
	TextPlugin,
	TrackChangesPlugin,
	registerBuiltinCommands,
} from '@jpoffice/engine';
import type { FindReplaceState, SearchMatch, SpellCheckState } from '@jpoffice/engine';
import { getParagraphsInRange } from '@jpoffice/engine';
import type { JPDocument, JPParagraph, JPSectionProperties } from '@jpoffice/model';
import {
	DEFAULT_SECTION_PROPERTIES,
	createBody,
	createDocument,
	createParagraph,
	createRun,
	createSection,
	createText,
	generateId,
	pxToTwips,
	twipsToPx,
} from '@jpoffice/model';
import type { CanvasRenderer } from '@jpoffice/renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CommentsPanel } from './components/CommentsPanel';
import {
	ContextMenu,
	getDefaultContextMenuGroups,
	getImageContextMenuGroups,
	getTableContextMenuGroups,
} from './components/ContextMenu';
import { EditorCanvas } from './components/EditorCanvas';
import { EquationEditor } from './components/EquationEditor';
import { FindReplaceBar } from './components/FindReplaceBar';
import { FootnotePanel } from './components/FootnotePanel';
import { HeaderFooterToolbar } from './components/HeaderFooterToolbar';
import { ImagePropertiesDialog } from './components/ImagePropertiesDialog';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { LinkDialog } from './components/LinkDialog';
import { MenuBar } from './components/MenuBar';
import { ModePanel } from './components/ModeButtons';
import { PageSetupDialog } from './components/PageSetupDialog';
import { ParagraphPropertiesDialog } from './components/ParagraphPropertiesDialog';
import { Ruler } from './components/Ruler';
import { ScrollContainer } from './components/ScrollContainer';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { StylesPanel } from './components/StylesPanel';
import { TablePropertiesDialog } from './components/TablePropertiesDialog';
import { TitleBar } from './components/TitleBar';
import { Toolbar } from './components/Toolbar';
import { TrackChangesPanel } from './components/TrackChangesPanel';
import { EditorContext } from './context/editor-context';
import type { EditorContextValue } from './context/editor-context';
import { useAnnounce } from './hooks/useAnnounce';
import { useEditor } from './hooks/useEditor';
import { useEditorState } from './hooks/useEditorState';
import { useLayout } from './hooks/useLayout';
import { useSelectionRect } from './hooks/useSelectionRect';
import { FloatingToolbar } from './overlays/FloatingToolbar';
import { ImageResizeOverlay } from './overlays/ImageResizeOverlay';
import { TableResizeOverlay } from './overlays/TableResizeOverlay';
import { ThemeProvider } from './theme/theme-provider';
import type { ThemeMode } from './theme/theme-provider';

export type EditorMode = 'editing' | 'suggesting' | 'viewing';

export interface JPOfficeEditorProps {
	document: JPDocument;
	readOnly?: boolean;
	showToolbar?: boolean;
	showStatusBar?: boolean;
	showRuler?: boolean;
	showTitleBar?: boolean;
	showMenuBar?: boolean;
	showSidebar?: boolean;
	title?: string;
	onTitleChange?: (title: string) => void;
	onMenuAction?: (menu: string, action: string) => void;
	onShare?: () => void;
	/** Override handler for File > New. If not provided, creates a blank document. */
	onFileNew?: () => void;
	/** Override handler for File > Open. If not provided, opens file picker + imports via @jpoffice/docx. */
	onFileOpen?: () => void;
	/** Override handler for Download > DOCX. If not provided, exports via @jpoffice/docx. */
	onDownloadDocx?: () => void;
	/** Override handler for Download > PDF. If not provided, exports via @jpoffice/pdf. */
	onDownloadPdf?: () => void;
	/** Theme mode: 'light', 'dark', or 'auto' (detects system preference). Defaults to 'light'. */
	theme?: ThemeMode;
	/** Author name for track changes / suggesting mode. Defaults to 'Anonymous'. */
	author?: string;
	/** Remote user cursors for collaboration rendering. */
	remoteCursors?: readonly import('@jpoffice/renderer').RemoteCursorInfo[];
	className?: string;
	style?: CSSProperties;
	onEditorReady?: (editor: JPEditor) => void;
}

function getSectionProps(doc: JPDocument): JPSectionProperties {
	const body = doc.children[0];
	if (body && body.children.length > 0) {
		return body.children[0].properties;
	}
	return DEFAULT_SECTION_PROPERTIES;
}

function getInitialCursorPath(doc: JPDocument): readonly number[] {
	// Navigate to the first text node: body[0] → section[0] → paragraph[0] → run[0] → text[0]
	let node: { children?: readonly { children?: readonly unknown[] }[] } = doc;
	const path: number[] = [];
	while (node.children && node.children.length > 0) {
		path.push(0);
		node = node.children[0] as typeof node;
	}
	return path;
}

function createBlankDocument(): JPDocument {
	const para = createParagraph(generateId(), [
		createRun(generateId(), [createText(generateId(), '')]),
	]);
	const section = createSection(generateId(), [para], DEFAULT_SECTION_PROPERTIES);
	const body = createBody(generateId(), [section]);
	return createDocument({ id: generateId(), body });
}

function pickFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.addEventListener('cancel', () => resolve(null));
		input.click();
	});
}

function triggerDownload(data: Uint8Array, filename: string, mimeType: string): void {
	const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

interface EditorInnerProps {
	readOnly: boolean;
	showToolbar: boolean;
	showStatusBar: boolean;
	showRuler: boolean;
	showTitleBar: boolean;
	showMenuBar: boolean;
	showSidebar: boolean;
	title: string;
	author?: string;
	remoteCursors?: readonly import('@jpoffice/renderer').RemoteCursorInfo[];
	onTitleChange?: (title: string) => void;
	onMenuAction?: (menu: string, action: string) => void;
	onShare?: () => void;
	onFileNew?: () => void;
	onFileOpen?: () => void;
	onDownloadDocx?: () => void;
	onDownloadPdf?: () => void;
}

function EditorInner({
	readOnly,
	showToolbar,
	showStatusBar,
	showRuler,
	showTitleBar,
	showMenuBar,
	showSidebar,
	title,
	author: authorProp,
	remoteCursors,
	onTitleChange,
	onMenuAction,
	onShare,
	onFileNew,
	onFileOpen,
	onDownloadDocx,
	onDownloadPdf,
}: EditorInnerProps) {
	const editor = useEditor();
	const state = useEditorState();
	const layout = useLayout();
	const { announce, AnnouncerRegion } = useAnnounce();
	const [mode, setMode] = useState<EditorMode>(readOnly ? 'viewing' : 'editing');
	const [zoom, setZoom] = useState(100);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		isInTable: boolean;
		isOnImage: boolean;
		imagePath?: readonly number[];
	} | null>(null);
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [findReplaceOpen, setFindReplaceOpen] = useState(false);
	const [findShowReplace, setFindShowReplace] = useState(false);
	const [findMatches, setFindMatches] = useState<readonly SearchMatch[]>([]);
	const [findCurrentIndex, setFindCurrentIndex] = useState(-1);

	// Spellcheck errors for squiggly-line rendering
	const [spellErrors, setSpellErrors] = useState<SpellCheckState | null>(null);

	// Header/footer editing state
	const [hfEditState, setHfEditState] = useState<{
		editing: boolean;
		zone: 'header' | 'footer' | null;
	} | null>(null);

	// Panel visibility state
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [stylesOpen, setStylesOpen] = useState(false);
	const [trackChangesOpen, setTrackChangesOpen] = useState(false);
	const [equationEditorOpen, setEquationEditorOpen] = useState(false);
	const [equationEditState, setEquationEditState] = useState<{
		latex: string;
		display: 'inline' | 'block';
		path: readonly number[];
	} | null>(null);
	const [footnotesOpen, setFootnotesOpen] = useState(false);
	const [pageSetupOpen, setPageSetupOpen] = useState(false);
	const [tablePropsOpen, setTablePropsOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const [imagePropsOpen, setImagePropsOpen] = useState(false);
	const [paragraphPropsOpen, setParagraphPropsOpen] = useState(false);
	const [spellSuggestions, setSpellSuggestions] = useState<{
		word: string;
		suggestions: string[];
		path: readonly number[];
		offset: number;
		length: number;
	} | null>(null);

	// Renderer ref for floating toolbar selection rect
	const canvasRendererRef = useRef<CanvasRenderer | null>(null);
	const editorContentRef = useRef<HTMLDivElement>(null);
	const selectionRect = useSelectionRect(editor, canvasRendererRef);
	const [paintFormatActive, setPaintFormatActive] = useState(false);
	const contextMenuGroups = useMemo(() => {
		const groups: import('./components/ContextMenu').ContextMenuGroup[] = [];

		// Add spell suggestions at the top
		if (spellSuggestions && spellSuggestions.suggestions.length > 0) {
			groups.push({
				items: spellSuggestions.suggestions.map((s, i) => ({
					id: `spell.suggest.${i}`,
					label: s,
					icon: null,
				})),
			});
			groups.push({
				items: [
					{ id: 'spell.addToDictionary', label: 'Agregar al diccionario' },
					{ id: 'spell.ignoreAll', label: 'Ignorar todas' },
				],
			});
		} else if (spellSuggestions) {
			groups.push({
				items: [
					{ id: 'spell.noSuggestions', label: 'Sin sugerencias', disabled: true },
					{ id: 'spell.addToDictionary', label: 'Agregar al diccionario' },
					{ id: 'spell.ignoreAll', label: 'Ignorar todas' },
				],
			});
		}

		groups.push(...getDefaultContextMenuGroups());

		if (contextMenu?.isOnImage) {
			groups.push(...getImageContextMenuGroups());
		}
		if (contextMenu?.isInTable) {
			groups.push(...getTableContextMenuGroups());
		}
		return groups;
	}, [contextMenu?.isInTable, contextMenu?.isOnImage, spellSuggestions]);

	const sectionProps = getSectionProps(state.document);
	const pageWidthPx = twipsToPx(sectionProps.pageSize.width);
	const marginLeftPx = twipsToPx(sectionProps.margins.left);
	const marginRightPx = twipsToPx(sectionProps.margins.right);

	// Get current paragraph indent values for ruler
	const currentParaIndent = useMemo(() => {
		const sel = state.selection;
		if (!sel) return { left: 0, right: 0, firstLine: 0 };
		try {
			const paragraphs = getParagraphsInRange(state.document, sel);
			if (paragraphs.length === 0) return { left: 0, right: 0, firstLine: 0 };
			const indent = paragraphs[0].node.properties.indent;
			return {
				left: indent?.left ? twipsToPx(indent.left) : 0,
				right: indent?.right ? twipsToPx(indent.right) : 0,
				firstLine: indent?.firstLine
					? twipsToPx(indent.firstLine)
					: indent?.hanging
						? -twipsToPx(indent.hanging)
						: 0,
			};
		} catch {
			return { left: 0, right: 0, firstLine: 0 };
		}
	}, [state.document, state.selection]);

	// Ruler indent change handlers
	const handleIndentChange = useCallback(
		(property: 'left' | 'right' | 'firstLine', valuePx: number) => {
			const sel = editor.getSelection();
			if (!sel) return;
			const doc = editor.getDocument();
			const paragraphs = getParagraphsInRange(doc, sel);
			const valueTwips = Math.round(pxToTwips(valuePx));

			editor.batch(() => {
				for (const para of paragraphs) {
					const oldIndent = para.node.properties.indent;
					let newIndent: JPParagraph['properties']['indent'];

					if (property === 'firstLine') {
						if (valueTwips >= 0) {
							newIndent = { ...oldIndent, firstLine: valueTwips, hanging: undefined };
						} else {
							newIndent = { ...oldIndent, hanging: -valueTwips, firstLine: undefined };
						}
					} else {
						newIndent = { ...oldIndent, [property]: valueTwips };
					}

					editor.apply({
						type: 'set_properties',
						path: para.path,
						properties: { indent: newIndent },
						oldProperties: { indent: oldIndent },
					});
				}
			});
		},
		[editor],
	);

	const handleIndentLeftChange = useCallback(
		(px: number) => handleIndentChange('left', px),
		[handleIndentChange],
	);
	const handleIndentRightChange = useCallback(
		(px: number) => handleIndentChange('right', px),
		[handleIndentChange],
	);
	const handleIndentFirstLineChange = useCallback(
		(px: number) => handleIndentChange('firstLine', px),
		[handleIndentChange],
	);

	// Ruler margin change handlers — update section margins (affects ALL pages)
	const handleMarginLeftChange = useCallback(
		(px: number) => {
			const twips = Math.round(pxToTwips(px));
			try {
				editor.executeCommand('pageSetup.setMargins', { left: twips });
			} catch {
				/* command not registered */
			}
		},
		[editor],
	);
	const handleMarginRightChange = useCallback(
		(px: number) => {
			const twips = Math.round(pxToTwips(px));
			try {
				editor.executeCommand('pageSetup.setMargins', { right: twips });
			} catch {
				/* command not registered */
			}
		},
		[editor],
	);

	const handleModeChange = useCallback(
		(newMode: EditorMode) => {
			setMode(newMode);
			if (newMode === 'viewing') {
				editor.setReadOnly(true);
			} else {
				editor.setReadOnly(false);
			}
			// Toggle track changes when entering/leaving suggesting mode
			const tcPlugin = editor.getPlugin('jpoffice.trackChanges') as TrackChangesPlugin | undefined;
			if (tcPlugin) {
				tcPlugin.setTracking(newMode === 'suggesting');
				if (newMode === 'suggesting') {
					try {
						editor.executeCommand('trackChanges.setAuthor', {
							author: authorProp ?? 'Anonymous',
						});
					} catch {
						/* command not registered */
					}
				}
			}
			// ARIA announcement for mode change
			const modeLabels: Record<EditorMode, string> = {
				editing: 'Editing mode',
				suggesting: 'Suggesting mode',
				viewing: 'Viewing mode',
			};
			announce(modeLabels[newMode]);
		},
		[editor, authorProp, announce],
	);

	const toggleSidebar = useCallback(() => {
		setSidebarOpen((prev) => !prev);
	}, []);

	// Connect LinkPlugin dialog callback
	useEffect(() => {
		const linkPlugin = editor.getPlugin('jpoffice.link') as LinkPlugin | undefined;
		if (linkPlugin) {
			linkPlugin.onShowDialog = () => setLinkDialogOpen(true);
		}
		return () => {
			if (linkPlugin) linkPlugin.onShowDialog = undefined;
		};
	}, [editor]);

	// Connect FormattingPlugin paint format callback
	useEffect(() => {
		const fmtPlugin = editor.getPlugin('jpoffice.formatting') as FormattingPlugin | undefined;
		if (fmtPlugin) {
			fmtPlugin.onPaintFormatChange = (active: boolean) => setPaintFormatActive(active);
		}
		return () => {
			if (fmtPlugin) fmtPlugin.onPaintFormatChange = undefined;
		};
	}, [editor]);

	const handlePaintFormatToggle = useCallback(() => {
		const fmtPlugin = editor.getPlugin('jpoffice.formatting') as FormattingPlugin | undefined;
		if (!fmtPlugin) return;

		if (fmtPlugin.isPaintFormatActive()) {
			fmtPlugin.clearPaintFormat();
		} else {
			try {
				editor.executeCommand('format.copyFormat');
			} catch {
				/* not registered */
			}
		}
	}, [editor]);

	// Apply paint format on selection change (user clicks/selects text)
	useEffect(() => {
		if (!paintFormatActive) return;

		const unsubscribe = editor.subscribe(() => {
			const sel = editor.getSelection();
			if (!sel) return;
			const fmtPlugin = editor.getPlugin('jpoffice.formatting') as FormattingPlugin | undefined;
			if (!fmtPlugin?.isPaintFormatActive()) return;

			// Only apply if there's a non-collapsed selection (user selected text)
			const { anchor, focus } = sel;
			const isSamePath =
				anchor.path.length === focus.path.length &&
				anchor.path.every((v, i) => v === focus.path[i]);
			if (isSamePath && anchor.offset === focus.offset) return;

			try {
				editor.executeCommand('format.pasteFormat');
			} catch {
				/* not registered */
			}
		});

		return unsubscribe;
	}, [editor, paintFormatActive]);

	// Connect FindReplacePlugin callbacks
	useEffect(() => {
		const frPlugin = editor.getPlugin('jpoffice.findReplace') as FindReplacePlugin | undefined;
		if (frPlugin) {
			frPlugin.onShowUI = (showReplace?: boolean) => {
				setFindReplaceOpen(true);
				if (showReplace) setFindShowReplace(true);
			};
			frPlugin.onStateChange = (frState: FindReplaceState) => {
				setFindMatches(frState.matches);
				setFindCurrentIndex(frState.currentIndex);
			};
		}
		return () => {
			if (frPlugin) {
				frPlugin.onShowUI = undefined;
				frPlugin.onStateChange = undefined;
			}
		};
	}, [editor]);

	// Connect SpellcheckPlugin errors callback
	useEffect(() => {
		const spPlugin = editor.getPlugin('jpoffice.spellcheck') as SpellcheckPlugin | undefined;
		if (spPlugin) {
			spPlugin.onErrorsChange = (scState: SpellCheckState) => {
				setSpellErrors(scState);
			};
		}
		return () => {
			if (spPlugin) spPlugin.onErrorsChange = undefined;
		};
	}, [editor]);

	// Pass spell errors to renderer
	useEffect(() => {
		if (canvasRendererRef.current && spellErrors) {
			canvasRendererRef.current.setSpellErrors(spellErrors.errors);
		}
	}, [spellErrors]);

	// Connect HeaderFooterPlugin edit state callback
	useEffect(() => {
		const hfPlugin = editor.getPlugin('jpoffice.headerfooter') as HeaderFooterPlugin | undefined;
		if (!hfPlugin) return;
		hfPlugin.onEditStateChange = (state) => {
			setHfEditState(state.editing ? { editing: true, zone: state.zone } : null);
		};
		return () => {
			hfPlugin.onEditStateChange = undefined;
		};
	}, [editor]);

	// Pass header/footer editing state to renderer for dimming
	useEffect(() => {
		if (canvasRendererRef.current) {
			canvasRendererRef.current.setHeaderFooterEditing(
				hfEditState?.zone ? { zone: hfEditState.zone } : null,
			);
			canvasRendererRef.current.render();
		}
	}, [hfEditState]);

	// Connect EquationPlugin edit callback (double-click on equation)
	useEffect(() => {
		const eqPlugin = editor.getPlugin('jpoffice.equation') as EquationPlugin | undefined;
		if (eqPlugin) {
			eqPlugin.onEquationEdit = (equation, path) => {
				setEquationEditState({
					latex: equation.latex,
					display: equation.display,
					path: [...path],
				});
				setEquationEditorOpen(true);
			};
		}
		return () => {
			if (eqPlugin) eqPlugin.onEquationEdit = undefined;
		};
	}, [editor]);

	// Resolve dynamic page fields (PAGE, NUMPAGES) after layout
	const fieldResolveRef = useRef(0);
	useEffect(() => {
		if (!layout) return;
		const fieldPlugin = editor.getPlugin('jpoffice.field') as FieldPlugin | undefined;
		if (!fieldPlugin) return;
		// Prevent infinite loop: only resolve once per layout version
		if (fieldResolveRef.current === layout.version) return;
		fieldResolveRef.current = layout.version;
		fieldPlugin.resolvePageFields(editor, layout.pages);
	}, [editor, layout]);

	// Pass remote cursors to renderer
	useEffect(() => {
		if (canvasRendererRef.current) {
			canvasRendererRef.current.setRemoteCursors(remoteCursors ?? []);
		}
	}, [remoteCursors]);

	const handleFindSearch = useCallback(
		(term: string, caseSensitive: boolean) => {
			try {
				editor.executeCommand('find.search', { term, caseSensitive });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleFindNext = useCallback(() => {
		try {
			editor.executeCommand('find.next');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleFindPrevious = useCallback(() => {
		try {
			editor.executeCommand('find.previous');
		} catch {
			/* not registered */
		}
	}, [editor]);

	const handleFindReplace = useCallback(
		(replacement: string) => {
			try {
				editor.executeCommand('find.replace', { replacement });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleFindReplaceAll = useCallback(
		(replacement: string) => {
			try {
				editor.executeCommand('find.replaceAll', { replacement });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleFindClose = useCallback(() => {
		setFindReplaceOpen(false);
		try {
			editor.executeCommand('find.clear');
		} catch {
			/* not registered */
		}
		setFindMatches([]);
		setFindCurrentIndex(-1);
	}, [editor]);

	const handleToggleReplace = useCallback(() => {
		setFindShowReplace((prev) => !prev);
	}, []);

	const handleLinkApply = useCallback(
		(url: string, text: string) => {
			setLinkDialogOpen(false);
			try {
				editor.executeCommand('link.insert', { href: url, text });
			} catch {
				/* not registered */
			}
		},
		[editor],
	);

	const handleLinkCancel = useCallback(() => {
		setLinkDialogOpen(false);
	}, []);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			let isInTable = false;
			let isOnImage = false;
			let imagePath: readonly number[] | undefined;
			const renderer = canvasRendererRef.current;
			if (renderer) {
				const canvas = renderer.getCanvas();
				if (canvas) {
					const canvasRect = canvas.getBoundingClientRect();
					const canvasX = e.clientX - canvasRect.left;
					const canvasY = e.clientY - canvasRect.top;
					isInTable = renderer.findTableAtCanvasCoords(canvasX, canvasY) !== null;
					const imgResult = renderer.findImageAtCanvasCoords(canvasX, canvasY);
					isOnImage = imgResult !== null;
					if (imgResult) {
						imagePath = imgResult.image.nodePath;
					}
				}
			}

			// Check for spell error at cursor position
			const spPlugin = editor.getPlugin('jpoffice.spellcheck') as SpellcheckPlugin | undefined;
			const sel = editor.getSelection();
			if (spPlugin && sel) {
				const err = spPlugin.getErrorAtPosition(sel.focus.path, sel.focus.offset);
				if (err) {
					setSpellSuggestions({
						word: err.word,
						suggestions: (err.suggestions ?? []).slice(0, 5),
						path: [...err.path],
						offset: err.offset,
						length: err.length,
					});
				} else {
					setSpellSuggestions(null);
				}
			} else {
				setSpellSuggestions(null);
			}

			setContextMenu({ x: e.clientX, y: e.clientY, isInTable, isOnImage, imagePath });
		},
		[editor],
	);

	const handleContextMenuClose = useCallback(() => {
		setContextMenu(null);
	}, []);

	const handleContextMenuAction = useCallback(
		(id: string) => {
			// Spell check actions
			if (id.startsWith('spell.suggest.') && spellSuggestions) {
				const idx = Number(id.replace('spell.suggest.', ''));
				const replacement = spellSuggestions.suggestions[idx];
				if (replacement) {
					try {
						editor.executeCommand('spellcheck.replaceWord', {
							path: spellSuggestions.path,
							offset: spellSuggestions.offset,
							length: spellSuggestions.length,
							replacement,
						});
					} catch {
						/* command not registered */
					}
				}
				return;
			}
			if (id === 'spell.addToDictionary' && spellSuggestions) {
				try {
					editor.executeCommand('spellcheck.addWord', { word: spellSuggestions.word });
				} catch {
					/* command not registered */
				}
				return;
			}
			if (id === 'spell.ignoreAll' && spellSuggestions) {
				try {
					editor.executeCommand('spellcheck.ignore', { word: spellSuggestions.word });
				} catch {
					/* command not registered */
				}
				return;
			}

			try {
				switch (id) {
					case 'cut':
						editor.executeCommand('clipboard.cut');
						break;
					case 'copy':
						editor.executeCommand('clipboard.copy');
						break;
					case 'paste':
						editor.executeCommand('clipboard.paste');
						break;
					case 'delete':
						editor.executeCommand('text.deleteSelection');
						break;
					case 'clear-format':
						editor.executeCommand('format.clearFormatting');
						break;
					// Table actions
					case 'table.insertRow.above':
						editor.executeCommand('table.insertRow', { position: 'above' });
						break;
					case 'table.insertRow.below':
						editor.executeCommand('table.insertRow', { position: 'below' });
						break;
					case 'table.insertCol.left':
						editor.executeCommand('table.insertColumn', { position: 'left' });
						break;
					case 'table.insertCol.right':
						editor.executeCommand('table.insertColumn', { position: 'right' });
						break;
					case 'table.deleteRow':
						editor.executeCommand('table.deleteRow');
						break;
					case 'table.deleteCol':
						editor.executeCommand('table.deleteColumn');
						break;
					case 'table.mergeCells':
						editor.executeCommand('table.mergeCells');
						break;
					case 'table.splitCell':
						editor.executeCommand('table.splitCell');
						break;
					case 'table.properties':
						setTablePropsOpen(true);
						break;
					// Image actions
					case 'image.delete':
						if (contextMenu?.imagePath) editor.executeCommand('image.delete', { path: [...contextMenu.imagePath] });
						break;
					case 'image.resetSize':
						if (contextMenu?.imagePath) editor.executeCommand('image.resetSize', { path: [...contextMenu.imagePath] });
						break;
					case 'image.replace': {
						pickFile('image/*').then((file) => {
							if (!file) return;
							const reader = new FileReader();
							reader.onload = () => {
								const dataUrl = reader.result as string;
								try {
									if (contextMenu?.imagePath) editor.executeCommand('image.replace', { path: [...contextMenu.imagePath], newSrc: dataUrl, newMimeType: file.type });
								} catch { /* command not registered */ }
							};
							reader.readAsDataURL(file);
						});
						break;
					}
					case 'image.properties':
						setImagePropsOpen(true);
						break;
				}
			} catch (e) {
				console.warn('[JPOffice] Context menu action failed:', id, e);
			}
		},
		[editor, spellSuggestions, contextMenu],
	);

	// Panel open handlers for MenuBar
	const handleOpenComments = useCallback(() => setCommentsOpen(true), []);
	const handleOpenStyles = useCallback(() => setStylesOpen(true), []);
	const handleOpenTrackChanges = useCallback(() => setTrackChangesOpen(true), []);
	const handleOpenEquationEditor = useCallback(() => {
		setEquationEditState(null);
		setEquationEditorOpen(true);
	}, []);
	const handleOpenFootnotes = useCallback(() => setFootnotesOpen(true), []);
	const handleOpenPageSetup = useCallback(() => setPageSetupOpen(true), []);
	const handleOpenTableProps = useCallback(() => setTablePropsOpen(true), []);
	const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true), []);

	const handleEquationInsert = useCallback(
		(latex: string, display: 'inline' | 'block') => {
			setEquationEditorOpen(false);
			if (equationEditState) {
				// Update existing equation
				try {
					editor.executeCommand('equation.edit', {
						path: equationEditState.path,
						latex,
					});
				} catch {
					/* command not registered */
				}
				setEquationEditState(null);
			} else {
				// Insert new equation
				try {
					editor.executeCommand('equation.insert', { latex, display });
				} catch {
					/* command not registered */
				}
			}
		},
		[editor, equationEditState],
	);

	// File action handlers (import/export via dynamic import)
	const handleFileAction = useCallback(
		async (actionId: string) => {
			switch (actionId) {
				case 'file.new': {
					if (onFileNew) {
						onFileNew();
						return;
					}
					editor.setDocument(createBlankDocument());
					return;
				}
				case 'file.open': {
					if (onFileOpen) {
						onFileOpen();
						return;
					}
					try {
						const file = await pickFile('.docx');
						if (!file) return;
						const bytes = new Uint8Array(await file.arrayBuffer());
						const { importDocx } = await import('@jpoffice/docx');
						const doc = importDocx(bytes);
						editor.setDocument(doc);
					} catch (err) {
						console.error('[JPOffice] Failed to open file:', err);
					}
					return;
				}
				case 'file.download.docx': {
					if (onDownloadDocx) {
						onDownloadDocx();
						return;
					}
					try {
						const { exportDocx } = await import('@jpoffice/docx');
						const bytes = exportDocx(editor.getDocument());
						const filename = `${title || 'document'}.docx`;
						triggerDownload(
							bytes,
							filename,
							'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
						);
					} catch (err) {
						console.error('[JPOffice] Failed to export DOCX:', err);
					}
					return;
				}
				case 'file.download.pdf': {
					if (onDownloadPdf) {
						onDownloadPdf();
						return;
					}
					try {
						const { exportToPdf } = await import('@jpoffice/pdf');
						const bytes = exportToPdf(editor.getDocument());
						const filename = `${title || 'document'}.pdf`;
						triggerDownload(bytes, filename, 'application/pdf');
					} catch (err) {
						console.error('[JPOffice] Failed to export PDF:', err);
					}
					return;
				}
			}
		},
		[editor, title, onFileNew, onFileOpen, onDownloadDocx, onDownloadPdf],
	);

	const handleMenuAction = useCallback(
		(id: string, action: string) => {
			if (
				id === 'file.new' ||
				id === 'file.open' ||
				id === 'file.download.docx' ||
				id === 'file.download.pdf'
			) {
				handleFileAction(id);
				return;
			}
			onMenuAction?.(id, action);
		},
		[handleFileAction, onMenuAction],
	);

	return (
		<>
			<AnnouncerRegion />
			{/* Skip to content link — visible only on keyboard focus */}
			<a
				href="#jpoffice-editor-content"
				style={{
					position: 'absolute',
					left: -9999,
					top: -9999,
					zIndex: 10001,
					padding: '8px 16px',
					backgroundColor: '#1a73e8',
					color: '#fff',
					fontSize: 14,
					fontFamily: 'system-ui, sans-serif',
					textDecoration: 'none',
					borderRadius: 4,
				}}
				onFocus={(e) => {
					e.currentTarget.style.left = '8px';
					e.currentTarget.style.top = '8px';
				}}
				onBlur={(e) => {
					e.currentTarget.style.left = '-9999px';
					e.currentTarget.style.top = '-9999px';
				}}
			>
				Skip to document content
			</a>

			{/* Title bar */}
			{showTitleBar && <TitleBar title={title} onTitleChange={onTitleChange} onShare={onShare} />}

			{/* Menu bar */}
			{showMenuBar && (
				<MenuBar
					onMenuAction={handleMenuAction}
					onOpenComments={handleOpenComments}
					onOpenStyles={handleOpenStyles}
					onOpenTrackChanges={handleOpenTrackChanges}
					onOpenEquationEditor={handleOpenEquationEditor}
					onOpenFootnotes={handleOpenFootnotes}
					onOpenPageSetup={handleOpenPageSetup}
					onOpenTableProps={handleOpenTableProps}
					onOpenShortcuts={handleOpenShortcuts}
				/>
			)}

			{/* Toolbar with GDocs wrapper background */}
			{showToolbar && mode !== 'viewing' && (
				<div style={{ backgroundColor: '#f9fbfd', paddingBottom: 4, flexShrink: 0 }}>
					<Toolbar
						zoom={zoom}
						onZoomChange={setZoom}
						paintFormatActive={paintFormatActive}
						onPaintFormatToggle={handlePaintFormatToggle}
					/>
				</div>
			)}

			{/* Content area: sidebar + document column */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				{/* Sidebar */}
				{showSidebar && <Sidebar visible={sidebarOpen} onClose={toggleSidebar} />}

				{/* Document column */}
				<div
					id="jpoffice-editor-content"
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
					}}
				>
					{/* Ruler */}
					{showRuler && mode !== 'viewing' && (
						<Ruler
							pageWidth={pageWidthPx}
							marginLeft={marginLeftPx}
							marginRight={marginRightPx}
							indentLeft={currentParaIndent.left}
							indentRight={currentParaIndent.right}
							indentFirstLine={currentParaIndent.firstLine}
							onMarginLeftChange={handleMarginLeftChange}
							onMarginRightChange={handleMarginRightChange}
							onIndentLeftChange={handleIndentLeftChange}
							onIndentRightChange={handleIndentRightChange}
							onIndentFirstLineChange={handleIndentFirstLineChange}
						/>
					)}

					{/* Canvas + mode panel + find/replace + floating toolbar */}
					<div ref={editorContentRef} style={{ position: 'relative', flex: 1, display: 'flex' }}>
						<EditorCanvas
							editor={editor}
							layout={layout}
							selection={state.selection}
							readOnly={mode === 'viewing'}
							zoom={zoom}
							searchHighlights={findMatches}
							searchCurrentIndex={findCurrentIndex}
							onContextMenu={handleContextMenu}
							rendererRef={canvasRendererRef}
							hfEditing={!!hfEditState?.zone}
						/>
						{/* Floating toolbar on text selection */}
						{mode !== 'viewing' && (
							<FloatingToolbar
								editor={editor}
								selectionRect={selectionRect}
								containerRef={editorContentRef}
							/>
						)}
						{/* Header/Footer editing toolbar */}
						{hfEditState?.zone && <HeaderFooterToolbar editor={editor} zone={hfEditState.zone} />}
						{/* Table resize overlay */}
						{mode !== 'viewing' && (
							<TableResizeOverlay
								editor={editor}
								rendererRef={canvasRendererRef}
								zoom={zoom / 100}
							/>
						)}
						{/* Image resize overlay */}
						{mode !== 'viewing' && (
							<ImageResizeOverlay
								editor={editor}
								rendererRef={canvasRendererRef}
								zoom={zoom / 100}
							/>
						)}
						<ModePanel mode={mode} onModeChange={handleModeChange} />
						<FindReplaceBar
							open={findReplaceOpen}
							showReplace={findShowReplace}
							matchCount={findMatches.length}
							currentIndex={findCurrentIndex}
							onSearch={handleFindSearch}
							onNext={handleFindNext}
							onPrevious={handleFindPrevious}
							onReplace={handleFindReplace}
							onReplaceAll={handleFindReplaceAll}
							onClose={handleFindClose}
							onToggleReplace={handleToggleReplace}
						/>
					</div>
				</div>
			</div>

			{/* Status bar */}
			{showStatusBar && <StatusBar language={state.document.metadata.language} />}

			{/* Link dialog */}
			<LinkDialog
				open={linkDialogOpen}
				initialText={editor.getSelectedText()}
				onApply={handleLinkApply}
				onCancel={handleLinkCancel}
			/>

			{/* Context menu */}
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					groups={contextMenuGroups}
					onAction={handleContextMenuAction}
					onClose={handleContextMenuClose}
				/>
			)}

			{/* Sidebar panels */}
			{commentsOpen && (
				<CommentsPanel editor={editor} comments={[]} onClose={() => setCommentsOpen(false)} />
			)}
			{stylesOpen && <StylesPanel editor={editor} onClose={() => setStylesOpen(false)} />}
			{trackChangesOpen && (
				<TrackChangesPanel editor={editor} onClose={() => setTrackChangesOpen(false)} />
			)}
			{footnotesOpen && <FootnotePanel editor={editor} onClose={() => setFootnotesOpen(false)} />}

			{/* Modal dialogs */}
			{equationEditorOpen && (
				<EquationEditor
					onInsert={handleEquationInsert}
					onClose={() => {
						setEquationEditorOpen(false);
						setEquationEditState(null);
					}}
					initialLatex={equationEditState?.latex}
					initialDisplay={equationEditState?.display}
				/>
			)}
			{pageSetupOpen && <PageSetupDialog editor={editor} onClose={() => setPageSetupOpen(false)} />}
			{tablePropsOpen && (
				<TablePropertiesDialog editor={editor} onClose={() => setTablePropsOpen(false)} />
			)}
			{shortcutsOpen && <KeyboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
			{imagePropsOpen && (
				<ImagePropertiesDialog editor={editor} onClose={() => setImagePropsOpen(false)} />
			)}
			{paragraphPropsOpen && (
				<ParagraphPropertiesDialog editor={editor} onClose={() => setParagraphPropsOpen(false)} />
			)}
		</>
	);
}

export function JPOfficeEditor({
	document: initialDocument,
	readOnly = false,
	showToolbar = true,
	showStatusBar = true,
	showRuler = true,
	showTitleBar = false,
	showMenuBar = false,
	showSidebar = false,
	title = 'Untitled document',
	author,
	remoteCursors,
	onTitleChange,
	onMenuAction,
	onShare,
	onFileNew,
	onFileOpen,
	onDownloadDocx,
	onDownloadPdf,
	theme = 'light',
	className,
	style,
	onEditorReady,
}: JPOfficeEditorProps) {
	const editorRef = useRef<JPEditor | null>(null);

	// Create editor once
	if (!editorRef.current) {
		const cursorPath = getInitialCursorPath(initialDocument);
		const initialPoint = { path: cursorPath, offset: 0 };
		const editor = new JPEditor({
			document: initialDocument,
			readOnly,
			selection: { anchor: initialPoint, focus: initialPoint },
		});
		registerBuiltinCommands(editor);
		editor.registerPlugin(new TextPlugin());
		editor.registerPlugin(new FormattingPlugin());
		editor.registerPlugin(new HeadingPlugin());
		editor.registerPlugin(new ListPlugin());
		editor.registerPlugin(new TablePlugin());
		editor.registerPlugin(new ImagePlugin());
		editor.registerPlugin(new ClipboardPlugin());
		editor.registerPlugin(new StylesPlugin());
		editor.registerPlugin(new LinkPlugin());
		editor.registerPlugin(new FindReplacePlugin());
		editor.registerPlugin(new FieldPlugin());
		editor.registerPlugin(new CommentPlugin());
		editor.registerPlugin(new SpellcheckPlugin());
		editor.registerPlugin(new TrackChangesPlugin());
		editor.registerPlugin(new DragDropPlugin());
		editor.registerPlugin(new FootnotePlugin());
		editor.registerPlugin(new PageSetupPlugin());
		editor.registerPlugin(new HeaderFooterPlugin());
		editor.registerPlugin(new EquationPlugin());
		editor.registerPlugin(new AutoCorrectPlugin());
		editor.registerPlugin(new ShapePlugin());
		editorRef.current = editor;
	}

	// Notify when ready
	useEffect(() => {
		if (editorRef.current && onEditorReady) {
			onEditorReady(editorRef.current);
		}
	}, [onEditorReady]);

	// Sync readOnly prop
	useEffect(() => {
		editorRef.current?.setReadOnly(readOnly);
	}, [readOnly]);

	// Cleanup
	useEffect(() => {
		return () => {
			editorRef.current?.destroy();
		};
	}, []);

	const contextValue = useMemo<EditorContextValue>(() => ({ editor: editorRef.current! }), []);

	return (
		<ThemeProvider mode={theme}>
			<EditorContext.Provider value={contextValue}>
				<ScrollContainer
					className={className}
					style={style}
					role="application"
					aria-label="JPOffice word processor"
				>
					<EditorInner
						readOnly={readOnly}
						showToolbar={showToolbar}
						showStatusBar={showStatusBar}
						showRuler={showRuler}
						showTitleBar={showTitleBar}
						showMenuBar={showMenuBar}
						showSidebar={showSidebar}
						title={title}
						author={author}
						remoteCursors={remoteCursors}
						onTitleChange={onTitleChange}
						onMenuAction={onMenuAction}
						onShare={onShare}
						onFileNew={onFileNew}
						onFileOpen={onFileOpen}
						onDownloadDocx={onDownloadDocx}
						onDownloadPdf={onDownloadPdf}
					/>
				</ScrollContainer>
			</EditorContext.Provider>
		</ThemeProvider>
	);
}
