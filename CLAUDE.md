# JPOffice - Plan Completo de Arquitectura e Implementacion

## Contexto

Libreria de procesamiento de documentos para React/Next.js llamada JPOffice. Word processor completo (editor WYSIWYG paginado), con importacion de .docx, exportacion a .docx/.doc y PDF. Sin dependencias pesadas como ProseMirror, Slate o TipTap. Compatible 100% con Next.js (SSR-safe).

## Stack Tecnologico

| Componente | Eleccion | Razon |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Isolation estricta, caching de builds |
| Bundler | tsup (esbuild) | ESM + CJS dual output, DTS, rapido |
| Lenguaje | TypeScript strict | Indispensable para un modelo de documento complejo |
| Rendering | Canvas HTML5 + overlay React | Paginacion pixel-perfect, control total vs contentEditable |
| ZIP | fflate (~8kB) | 10x mas pequeno que JSZip, sin dependencias |
| XML parse | DOMParser nativo (browser) + @xmldom/xmldom (SSR) | Zero-cost en browser, shim ligero para Node |
| XML build | Custom string builder (0 deps) | No necesitamos DOM para generar XML |
| PDF | Writer custom (PDF 1.7 directo) | Evita jsPDF (80kB+) o pdf-lib (300kB+) |
| Font metrics | fontkit | Necesario para medir glyphs, kerning, subsetting |
| Inmutabilidad | Immer (patches) | Undo/redo gratis, structural sharing para React |
| Testing | Vitest + @testing-library/react | Rapido, ESM nativo |
| Linting | Biome | Mas rapido que ESLint+Prettier |
| Versioning | Changesets | Versionado vinculado entre paquetes |

## Estructura del Monorepo

