# JPOffice — Plan Completo de Implementacion

> Documento maestro con el estado real de cada modulo, sub-feature y tarea.
> - [x] = 100% completo (backend + frontend + rendering + tests)
> - [ ] = pendiente o incompleto

---

# FASE 1 — Fundacion (Modelo + Setup)

## 1.1 Monorepo Setup
- [x] pnpm-workspace.yaml
- [x] turbo.json (build, test, typecheck, lint)
- [x] tsconfig.base.json (TypeScript strict)
- [x] biome.json (linting + formatting)
- [x] .changeset/config.json (versionado)
- [x] .github/workflows/ci.yml (GitHub Actions: lint, typecheck, build, test)
- [x] tsup.config.ts en cada paquete (ESM + CJS + DTS)

## 1.2 @jpoffice/model — Nodos
- [x] JPBaseNode, JPElement, JPLeaf (node.ts)
- [x] JPDocument (document.ts)
- [x] JPBody (body.ts)
- [x] JPSection (section.ts)
- [x] JPParagraph (paragraph.ts)
- [x] JPRun (run.ts)
- [x] JPText (text.ts)
- [x] JPTable, JPTableRow, JPTableCell (table.ts)
- [x] JPImage (image.ts)
- [x] JPDrawing (drawing.ts)
- [x] JPListItem (list.ts)
- [x] PageBreak, LineBreak, ColumnBreak (break.ts)
- [x] JPHeaderFooter (header-footer.ts)
- [x] JPComment (comment.ts)
- [x] JPField (field.ts)
- [x] JPEquation (equation.ts)
- [x] JPShape, JPShapeGroup (shape.ts)
- [x] JPMention (mention.ts)
- [x] JPTextBox (textbox.ts)
- [x] JPFootnote (footnote.ts)
- [x] JPHyperlink (hyperlink.ts)
- [x] JPBookmarkStart, JPBookmarkEnd (bookmark.ts)
- [x] JPTab, JPCommentRangeStart/End, JPFootnoteRef, JPEndnoteRef (inline nodes)

## 1.3 @jpoffice/model — Propiedades
- [x] paragraph-props.ts (alignment, spacing, indentation, borders, keepNext, widowOrphan)
- [x] run-props.ts (bold, italic, underline, font, size, color, highlight, revision)
- [x] table-props.ts (borders, shading, grid, cell margins, vertical merge)
- [x] section-props.ts (page size, margins, orientation, columns, watermark, line numbering)
- [x] image-props.ts (crop, rotation, flip, wrap, float positioning)
- [x] numbering.ts (numbering definitions, abstract numbering, levels)
- [x] border-props.ts (cell borders, paragraph borders)
- [x] revision-props.ts (track changes metadata)

## 1.4 @jpoffice/model — Estilos
- [x] style.ts (JPStyle interface, paragraph + character styles)
- [x] style-registry.ts (lookup, inheritance, basedOn resolution)
- [x] defaults.ts (Normal, Heading1-6, ListParagraph, table styles)

## 1.5 @jpoffice/model — Operaciones
- [x] operation.ts (tipos: insert_text, delete_text, insert_node, remove_node, split_node, merge_node, move_node, set_properties)
- [x] apply.ts (applyOperation — todas las operaciones)
- [x] invert.ts (invertOperation — todas las operaciones son invertibles)

## 1.6 @jpoffice/model — Utilidades
- [x] path.ts (JPPath, comparacion, ancestros)
- [x] selection.ts (JPSelection, JPRange, JPPoint)
- [x] traverse.ts (traverseNodes, traverseElements, traverseTexts, getNodeAtPath, countText, getPlainText)
- [x] normalize.ts (reglas de normalizacion del arbol)
- [x] units.ts (twips, EMU, pt, px, inches, cm, half-points, eighth-points)

## 1.7 Tests del Modelo
- [x] normalize.test.ts
- [x] numbering.test.ts
- [x] operations.test.ts
- [x] path.test.ts
- [x] styles.test.ts
- [x] traverse.test.ts
- [x] units.test.ts
- [x] ~149 test cases pasando

---

# FASE 2 — Layout Engine

## 2.1 Text Measurement
- [x] text-measurer.ts (Canvas measureText + font metrics caching)
- [x] Font ascent, descent, lineHeight calculation
- [x] LRU eviction para cache de metricas

## 2.2 Line Breaking
- [x] Algoritmo greedy (default, rapido)
- [x] Algoritmo Knuth-Plass (optimal, para justified text)
- [x] knuth-plass.ts (box/glue/penalty model, dynamic programming)
- [x] Fallback a greedy si optimal falla o hay floats
- [x] BiDi support (bidi.ts — RTL/LTR text reordering)
- [x] Hyphenation support

## 2.3 Block Layout
- [x] Paragraph spacing (spaceBefore, spaceAfter)
- [x] Indentation (left, right, firstLine, hanging)
- [x] Alignment (left, center, right, justify)
- [x] Tab stops y tab leaders

## 2.4 Page Breaking
- [x] Paginacion automatica
- [x] Page breaks explicitos
- [x] Widow/orphan control (minimo 2 lineas por pagina)
- [x] keepNext (no separar del siguiente parrafo)
- [x] keepLines (parrafo entero en una pagina)
- [x] Lookahead validation antes de page break

## 2.5 Table Layout
- [x] Column width calculation (grid, explicit, auto-distribution)
- [x] Merged cells (gridSpan + rowSpan via verticalMerge)
- [x] Cell content layout (paragrafos dentro de celdas)
- [x] Row height auto (calculada desde contenido)
- [x] Cell grid resolution con merged cell mapping

## 2.6 Float Layout
- [x] Image wrapping (none, topAndBottom, square, tight, through)
- [x] Exclusion zones para cada linea de texto
- [x] Side handling (left, right, both)
- [x] Anchor-relative y absolute positioning

## 2.7 Column Layout
- [x] column-layout.ts (calculateColumnRegions, distributeBlocksToColumns)
- [x] Equal width con spacing
- [x] Column separator rendering
- [x] Overflow handling (blocks para next page)

## 2.8 Header/Footer Layout
- [x] Header/footer areas con positioning correcto
- [x] Different first page layout
- [x] Different odd/even layout

## 2.9 Extras de Layout
- [x] Watermark layout
- [x] Page borders layout
- [x] Line numbering layout
- [x] Footnote area layout (separador + bloques)
- [x] Style resolver (cascade de estilos con herencia)
- [x] Layout cache con invalidacion

## 2.10 Tests de Layout
- [x] cache.test.ts
- [x] float-layout.test.ts
- [x] header-footer-layout.test.ts
- [x] knuth-plass.test.ts
- [x] layout-engine.test.ts
- [x] line-breaker.test.ts
- [x] style-resolver.test.ts
- [x] table-layout.test.ts
- [x] text-measurer.test.ts
- [x] ~141 test cases pasando

---

# FASE 3 — Renderer + Editor Core

## 3.1 @jpoffice/renderer — Canvas Rendering
- [x] canvas-renderer.ts (coordinador principal con viewport optimization)
- [x] page-renderer.ts (page chrome: fondo, sombra, bordes de pagina, margenes, watermarks)
- [x] text-renderer.ts (texto con font, decoraciones, revision coloring)
- [x] table-renderer.ts (tablas con borders, shading, merged cell borders)
- [x] image-renderer.ts (carga async con placeholder "Loading...")
- [x] selection-renderer.ts (selection highlight multi-linea, search highlights)
- [x] cursor-renderer.ts (cursor parpadeante configurable, 530ms)
- [x] hit-test.ts (click → posicion en documento, tablas anidadas, closest block)
- [x] shape-renderer.ts (20+ tipos de shapes, rotation, fill, stroke)
- [x] equation-renderer.ts (100+ simbolos LaTeX, fracciones, sub/superscript)
- [x] squiggly-renderer.ts (lineas onduladas para spell check)
- [x] remote-cursor-renderer.ts (cursores de colaboracion remotos)

### Gaps en Renderer
- [ ] image-renderer: No aplica crop (clip path)
- [ ] image-renderer: No aplica rotation (ctx.rotate)
- [ ] image-renderer: No aplica flip (ctx.scale(-1,1))
- [ ] image-renderer: No renderiza bordes de imagen
- [ ] image-renderer: No muestra estado de error (solo ignora onerror)
- [ ] table-renderer: Border style variants (dashed, dotted, double) no renderizados — solo solid
- [ ] equation-renderer: No soporta matrices, integrales con limites, environments
- [ ] hit-test: Click sobre imagen no la selecciona (solo detecta paragrafos/tablas)

## 3.2 @jpoffice/engine — Editor Core
- [x] editor.ts (JPEditor — coordinador central, subscribe/listener)
- [x] editor-state.ts (JPEditorState — snapshot inmutable)

## 3.3 @jpoffice/engine — Commands
- [x] command.ts (JPCommand interface generica)
- [x] registry.ts (registro y ejecucion de comandos)
- [x] text-commands.ts (insert_text, delete, backspace, break_paragraph)
- [x] format-commands.ts (bold, italic, underline, font, size, color)
- [x] history-commands.ts (undo, redo)
- [x] selection-commands.ts (move, expand, collapse, selectAll)

## 3.4 @jpoffice/engine — History
- [x] history.ts (Undo/Redo stack via inverse operations)
- [x] batch.ts (agrupar operaciones en un solo undo step)

## 3.5 @jpoffice/engine — Input
- [x] input-manager.ts (Keyboard/IME/Composition via hidden textarea)
- [x] keybindings.ts (mapa de atajos configurable)
- [x] clipboard (ClipboardPlugin maneja copy/paste)

## 3.6 @jpoffice/engine — Selection
- [x] selection-manager.ts (posicionamiento y movimiento de seleccion)

## 3.7 @jpoffice/engine — Plugins (24 plugins)
- [x] TextPlugin (input, delete, Enter)
- [x] HistoryPlugin (Undo/Redo con operaciones inversas)
- [x] SelectionPlugin (arrow keys, Home, End, PgUp, PgDn)
- [x] FormattingPlugin (bold, italic, underline, fonts, colores, sizes, super/subscript)
- [x] HeadingPlugin (H1-H6, outline levels)
- [x] StylesPlugin (aplicar/crear/modificar/eliminar estilos)
- [x] ListPlugin (ordered/unordered, nesting, numbering engine)
- [x] TablePlugin (crear, merge/split cells, resize, borders, shading, tab navigation)
- [x] ImagePlugin (9 comandos: insert, resize, crop, rotate, flip, wrap, altText, replace, resetSize)
- [x] ClipboardPlugin (copy/paste HTML + formato interno)
- [x] LinkPlugin (insert/edit hyperlinks con smart selection)
- [x] FindReplacePlugin (find/replace con case-sensitive toggle)
- [x] FieldPlugin (date, time, page numbers, etc.)
- [x] CommentPlugin (add, reply, resolve, delete)
- [x] SpellcheckPlugin (deteccion de errores, diccionario usuario, debounce 300ms)
- [x] TrackChangesPlugin (track insert/delete/format, accept/reject individual y batch)
- [x] DragDropPlugin (drag-and-drop de contenido)
- [x] FootnotePlugin (insert footnotes/endnotes, numeracion, navegacion)
- [x] PageSetupPlugin (page size, margins, orientation, columns, watermark)
- [x] HeaderFooterPlugin (enter/exit edit mode, different first/odd/even, field insertion)
- [x] EquationPlugin (insert/edit ecuaciones LaTeX)
- [x] AutoCorrectPlugin (smart quotes, auto-capitalization, reglas configurables)
- [x] ShapePlugin (insert, move, resize, rotate, delete, group/ungroup)
- [x] MentionPlugin (@mentions con autocomplete)