```
jpoffice/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json
├── biome.json
├── .changeset/config.json
│
├── packages/
│   ├── model/                    # @jpoffice/model (ZERO deps externas)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── document.ts       # JPDocument raiz
│   │       ├── nodes/
│   │       │   ├── node.ts       # JPBaseNode, JPElement, JPLeaf
│   │       │   ├── body.ts       # JPBody
│   │       │   ├── section.ts    # JPSection (page layout)
│   │       │   ├── paragraph.ts  # JPParagraph
│   │       │   ├── run.ts        # JPRun (inline text span)
│   │       │   ├── text.ts       # JPText (hoja de texto)
│   │       │   ├── table.ts      # JPTable, JPTableRow, JPTableCell
│   │       │   ├── image.ts      # JPImage
│   │       │   ├── drawing.ts    # JPDrawing (floating/inline)
│   │       │   ├── list.ts       # JPListItem
│   │       │   ├── break.ts      # PageBreak, LineBreak, ColumnBreak
│   │       │   └── header-footer.ts
│   │       ├── properties/
│   │       │   ├── paragraph-props.ts
│   │       │   ├── run-props.ts
│   │       │   ├── table-props.ts
│   │       │   ├── section-props.ts
│   │       │   └── numbering.ts
│   │       ├── styles/
│   │       │   ├── style.ts
│   │       │   ├── style-registry.ts
│   │       │   └── defaults.ts   # Normal, Heading1-6, etc.
│   │       ├── operations/
│   │       │   ├── operation.ts  # Tipos: insert_text, delete_text, etc.
│   │       │   ├── apply.ts      # applyOperation(doc, op) -> newDoc
│   │       │   └── invert.ts     # invertOperation(op) -> inverseOp
│   │       ├── path.ts           # JPPath - direccionar cualquier nodo
│   │       ├── selection.ts      # JPSelection, JPRange, JPPoint
│   │       ├── traverse.ts       # Utilidades de recorrido del arbol
│   │       ├── normalize.ts      # Reglas de normalizacion
│   │       └── units.ts          # EMU, twips, pt, px conversiones
│   │
│   ├── engine/                   # @jpoffice/engine
│   │   └── src/
│   │       ├── index.ts
│   │       ├── editor.ts         # JPEditor - coordinador central
│   │       ├── editor-state.ts   # JPEditorState (snapshot inmutable)
│   │       ├── commands/
│   │       │   ├── command.ts    # Interfaz JPCommand
│   │       │   ├── registry.ts
│   │       │   ├── text-commands.ts
│   │       │   ├── format-commands.ts
│   │       │   ├── list-commands.ts
│   │       │   ├── table-commands.ts
│   │       │   └── image-commands.ts
│   │       ├── history/
│   │       │   ├── history.ts    # Undo/Redo stack (inverse operations)
│   │       │   └── batch.ts
│   │       ├── input/
│   │       │   ├── input-manager.ts   # Keyboard/IME/Composition
│   │       │   ├── keybindings.ts
│   │       │   └── clipboard.ts
│   │       ├── selection/
│   │       │   └── selection-manager.ts
│   │       └── plugins/
│   │           ├── plugin.ts     # Interfaz JPPlugin
│   │           └── plugin-manager.ts
│   │
│   ├── layout/                   # @jpoffice/layout
│   │   └── src/
│   │       ├── index.ts
│   │       ├── layout-engine.ts  # Coordinador principal de layout
│   │       ├── text-measurer.ts  # Canvas measureText + font metrics
│   │       ├── line-breaker.ts   # Greedy + Knuth-Plass para justify
│   │       ├── page-breaker.ts   # Paginacion, widow/orphan
│   │       ├── block-layout.ts   # Parrafos, spacing
│   │       ├── inline-layout.ts  # Runs dentro de lineas
│   │       ├── table-layout.ts   # Columnas, filas, merge
│   │       ├── float-layout.ts   # Imagenes flotantes, wrapping
│   │       ├── types.ts          # LayoutPage, LayoutLine, LayoutFragment
│   │       └── cache.ts          # Invalidacion incremental
│   │
│   ├── renderer/                 # @jpoffice/renderer
│   │   └── src/
│   │       ├── index.ts
│   │       ├── canvas-renderer.ts  # Dibujo principal en canvas
│   │       ├── text-renderer.ts
│   │       ├── table-renderer.ts
│   │       ├── image-renderer.ts
│   │       ├── selection-renderer.ts
│   │       ├── cursor-renderer.ts
│   │       ├── page-renderer.ts    # Chrome de pagina (sombras, margenes)
│   │       └── hit-test.ts         # Click -> posicion en documento
│   │
│   ├── react/                    # @jpoffice/react
│   │   └── src/
│   │       ├── index.ts
│   │       ├── JPOfficeEditor.tsx  # Componente principal ('use client')
│   │       ├── JPOfficeViewer.tsx  # Solo lectura
│   │       ├── context/
│   │       │   └── editor-context.tsx
│   │       ├── hooks/
│   │       │   ├── useEditor.ts
│   │       │   ├── useEditorState.ts
│   │       │   ├── useSelection.ts
│   │       │   ├── useCommand.ts
│   │       │   └── useLayout.ts
│   │       ├── components/
│   │       │   ├── EditorCanvas.tsx   # Canvas + hidden textarea
│   │       │   ├── Toolbar.tsx
│   │       │   ├── Ruler.tsx
│   │       │   ├── StatusBar.tsx
│   │       │   └── ScrollContainer.tsx
│   │       └── overlays/
│   │           ├── TableResizeHandles.tsx
│   │           ├── ImageResizeHandles.tsx
│   │           └── FloatingToolbar.tsx
│   │
│   ├── docx/                     # @jpoffice/docx
│   │   └── src/
│   │       ├── index.ts          # importDocx(), exportDocx()
│   │       ├── importer/
│   │       │   ├── docx-reader.ts       # ZIP -> XML extraction
│   │       │   ├── document-parser.ts   # document.xml -> JPDocument
│   │       │   ├── styles-parser.ts
│   │       │   ├── numbering-parser.ts
│   │       │   ├── relationships-parser.ts
│   │       │   ├── image-extractor.ts
│   │       │   ├── table-parser.ts
│   │       │   ├── drawing-parser.ts
│   │       │   └── section-parser.ts
│   │       ├── exporter/
│   │       │   ├── docx-writer.ts
│   │       │   ├── document-serializer.ts
│   │       │   ├── styles-serializer.ts
│   │       │   ├── numbering-serializer.ts
│   │       │   ├── relationships-serializer.ts
│   │       │   ├── content-types-serializer.ts
│   │       │   └── image-packer.ts
│   │       └── xml/
│   │           ├── xml-builder.ts    # Generador XML sin deps
│   │           ├── xml-parser.ts     # Isomorphic: DOMParser / @xmldom
│   │           └── namespaces.ts     # Constantes OOXML
│   │
│   ├── pdf/                      # @jpoffice/pdf
│   │   └── src/
│   │       ├── index.ts          # exportPdf()
│   │       ├── pdf-generator.ts  # Doc + Layout -> PDF bytes
│   │       ├── pdf-writer.ts     # Construccion binaria PDF 1.7
│   │       ├── pdf-page.ts
│   │       ├── pdf-text.ts
│   │       ├── pdf-image.ts
│   │       ├── pdf-font.ts      # Font subsetting via fontkit
│   │       ├── pdf-graphics.ts  # Lineas, rectangulos, colores
│   │       └── cross-ref.ts     # Cross-reference table
│   │
│   └── core/                     # @jpoffice/core (re-export bundle)
│       └── src/index.ts
│
├── apps/
│   └── demo/                     # Next.js demo app
│       ├── package.json
│       ├── next.config.js
│       └── src/app/
│           ├── page.tsx
│           └── layout.tsx
│
└── tools/scripts/
```