## 3.8 @jpoffice/engine — Colaboracion
- [x] collab-provider.ts (OT client protocol, 3-state machine)
- [x] websocket-transport.ts (WebSocket message handling)
- [x] operation-transform.ts (transformOperation, transformPath, transformMany)

## 3.9 @jpoffice/engine — Extras
- [x] OfflineStore (almacenamiento offline y sync)
- [x] VersionManager (versionado y snapshots)
- [x] TouchManager (input tactil para mobile/tablet)
- [x] BrowserSpellCheckProvider (spellcheck nativo del browser)

## 3.10 Tests de Renderer + Engine
- [x] Renderer: 6 test files, ~56 test cases
- [x] Engine: 12 test files, ~171 test cases

---

# FASE 4 — React Integration

## 4.1 Componentes Principales
- [x] JPOfficeEditor.tsx (componente principal 'use client')
- [x] JPOfficeViewer.tsx (solo lectura)
- [x] EditorCanvas.tsx (canvas + hidden textarea + mouse/keyboard wiring)

## 4.2 Hooks (20 hooks)
- [x] useEditor
- [x] useEditorState (useSyncExternalStore)
- [x] useSelection
- [x] useCommand
- [x] useLayout
- [x] useStyles
- [x] useComments
- [x] useFootnotes
- [x] useTrackChanges
- [x] useDocumentOutline
- [x] useDocumentStats
- [x] useDragDrop
- [x] useCollaboration
- [x] useOffline
- [x] usePrintPreview
- [x] useResponsive
- [x] useSelectionRect
- [x] useCurrentPage
- [x] useAnnounce
- [x] useVersionHistory

## 4.3 Componentes UI (28 componentes)
- [x] Toolbar (font picker, size, colors, formatting buttons, LineSpacingDropdown)
- [x] MenuBar (File, Edit, View, Insert, Format, Tools)
- [x] Sidebar (collapsible, multiple panels)
- [x] StatusBar (word count, page number, zoom, file info)
- [x] Ruler (horizontal, indent/tab markers)
- [x] ScrollContainer (virtual scrolling)
- [x] TitleBar (document title editable)
- [x] OutlinePanel (heading navigation)
- [x] StylesPanel (lista de estilos con preview)
- [x] StyleEditDialog (crear/modificar estilos)
- [x] CommentsPanel (ver, agregar, responder, resolver comments)
- [x] TrackChangesPanel (ver y gestionar revisiones)
- [x] FootnotePanel (ver y gestionar footnotes)
- [x] EquationEditor (input LaTeX + symbol picker)
- [x] LinkDialog (insert/edit hyperlinks)
- [x] FindReplaceBar (find, replace, case-sensitive, navigate)
- [x] PageSetupDialog (page size, margins, orientation)
- [x] TablePropertiesDialog (table + cell properties)
- [x] TableSizePicker (grilla de seleccion rapida)
- [x] PrintPreview (preview + print + zoom + navigation)
- [x] HeaderFooterToolbar (toolbar flotante para edicion HF)
- [x] KeyboardShortcutsDialog (lista de atajos)
- [x] MobileToolbar (optimizado para touch)
- [x] MentionAutocomplete (suggestions de @mention)
- [x] ShapePicker (galeria de shapes)
- [x] ContextMenu (click derecho con grupos y submenus)
- [x] ModeButtons (editing / suggesting / viewing)
- [x] EditorCanvas (canvas + textarea + event handling)

## 4.4 Overlays
- [x] FloatingToolbar (toolbar contextual en seleccion)
- [x] TableResizeOverlay (resize columnas/filas con drag)
- [x] ShapeSelectionOverlay (seleccion, move, resize de shapes)
- [ ] **ImageResizeOverlay** — NO EXISTE (ver Fase 9.1)

## 4.5 Context / Theme
- [x] EditorContext (provider para editor + state)
- [x] Theme system (lightTheme, darkTheme, highContrastTheme)
- [x] ThemeProvider + useTheme hook

## 4.6 Tests de React
- [x] 6 test files, ~85 test cases

---

# FASE 5 — Plugins de Features

> Todos los 24 plugins estan implementados en engine. Esta seccion evalua si la cadena completa
> (plugin → comando → rendering → UI React → interaccion usuario) funciona end-to-end.

## 5.1 Text + Formatting
- [x] Typing de texto (InputManager → TextPlugin)
- [x] Delete/Backspace
- [x] Enter (break_paragraph)
- [x] Bold/Italic/Underline (toggle con Ctrl+B/I/U)
- [x] Font family picker
- [x] Font size picker
- [x] Font color picker
- [x] Highlight color picker
- [x] Superscript / Subscript
- [x] Strikethrough
- [x] Clear formatting

## 5.2 Headings
- [x] Apply Heading 1-6 via toolbar dropdown
- [x] Outline levels asignados automaticamente
- [x] OutlinePanel muestra headings

## 5.3 Lists
- [x] Ordered list (numbered)
- [x] Unordered list (bulleted)
- [x] Nesting (Tab para indent, Shift+Tab para outdent)
- [x] Numbering engine (restarts, continuation)
- [x] DOCX round-trip de listas

## 5.4 Tables — End-to-End
- [x] Crear tabla via TableSizePicker
- [x] Tab para navegar entre celdas
- [x] Merge cells
- [x] Split cells
- [x] Resize columnas (TableResizeOverlay)
- [x] Resize filas (TableResizeOverlay)
- [x] Table borders y shading
- [x] TablePropertiesDialog
- [x] Cell vertical alignment
- [ ] Table border style variants en canvas (dashed, dotted, double) — solo solid renderiza
- [ ] Table border style variants en PDF — solo solid renderiza

## 5.5 Images — End-to-End
- [x] Insert image (file picker → data URL → ImagePlugin)
- [x] Image rendering en canvas (basico: drawImage)
- [x] Image rendering en PDF
- [x] Image DOCX import/export
- [x] ImagePlugin: 9 comandos backend (resize, crop, rotate, flip, wrap, altText, replace, resetSize)
- [ ] **ImageResizeOverlay** (8 handles + rotation handle)
- [ ] **ImageCropOverlay** (modo crop visual)
- [ ] **ImagePropertiesDialog** (dimensiones, alt text, wrap type)
- [ ] **Image context menu** (resize, crop, wrap, replace, delete)
- [ ] **Image selection** (click imagen → borde azul, deselect click fuera)
- [ ] **Image hit-test** (click sobre imagen debe detectarla)
- [ ] **Crop rendering** (clip path en canvas y PDF)
- [ ] **Rotation rendering** (ctx.rotate en canvas, cm operator en PDF)
- [ ] **Flip rendering** (ctx.scale(-1,1) en canvas)
- [ ] **Image error state** (mostrar icono de error si falla la carga)
- [ ] **Image border rendering** (bordes alrededor de imagen)

## 5.6 Clipboard
- [x] Copy (Ctrl+C) — HTML + internal format
- [x] Cut (Ctrl+X)
- [x] Paste (Ctrl+V) — parse HTML, aplica formato
- [x] Paste plain text (Ctrl+Shift+V)

## 5.7 Styles
- [x] Apply style desde StylesPanel
- [x] Create new style (StyleEditDialog)
- [x] Modify existing style
- [x] Delete custom style
- [x] Style inheritance (basedOn)

## 5.8 Link
- [x] Insert hyperlink (LinkDialog)
- [x] Edit existing hyperlink
- [x] Ctrl+K shortcut
- [x] Hyperlink rendering (azul, subrayado)

## 5.9 Find & Replace
- [x] Find text en body (FindReplaceBar)
- [x] Replace current match
- [x] Replace all
- [x] Case-sensitive toggle
- [x] Navigate next/previous (search highlights en canvas)
- [ ] Find in headers/footers
- [ ] Find in footnotes/endnotes
- [ ] Find in text boxes/shapes
- [ ] Whole word matching
- [ ] Regex search
- [ ] Find in selection

## 5.10 Fields
- [x] Insert field (date, time, page number, num pages)
- [x] Field rendering en canvas
- [x] Field codes en DOCX
- [ ] Field update on repagination (PAGE/NUMPAGES dinamicos)
- [ ] ALT+F9 toggle field codes view

## 5.11 Comments — End-to-End
- [x] Add comment (CommentPlugin)
- [x] Reply to comment
- [x] Resolve comment
- [x] Delete comment
- [x] CommentsPanel en sidebar
- [x] DOCX import/export de comments
- [ ] **Comment range highlight** en canvas (background amarillo en texto comentado)
- [ ] **Comment margin markers** (indicador visual en margen derecho)
- [ ] **Hover tooltip** sobre texto comentado
- [ ] **Keyboard shortcut** (Ctrl+Alt+M)
- [ ] **Comment navigation** (Ctrl+PageDown/Up entre comments)

## 5.12 Spell Check — End-to-End
- [x] SpellcheckPlugin detects errores con BrowserSpellCheckProvider
- [x] User dictionary (add/remove words)
- [x] Debounced incremental checking (300ms)
- [x] squiggly-renderer.ts (lineas onduladas rojas)
- [x] canvas-renderer.ts renderSpellErrors() dibuja squiggly lines
- [x] renderer.setSpellErrors() API existe
- [ ] **Wiring React** verificar que plugin → renderer.setSpellErrors() esta conectado en JPOfficeEditor
- [ ] **Context menu** con sugerencias, "Add to Dictionary", "Ignore"
- [ ] **Status bar indicator** (icono spellcheck on/off)
- [ ] **Multi-idioma** selector

## 5.13 Track Changes — End-to-End
- [x] TrackChangesPlugin intercepta operaciones
- [x] Soft deletion (marca runs con revision en vez de borrar)
- [x] Accept/reject individual
- [x] Accept all / Reject all
- [x] TrackChangesPanel en sidebar
- [x] Text renderer: insertion → underline, deletion → strikethrough, author color
- [x] DOCX import/export de revisiones
- [ ] **Revision marks en margen** (balloon indicators con autor + fecha)
- [ ] **Toggle show/hide changes** visual

## 5.14 Footnotes — End-to-End
- [x] Insert footnote (FootnotePlugin)
- [x] Footnote numbering
- [x] Footnote area rendering (separador + bloques)
- [x] FootnotePanel en sidebar
- [x] DOCX import/export
- [x] Navigation footnote ref ↔ footnote content
- [ ] **Endnotes** separados de footnotes (rendering al final del documento)