## Grafo de Dependencias entre Paquetes

```
@jpoffice/core (re-export)
 ├── @jpoffice/react
 │    ├── @jpoffice/engine
 │    │    └── @jpoffice/model  ←── CERO dependencias externas
 │    └── @jpoffice/renderer
 │         ├── @jpoffice/layout
 │         │    └── @jpoffice/model
 │         └── @jpoffice/model
 ├── @jpoffice/docx
 │    ├── @jpoffice/model
 │    ├── fflate
 │    └── @xmldom/xmldom (solo SSR, conditional)
 └── @jpoffice/pdf
      ├── @jpoffice/model
      ├── @jpoffice/layout
      ├── fontkit
      └── fflate (para comprimir streams)
```

## Modelo de Documento (Decisiones Clave)

### Por que Canvas y no contentEditable?

- Paginacion real (paginas fisicas como Word)
- Medicion de texto pixel-perfect
- Consistencia cross-browser identica
- Wrapping de imagenes con layout propio
- Fidelidad de impresion = layout PDF

### Por que Runs planos (no marks anidados)?

OOXML usa runs planos: cada run tiene sus propiedades completas. Evita ambiguedades de anidamiento (`<b><i>` vs `<i><b>`), operaciones mas simples, mapeo directo a/desde .docx.

### Por que twips/EMU como unidades internas?

Son las unidades nativas de OOXML. Usar internamente evita errores de redondeo float en import/export. Conversion a px solo en el boundary de rendering: `px = twips / 15` (a 96dpi).

### Inmutabilidad

Cada mutacion produce un nuevo arbol de documento. Subarboles no modificados comparten referencia (structural sharing). React puede hacer cheap reference equality checks. Undo/redo = stack de snapshots via operaciones inversas.

## Arquitectura del Editor