## 5.15 Page Setup
- [x] PageSetupDialog (size, margins, orientation)
- [x] Column presets (1, 2, 3)
- [x] Watermark command
- [x] Line numbering command
- [ ] **Columns Dialog** completo (custom widths, separator line toggle)
- [ ] **Continuous section break** para cambiar columnas mid-page

## 5.16 Headers/Footers — End-to-End
- [x] HeaderFooterPlugin (enter/exit edit mode)
- [x] Different first page toggle
- [x] Different odd/even toggle
- [x] Field insertion (PAGE, NUMPAGES)
- [x] Rendering de header/footer blocks en canvas
- [x] Dimming overlay en body cuando se edita HF
- [x] HeaderFooterToolbar componente creado
- [x] Double-click en zona HF entra en modo edicion (EditorCanvas)
- [x] DOCX import/export de headers/footers
- [ ] **HeaderFooterToolbar integrado** en JPOfficeEditor (no aparece visualmente)
- [ ] **Cursor placement** en HF al entrar en modo edicion
- [ ] **Hit-test para HF blocks** (click en header → posicionar cursor en header content)
- [ ] **Field update dinamico** (PAGE number actualiza al paginar)

## 5.17 Equations — End-to-End
- [x] EquationPlugin (insert/edit)
- [x] EquationEditor componente (input LaTeX)
- [x] EquationRenderer: Greek letters, fracciones (\frac), sqrt, sub/superscript
- [x] 100+ simbolos LaTeX mapeados
- [x] DOCX import/export (OMML ↔ LaTeX)
- [ ] **Matrices** (\begin{matrix}, \begin{pmatrix}, \begin{bmatrix})
- [ ] **Integrales con limites** (\int_a^b, \oint, \iint)
- [ ] **Sumas con limites** (\sum_{i=0}^{n}, \prod)
- [ ] **Limites** (\lim_{x \to 0})
- [ ] **Environments** (\begin{cases}, \begin{aligned})
- [ ] **Delimitadores escalables** (\left( \right))
- [ ] **Acentos** (\hat, \bar, \vec, \dot)
- [ ] **\text{} y \mathrm{}** dentro de ecuaciones
- [ ] **Display mode** (mas grande, centrado, spacing vertical distinto)
- [ ] **PDF vectorial** (hoy ecuaciones se rasterizan)

## 5.18 AutoCorrect
- [x] Smart quotes (rectas → tipograficas segun contexto)
- [x] Auto-capitalizacion despues de punto
- [x] Reglas configurables ((c)→©, --→—, etc.)
- [x] DEFAULT_AUTOCORRECT_RULES
- [ ] **Auto-list** ("1. " + space → crear lista numerada)
- [ ] **Auto-heading** ("# " → Heading 1)

## 5.19 Shapes — End-to-End
- [x] ShapePlugin (insert, move, resize, rotate, delete)
- [x] ShapeRenderer (20+ tipos, rotation, fill, stroke, gradientes lineales)
- [x] ShapeSelectionOverlay (seleccion, move, resize handles)
- [x] ShapePicker componente (galeria de shapes)
- [x] DOCX import/export de shapes
- [x] PDF export de shapes
- [ ] **Text editing dentro de shapes** (click → cursor, typing, formatting)
- [ ] **Shape grouping UI** (seleccionar multiples + Ctrl+G)
- [ ] **Z-ordering UI** (bring to front, send to back)
- [ ] **Shape connectors** (lineas que enlazan shapes)
- [ ] **Drop shadow / glow / reflection**
- [ ] **Gradientes radiales/conicos**

## 5.20 Mentions
- [x] MentionPlugin (@mentions)
- [x] MentionAutocomplete (suggestions dropdown)

## 5.21 Drag & Drop
- [x] DragDropPlugin basico
- [ ] **Drag text selection** a otra posicion
- [ ] **Drag images desde filesystem** (drop de archivos)
- [ ] **Drag table rows/columns**

---

# FASE 6 — DOCX Import/Export

## 6.1 XML Platform Layer
- [x] xml-parser.ts (isomorphic: DOMParser browser + @xmldom SSR)
- [x] xml-builder.ts (generador XML zero deps)
- [x] namespaces.ts (constantes OOXML)

## 6.2 Importer
- [x] docx-reader.ts (ZIP extraction via fflate)
- [x] relationships-parser.ts
- [x] styles-parser.ts
- [x] numbering-parser.ts
- [x] document-parser.ts (recursive body parsing)
- [x] table-parser.ts
- [x] drawing-parser.ts (inline + anchor + shapes)
- [x] footnote-parser.ts
- [x] comment-parser.ts
- [x] equation-parser.ts (OMML → LaTeX)
- [x] theme-parser.ts (colores basicos)
- [x] DocxImporter orchestrator

## 6.3 Exporter
- [x] content-types-writer.ts
- [x] relationships-writer.ts
- [x] styles-writer.ts
- [x] numbering-writer.ts
- [x] document-writer.ts
- [x] table-writer.ts (celdas, borders, shading)
- [x] drawing-writer.ts (inline + floating images)
- [x] footnote-writer.ts
- [x] comment-writer.ts
- [x] equation-writer.ts (LaTeX → OMML)
- [x] DocxExporter orchestrator + fflate zip

## 6.4 RTF / .doc Export
- [x] rtf-exporter.ts (orchestrator)
- [x] rtf-writer.ts (bajo nivel RTF)
- [x] rtf-paragraph.ts
- [x] rtf-run.ts
- [x] rtf-table.ts

## 6.5 Web Worker
- [x] docx-worker.ts (Web Worker para import/export async)
- [x] worker-client.ts (API cliente con fallback sync)
- [x] worker-types.ts (tipos de mensajes)

## 6.6 Tests DOCX
- [x] importer.test.ts
- [x] round-trip.test.ts (import → export → comparar)
- [x] rtf-exporter.test.ts
- [x] xml-builder.test.ts
- [x] ~81 test cases

---

# FASE 7 — PDF Export

## 7.1 Core PDF
- [x] pdf-writer.ts (PDF 1.7 binary format, object streams, xref, trailer)
- [x] pdf-document.ts (orchestrator: layout → PDF pages)
- [x] content-stream.ts (ContentStreamBuilder — operadores PDF)

## 7.2 Text
- [x] text-painter.ts (BT/ET, Tj, Tm, font selection, kerning, spacing)
- [x] CID fonts para Unicode (cid-font.ts)
- [x] ToUnicode CMap (to-unicode-cmap.ts)

## 7.3 Fonts
- [x] font-registry.ts (cache y lookup)
- [x] font-subsetter.ts (subsetting via fontkit)
- [x] CFF/TrueType handling

## 7.4 Graphics
- [x] table-painter.ts (borders, shading, merged cells)
- [x] shape-painter.ts (vector shapes, rotation, gradients)
- [x] image-embedder.ts (JPEG passthrough, PNG)

## 7.5 Advanced PDF
- [x] pdf-annotations.ts (hyperlink annotations clickeables)
- [x] pdf-outlines.ts (document bookmarks desde headings)
- [x] pdf-structure-tree.ts (tagged PDF para accesibilidad)
- [x] pdf-tags.ts (MCID support)

## 7.6 Tests PDF
- [x] content-stream.test.ts
- [x] font-map.test.ts
- [x] pdf-document.test.ts
- [x] pdf-writer.test.ts
- [x] table-painter.test.ts
- [x] text-painter.test.ts
- [x] unit-utils.test.ts
- [x] ~83 test cases

---

# FASE 8 — Polish, Avanzado, y Aplicaciones

## 8.1 Collaboration Server
- [x] apps/collab-server/room.ts (rooms, client tracking, version tracking)
- [x] apps/collab-server/ot-server.ts (OT server-side transforms)
- [x] apps/collab-server/awareness.ts (cursor/selection sharing)
- [x] WebSocket protocol (sync, op, awareness, client-joined/left)

## 8.2 Demo App
- [x] apps/demo (Next.js 15 + React 19)
- [x] Funcional en development mode

## 8.3 @jpoffice/core
- [x] Re-export bundle de todos los paquetes

## 8.4 Accesibilidad Basica
- [x] EditorCanvas: aria-label, aria-describedby, aria-live para cursor
- [x] Screen reader announcements (status + alerts)
- [x] Hidden textarea tiene aria-label
- [x] High contrast theme existe
- [x] Tagged PDF (structure tree)
- [ ] **ARIA completo** en canvas (role="application")
- [ ] **Keyboard-only navigation** completa del toolbar
- [ ] **Alt text validator** (warning si imagen no tiene alt text)

## 8.5 Print
- [x] PrintPreview componente completo (preview + zoom + paginas + print)
- [x] usePrintPreview hook (renderiza paginas a images)

---

# FASE 9 — Modulos Faltantes (No Implementados)

## 9.1 Image System Completo (PRIORIDAD 1)

### 9.1.1 LayoutImage Extendido
- [ ] Agregar a LayoutImage: `crop?: JPImageCrop`, `rotation?: number`, `flipH?: boolean`, `flipV?: boolean`
- [ ] Layout engine debe pasar estos valores desde JPImage properties al LayoutImage

### 9.1.2 Image Renderer Mejorado
- [ ] Crop rendering: `ctx.beginPath(); ctx.rect(cropRect); ctx.clip(); ctx.drawImage(...)`
- [ ] Rotation: `ctx.translate(center); ctx.rotate(radians)`
- [ ] Flip: `ctx.scale(-1, 1)` para flipH, `ctx.scale(1, -1)` para flipV
- [ ] Image borders: `ctx.strokeRect()` con estilo configurable
- [ ] Error state: icono de imagen rota cuando `img.onerror`
- [ ] Image selection border: borde azul cuando imagen seleccionada

### 9.1.3 Image Hit-Test
- [ ] `hitTestPage` debe detectar `isLayoutImage(block)` y devolver el nodePath de la imagen
- [ ] Retornar un `HitTestResult` especial que indique "hit image" vs "hit text"
- [ ] O retornar un `ImageHitResult` que incluya `imagePath` para que React sepa mostrar el overlay

### 9.1.4 ImageResizeOverlay (NUEVO)
- [ ] `packages/react/src/overlays/ImageResizeOverlay.tsx`
- [ ] 8 handles de resize (4 esquinas + 4 bordes medios)
- [ ] Handle de rotacion (circular, arriba del borde superior)
- [ ] Mantener aspect ratio con Shift (solo esquinas)
- [ ] Drag state machine: `idle → hover-handle → dragging → commit`
- [ ] On commit: `editor.executeCommand('image.resize', { path, width, height })`
- [ ] Delete key cuando imagen seleccionada: `editor.executeCommand('remove_node', ...)`
- [ ] Escape para deseleccionar