```
[Canvas HTML5]  ← display visual, mouse events
       |
[Hidden <textarea>]  ← captura keyboard, IME, clipboard
       |
[InputManager]  ← traduce DOM events a commands
       |
[JPEditor.executeCommand()]
       |
[Command produce Operations]
       |
[applyOperation(doc, op) → nuevo doc inmutable]
       |
[Layout Engine recalcula (incremental)]
       |
[Canvas Renderer redibuja paginas visibles]
```

## Sistema de Plugins

Cada feature es un plugin autocontenido:

| Plugin | ID | Responsabilidad |
|---|---|---|
| TextPlugin | jpoffice.text | Input, delete, Enter |
| FormattingPlugin | jpoffice.formatting | Bold, italic, underline, fonts, colores |
| HeadingPlugin | jpoffice.heading | H1-H6, outline level |
| ListPlugin | jpoffice.list | Ordered/unordered, nesting |
| TablePlugin | jpoffice.table | Crear, merge cells, resize, tab nav |
| ImagePlugin | jpoffice.image | Insertar, resize handles, float/wrap |
| HistoryPlugin | jpoffice.history | Undo/Redo (Ctrl+Z/Y) |
| ClipboardPlugin | jpoffice.clipboard | Copy/paste HTML + formato interno |
| StylesPlugin | jpoffice.styles | Aplicar estilos nombrados |
| PageBreakPlugin | jpoffice.pagebreak | Saltos de pagina explicitos |
| HeaderFooterPlugin | jpoffice.headerfooter | Headers/footers |

## DOCX Import/Export

### Import: .docx → JPDocument

```
.docx (Uint8Array)
  → fflate.unzipSync() → ZIP entries
  → RelationshipParser → mapa de relaciones
  → StylesParser → StyleDefinition[]
  → NumberingParser → NumberingDefinition[]
  → MediaExtractor → Map<rId, MediaAsset>
  → DocumentParser (recorre w:body recursivamente)
    → SectionParser, TableParser, RunParser, DrawingParser
  → JPDocument completo
```

### Export: JPDocument → .docx

```
JPDocument
  → ContentTypesWriter → [Content_Types].xml
  → RelationshipWriter → _rels/.rels + word/_rels/document.xml.rels
  → StylesWriter → word/styles.xml
  → NumberingWriter → word/numbering.xml
  → DocumentWriter → word/document.xml
  → MediaWriter → word/media/*
  → fflate.zipSync() → Uint8Array (.docx)
```

### .doc Legacy

Estrategia dual:
1. **RTF-compat (cliente):** Genera RTF renombrado a .doc (80% de casos)
2. **Server-convert (opcional):** DOCX → DOC via LibreOffice headless

## PDF Export

Reutiliza el LayoutEngine (las posiciones exactas de cada glyph/caja ya calculadas para canvas):

```
JPDocument → LayoutEngine (paginar) → LayoutResult
  → PdfWriter construye objetos PDF 1.7
    → PdfFont (embed subsets via fontkit)
    → PdfText (operadores BT/ET, Tj, Tm)
    → PdfImage (XObjects JPEG passthrough / PNG)
    → PdfGraphics (bordes, fondos)
    → fflate deflate para content streams
  → CrossRefTable + trailer
  → Uint8Array (PDF)
```

## Fases de Implementacion

### Fase 1: Fundacion (modelo + setup)

- Inicializar monorepo: pnpm-workspace.yaml, turbo.json, tsconfig.base.json, biome.json
- @jpoffice/model: Todos los tipos de nodos, propiedades, estilos
- @jpoffice/model: Operaciones (insert, delete, format, split, merge)
- @jpoffice/model: applyOperation(), invertOperation()
- @jpoffice/model: Path, Selection, traverse utilities
- @jpoffice/model: Unit conversions (twips, EMU, pt, px)
- Tests unitarios del modelo

### Fase 2: Layout Engine

- @jpoffice/layout: TextMeasurer (Canvas measureText + font metrics)
- @jpoffice/layout: LineBreaker (greedy, luego Knuth-Plass)
- @jpoffice/layout: BlockLayout + spacing
- @jpoffice/layout: PageBreaker (paginacion, widow/orphan, keepNext)
- @jpoffice/layout: Layout cache con invalidacion incremental
- Tests de layout