### 9.1.5 ImageCropOverlay (NUEVO)
- [ ] `packages/react/src/overlays/ImageCropOverlay.tsx`
- [ ] Entrar con double-click sobre imagen seleccionada
- [ ] 8 handles de crop (cada borde y esquina)
- [ ] Area fuera del crop oscurecida (overlay semi-transparente)
- [ ] On commit: `editor.executeCommand('image.crop', { path, crop: { top, right, bottom, left } })`
- [ ] Enter para confirmar crop, Escape para cancelar

### 9.1.6 ImagePropertiesDialog (NUEVO)
- [ ] `packages/react/src/components/ImagePropertiesDialog.tsx`
- [ ] Tab 1: Size — width, height, lock aspect ratio, reset size
- [ ] Tab 2: Position — wrap type (inline, square, tight, behind, inFront)
- [ ] Tab 3: Alt Text — text input
- [ ] Tab 4: Crop — numeric inputs para cada borde (%)
- [ ] Open via context menu o double-click

### 9.1.7 Image Context Menu
- [ ] Agregar items al ContextMenu cuando click derecho sobre imagen
- [ ] Items: Size & Position, Crop, Alt Text, Wrap Type submenu, Replace Image, Reset Size, Delete
- [ ] Separator visual entre grupos

### 9.1.8 Image en PDF
- [ ] Crop: calcular crop rect y usar re/W/n operators para clipping
- [ ] Rotation: usar cm operator con rotation matrix

---

## 9.2 Headers/Footers UI Completa (PRIORIDAD 1)

- [ ] Integrar HeaderFooterToolbar en JPOfficeEditor (mostrar cuando `hfEditing` es true)
- [ ] Cursor placement: al entrar en modo HF, ejecutar setSelection al primer text node del HF
- [ ] Hit-test para HF: `hitTestPage` debe buscar en `page.header.blocks` y `page.footer.blocks`
- [ ] Field update: re-evaluar PAGE/NUMPAGES cuando layout cambia
- [ ] Navegacion: flechas arriba/abajo navegan entre HF de distintas paginas

---

## 9.3 Paragraph Properties Dialog (PRIORIDAD 1)

- [ ] `packages/react/src/components/ParagraphPropertiesDialog.tsx`
- [ ] Tab "Indents & Spacing": left, right, first line, hanging, spaceBefore, spaceAfter, line spacing
- [ ] Tab "Line & Page Breaks": page break before, keepNext, keepLines, widowOrphan
- [ ] Leer valores actuales del parrafo seleccionado
- [ ] On apply: `editor.executeCommand('formatting.setParagraphProperties', { ... })`
- [ ] Acceso: Format menu → Paragraph, o click derecho → Paragraph

---

## 9.4 Comments en Documento (PRIORIDAD 2)

- [ ] Rendering en canvas: background highlight para comment ranges
- [ ] Identificar ranges de comment en el layout (commentRangeStart → commentRangeEnd)
- [ ] Dibujar highlight semi-transparente (amarillo/naranja) sobre lineas afectadas
- [ ] Margin marker: linea o dot en margen derecho de pagina indicando comment
- [ ] Hover: tooltip con comment text al pasar mouse sobre highlighted text
- [ ] Keyboard shortcut: Ctrl+Alt+M para insertar comment en seleccion actual

---

## 9.5 Spell Check Context Menu (PRIORIDAD 2)

- [ ] Verificar wiring: SpellcheckPlugin errors → renderer.setSpellErrors() en JPOfficeEditor
- [ ] Context menu: al click derecho sobre palabra con error, mostrar sugerencias
- [ ] Items: sugerencias (max 5), separador, "Add to Dictionary", "Ignore", "Ignore All"
- [ ] On select suggestion: reemplazar palabra
- [ ] Status bar: icono de spellcheck con toggle on/off

---

## 9.6 Find & Replace Extendido (PRIORIDAD 2)

- [ ] Buscar en headers/footers (recorrer page.header/footer blocks)
- [ ] Buscar en footnotes (recorrer footnote nodes)
- [ ] Whole word matching (checkbox + word boundary check)
- [ ] Regex search (checkbox + RegExp)
- [ ] Find in selection (checkbox + limit range)

---

## 9.7 Table Border Styles (PRIORIDAD 2)

- [ ] table-renderer.ts: Implementar `ctx.setLineDash()` para dashed y dotted
- [ ] table-renderer.ts: Double border — dibujar 2 lineas paralelas con gap
- [ ] table-painter.ts (PDF): Dash patterns en content stream para borders dashed/dotted
- [ ] table-painter.ts (PDF): Double border en PDF

---

## 9.8 Shape Text Editing (PRIORIDAD 2)

- [ ] Click dentro de shape con texto → entrar modo text editing
- [ ] Cursor parpadeante dentro del shape
- [ ] Typing inserta texto en el shape
- [ ] Formatting (bold, italic, font) dentro del shape
- [ ] Escape para salir del modo text editing

---

## 9.9 Table of Contents (PRIORIDAD 3)

- [ ] `packages/model/src/nodes/toc.ts` — nodo TOC
- [ ] `packages/engine/src/plugins/toc/toc-plugin.ts` — insert, update, remove
- [ ] TOC generator: recorrer document headings, calcular paginas del layout
- [ ] TOC layout: entries con tab leader (dots) + numero de pagina alineado derecha
- [ ] TOC renderer: dibujar entries como parrafos especiales con links internos
- [ ] DOCX import: parsear `w:sdt` con TOC field codes
- [ ] DOCX export: generar TOC field codes
- [ ] PDF: internal links a cada heading
- [ ] React: Insert menu → Table of Contents

---