### Fase 3: Renderer + Editor Core

- @jpoffice/renderer: Canvas text rendering, decoraciones
- @jpoffice/renderer: Selection highlight + cursor parpadeante
- @jpoffice/renderer: Page chrome (sombras, margenes visuales)
- @jpoffice/renderer: Hit-test (click → posicion documento)
- @jpoffice/engine: JPEditor, EditorState, subscribe
- @jpoffice/engine: Command system + registry
- @jpoffice/engine: InputManager (hidden textarea, keyboard, IME)
- @jpoffice/engine: History (undo/redo via inverse operations)
- @jpoffice/engine: SelectionManager

### Fase 4: React Integration

- @jpoffice/react: JPOfficeEditor component ('use client')
- @jpoffice/react: Hooks (useEditor, useEditorState, useCommand, useLayout)
- @jpoffice/react: EditorCanvas (canvas + hidden textarea wiring)
- @jpoffice/react: ScrollContainer con paginas visibles
- @jpoffice/react: Toolbar por defecto
- apps/demo: Next.js app funcional

### Fase 5: Plugins de Features

- TextPlugin + FormattingPlugin (bold, italic, underline, fonts, colores, sizes)
- HeadingPlugin (H1-H6)
- ListPlugin (ordered/unordered, nesting, numbering engine)
- TablePlugin (crear, merge, resize, layout, render, tab navigation)
- ImagePlugin (insertar, resize handles, float, wrap)
- ClipboardPlugin (copy/paste HTML + interno)
- StylesPlugin (aplicar/crear estilos)

### Fase 6: DOCX Import/Export

- XML platform layer (isomorphic parser: DOMParser + @xmldom shim)
- XML string builder (zero deps)
- OOXML namespace constants
- Importer: RelationshipParser, StylesParser, NumberingParser
- Importer: DocumentParser, RunParser, TableParser, DrawingParser
- Importer: DocxImporter orchestrator
- Exporter: ContentTypes, Relationships, Styles, Numbering writers
- Exporter: DocumentWriter, TableWriter, DrawingWriter
- Exporter: DocxExporter orchestrator + fflate zip
- Round-trip tests (import → export → abrir en Word)

### Fase 7: PDF Export

- TextMeasurer con fontkit
- LayoutEngine para PDF (reutiliza @jpoffice/layout)
- PdfWriter (bajo nivel, objetos PDF 1.7)
- PdfFont (embedding + subsetting)
- PdfText, PdfGraphics, PdfImage
- PdfGenerator orchestrator
- Tests con documentos de referencia

### Fase 8: Polish y Avanzado

- Headers/footers (editor + DOCX + PDF)
- Sections con diferentes page layouts
- .doc export (RTF compat mode)
- Web Worker offloading para import/export
- Ruler component
- StatusBar (pagina actual, conteo palabras)
- Performance: viewport-only rendering, layout incremental
- @jpoffice/core re-export bundle

## Verificacion

Para cada fase:

1. **Unit tests:** `pnpm turbo test` - cada paquete tiene tests con Vitest
2. **Type checking:** `pnpm turbo typecheck` - sin errores TypeScript
3. **Lint:** `pnpm turbo lint` - Biome sin warnings
4. **Build:** `pnpm turbo build` - genera dist/ ESM + CJS + DTS
5. **Demo app:** `cd apps/demo && pnpm dev` - editor funcional en Next.js

### Tests de integracion criticos

- Crear documento → exportar DOCX → importar DOCX → comparar modelo
- Crear documento con tablas/imagenes → exportar PDF → validar estructura
- Editor interactivo: escribir texto, formatear, undo/redo, verificar estado
- Next.js SSR: la pagina renderiza sin errores del lado servidor