## 9.10 Bookmarks & Cross-References (PRIORIDAD 3)

- [ ] `packages/engine/src/plugins/bookmark/bookmark-plugin.ts` — insert, delete, goto
- [ ] `packages/react/src/components/BookmarkDialog.tsx` — Insert → Bookmark
- [ ] Cross-reference dialog: Insert → Cross Reference
- [ ] REF field codes para cross-references
- [ ] Internal hyperlink navigation a bookmark

---

## 9.11 Columns Dialog (PRIORIDAD 3)

- [ ] `packages/react/src/components/ColumnsDialog.tsx`
- [ ] Presets: 1, 2, 3, Left (narrow+wide), Right (wide+narrow)
- [ ] Custom widths y spacing entre columnas
- [ ] Separator line toggle
- [ ] Column break insertion

---

## 9.12 Borders & Shading Dialog (PRIORIDAD 3)

- [ ] `packages/react/src/components/BordersShadingDialog.tsx`
- [ ] Paragraph borders: top, bottom, left, right + styles + colors + widths
- [ ] Paragraph shading: background color
- [ ] Page borders (section-level)
- [ ] Preview visual del resultado

---

## 9.13 Equation Editor Avanzado (PRIORIDAD 3)

- [ ] Matrices: \begin{matrix}, \begin{pmatrix}, \begin{bmatrix}
- [ ] Integrales: \int, \oint, \iint con limites superior/inferior
- [ ] Sumas: \sum, \prod con limites
- [ ] Environments: \begin{cases}, \begin{aligned}
- [ ] Delimitadores: \left( \right), \left[ \right]
- [ ] Acentos: \hat, \bar, \vec, \dot
- [ ] \text{} y \mathrm{} dentro de ecuaciones
- [ ] Display vs inline mode rendering
- [ ] Symbol palette mejorado con insercion directa
- [ ] Live preview en EquationEditor

---

## 9.14 Shape Avanzado (PRIORIDAD 3)

- [ ] Grouping UI (multi-select → Ctrl+G)
- [ ] Ungroup (Ctrl+Shift+G)
- [ ] Z-ordering: bring to front, send to back, forward, backward
- [ ] Connectors entre shapes
- [ ] Drop shadow
- [ ] Gradientes radiales

---

## 9.15 Zoom Interactivo (PRIORIDAD 4)

- [ ] Zoom slider en StatusBar
- [ ] Ctrl+Mouse Wheel para zoom in/out
- [ ] Presets: Fit Page, Fit Width, 100%
- [ ] Zoom percentage input editable

---

## 9.16 Auto-Format (PRIORIDAD 4)

- [ ] "1. " + space → crear numbered list automaticamente
- [ ] "- " + space → crear bulleted list
- [ ] "# " → Heading 1, "## " → Heading 2, etc.
- [ ] URLs auto-detectadas → hyperlink

---

## 9.17 Word Count Dialog (PRIORIDAD 4)

- [ ] `packages/react/src/components/WordCountDialog.tsx`
- [ ] Pages, words, characters, characters with spaces, paragraphs, lines
- [ ] Selection-only count cuando hay seleccion

---

## 9.18 Document Protection (PRIORIDAD 4)

- [ ] ProtectPlugin: restrict editing (comments only, track changes only, read only)
- [ ] Password protection dialog
- [ ] Section-level protection
- [ ] DOCX import/export de protection settings

---

## 9.19 Endnotes (PRIORIDAD 4)

- [ ] Endnotes rendering al final del documento (separado de footnotes)
- [ ] Endnote numbering separado
- [ ] DOCX import/export de endnotes
- [ ] Endnote panel en sidebar

---

## 9.20 Track Changes Balloons (PRIORIDAD 4)

- [ ] Revision balloons en margen derecho
- [ ] Balloon muestra: autor, fecha, tipo de cambio, contenido
- [ ] Toggle show/hide changes visual
- [ ] Accept/reject desde balloon

---

## 9.21 Performance Documentos Grandes (PRIORIDAD 4)

- [ ] Layout incremental real (solo paragrafos dirty)
- [ ] Image lazy loading (solo paginas visibles)
- [ ] Font metrics persistence (IndexedDB)
- [ ] Web Worker para layout calculation
- [ ] Large document chunking (1000+ paginas)

---

# Resumen de Estado

| Fase | Total Items | Completados | Pendientes |
|------|-------------|-------------|------------|
| 1. Fundacion (Model) | 42 | 42 | 0 |
| 2. Layout Engine | 32 | 32 | 0 |
| 3. Renderer + Engine | 62 | 54 | 8 |
| 4. React Integration | 59 | 58 | 1 |
| 5. Plugins E2E | 112 | 76 | 36 |
| 6. DOCX Import/Export | 27 | 27 | 0 |
| 7. PDF Export | 19 | 19 | 0 |
| 8. Polish + Apps | 14 | 11 | 3 |
| 9. Modulos Faltantes | 81 | 0 | 81 |
| **TOTAL** | **448** | **319 (71%)** | **129 (29%)** |

### Desglose de Pendientes por Prioridad

| Prioridad | Items Pendientes | Descripcion |
|-----------|-----------------|-------------|
| P1 — Critico | ~25 | Image system, HF UI, Paragraph dialog |
| P2 — Alto | ~25 | Comments visual, spell ctx menu, find extended, table borders, shape text |
| P3 — Medio | ~40 | TOC, bookmarks, columns, borders dialog, equation avanzado, shape avanzado |
| P4 — Bajo | ~39 | Zoom, auto-format, word count, protection, endnotes, balloons, performance |
