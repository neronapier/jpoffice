# JPOffice — Plan Completo de Modulos Faltantes e Incompletos

## Resumen Ejecutivo

JPOffice tiene una arquitectura solida con 8 paquetes, 24 plugins, y soporte avanzado (collab, OT, offline). Sin embargo, multiples subsistemas tienen **backend funcional pero carecen de UI/rendering**, y hay features clave de Word que no existen. Este documento detalla TODO lo que falta, organizado por prioridad.

---

## CRITICO — Features con Backend pero sin Frontend/Rendering

### 1. Sistema de Imagenes — ImageResizeOverlay Inexistente

**Estado**: El `ImagePlugin` tiene 9 comandos (insert, resize, crop, rotate, flip, wrap, altText, replace, resetSize) y el modelo soporta crop, rotation, flip. Pero **no existe forma visual de interactuar con imagenes**.

**Archivos existentes**:
- `packages/engine/src/plugins/image/image-plugin.ts` — 9 comandos registrados
- `packages/engine/src/plugins/image/image-transform.ts` — utilidades de crop/rotation
- `packages/model/src/properties/image-props.ts` — JPImageCrop, rotation, flip, wrapType
- `packages/renderer/src/image-renderer.ts` — solo 70 lineas, solo drawImage basico

**Faltante**:

| Componente | Archivo a crear/modificar | Descripcion |
|---|---|---|
| **ImageResizeOverlay** | `packages/react/src/overlays/ImageResizeOverlay.tsx` | 8 handles de resize (esquinas + bordes), mantener aspect ratio con Shift |
| **ImageSelectionOverlay** | Integrar en ImageResizeOverlay | Borde azul de seleccion al clickear imagen, deseleccionar al clickear fuera |
| **ImageCropOverlay** | `packages/react/src/overlays/ImageCropOverlay.tsx` | Modo crop: handles para recortar desde cada borde, preview con area oscurecida |
| **ImageRotationHandle** | Integrar en ImageResizeOverlay | Handle circular arriba de la imagen para rotar con drag |
| **ImagePropertiesDialog** | `packages/react/src/components/ImagePropertiesDialog.tsx` | Dialog: dimensiones, crop numerico, alt text, wrap type, rotation |
| **ImageContextMenu** | Integrar en `ContextMenu.tsx` | Menu contextual: resize, crop, wrap, alt text, replace, reset size, delete |
| **ImageRenderer mejorado** | `packages/renderer/src/image-renderer.ts` | Renderizar: crop (clip path), rotation (ctx.rotate), flip, bordes, sombra, error state |
| **Image hit-test** | `packages/renderer/src/hit-test.ts` | Click sobre imagen debe seleccionarla (hoy no se detecta) |
| **LayoutImage extendido** | `packages/layout/src/types.ts` | Agregar: crop, rotation, flipH, flipV, borders, shadow al LayoutImage |

**Logica de ImageResizeOverlay**:
```
1. Detectar click sobre imagen (hit-test devuelve nodePath de tipo 'image')
2. Mostrar overlay con 8 handles + handle de rotacion
3. onMouseDown en handle → iniciar drag
4. onMouseMove → calcular nuevo size/rotation
5. onMouseUp → ejecutar editor.executeCommand('image.resize', { ... })
6. Click fuera → deseleccionar
7. Double-click → entrar modo crop
8. Delete key → eliminar imagen
```

**Renderizado de crop/rotation** (ImageRenderer):
```typescript
// Antes de drawImage:
ctx.save();
ctx.translate(centerX, centerY);
ctx.rotate(rotation * Math.PI / 180);
if (flipH) ctx.scale(-1, 1);
if (flipV) ctx.scale(1, -1);
// Clip para crop:
ctx.beginPath();
ctx.rect(cropLeft, cropTop, cropWidth, cropHeight);
ctx.clip();
ctx.drawImage(img, -w/2, -h/2, w, h);
ctx.restore();
```

---

### 2. Headers/Footers — UI de Edicion Incompleta

**Estado**: `HeaderFooterPlugin` maneja enter/exit modo edicion, campos PAGE/NUMPAGES, different first page, odd/even. El rendering del dimming overlay existe. Pero **la integracion React no conecta todo**.

**Archivos existentes**:
- `packages/engine/src/plugins/header-footer/` — plugin completo
- `packages/react/src/components/HeaderFooterToolbar.tsx` — componente creado pero no integrado
- `packages/renderer/src/canvas-renderer.ts` — dimming overlay funciona (lineas 401-428)

**Faltante**:

| Componente | Descripcion |
|---|---|
| **Integracion de HeaderFooterToolbar en JPOfficeEditor** | El toolbar flotante debe aparecer cuando se entra en modo HF editing |
| **Cursor placement en HF** | Al entrar en modo edicion, el cursor debe posicionarse en el primer parrafo del header/footer |
| **Hit-test para HF** | El hit-test necesita detectar clicks en zonas de header/footer y resolverlos a paths dentro de `page.header.blocks` / `page.footer.blocks` |
| **HF field update** | Los campos PAGE/NUMPAGES no se actualizan dinamicamente al paginar — necesitan re-evaluacion |
| **Navegacion entre paginas** | Al editar HF, las flechas arriba/abajo deben navegar entre HF de distintas paginas |
| **Toggle visual first/odd/even** | UI para togglear "Different first page" y "Different odd/even" que ya existe en el plugin |

---

### 3. Equation Editor — Renderizado Basico, Editor Limitado

**Estado**: `EquationRenderer` parsea LaTeX y renderiza 100+ simbolos. Pero solo soporta un subconjunto basico de LaTeX.

**Archivos existentes**:
- `packages/renderer/src/equation-renderer.ts` — rendering con parser propio
- `packages/engine/src/plugins/equation/` — plugin con insert/edit
- `packages/react/src/components/EquationEditor.tsx` — input de LaTeX

**Faltante**:

| Feature | Descripcion |
|---|---|
| **Matrices/Arrays** | `\begin{matrix}...\end{matrix}`, `\begin{pmatrix}`, `\begin{bmatrix}` |
| **Integrales con limites** | `\int_a^b`, `\oint`, `\iint`, `\iiint` |
| **Sumas/Productos** | `\sum_{i=0}^{n}`, `\prod`, con limites arriba/abajo |
| **Limites** | `\lim_{x \to 0}` |
| **Environments** | `\begin{cases}`, `\begin{aligned}` |
| **Delimitadores escalables** | `\left( ... \right)`, `\left[ ... \right]` |
| **Acentos matematicos** | `\hat{x}`, `\bar{x}`, `\vec{x}`, `\dot{x}` |
| **Spaces LaTeX** | `\quad`, `\qquad`, `\,`, `\;`, `\!` |
| **Text en ecuaciones** | `\text{para todo}`, `\mathrm{...}` |
| **Editor visual** | Symbol palette que inserta LaTeX snippets, preview en tiempo real |
| **Inline vs Display** | Display mode: mas grande, centrado, con spacing vertical |
| **PDF rendering vectorial** | Hoy las ecuaciones se rasterizan — deberian ser vectoriales en PDF |

---

## ALTO — Features Parcialmente Implementados

### 4. Find & Replace — Solo Busca en Body

**Estado**: `FindReplacePlugin` funciona en el body del documento. `FindReplaceBar` UI completo.

**Faltante**:

| Feature | Descripcion |
|---|---|
| Buscar en headers/footers | Iterar `page.header.blocks` y `page.footer.blocks` |
| Buscar en footnotes/endnotes | Iterar nodos footnote |
| Buscar en text boxes/shapes | Iterar texto dentro de shapes |
| Whole word matching | Opcion "Only whole words" con word boundary regex |
| Regex search | Opcion "Use regular expressions" |
| Find in selection | Limitar busqueda al rango seleccionado |
| Match formatting | Buscar por formato (bold, italic, font, etc.) |
| Replace formatting | Reemplazar aplicando formato sin cambiar texto |
| Recent searches | Historial de busquedas recientes en dropdown |

---

### 5. Comments — Panel Funciona, Indicadores en Documento Faltan

**Estado**: `CommentsPanel` renderiza comments en sidebar. Pueden agregarse, responderse, resolverse.

**Faltante**:

| Feature | Descripcion |
|---|---|
| **Highlight de texto comentado** | El rango de texto con comment debe tener background amarillo/naranja |
| **Marcador lateral** | Linea o icono en el margen derecho indicando que hay un comment |
| **Hover tooltip** | Al pasar sobre texto comentado, mostrar preview del comment |
| **Balloon mode** | Vista alternativa con balloons en el margen derecho (como Word) |
| **Keyboard shortcut** | Ctrl+Alt+M para agregar comment en seleccion actual |
| **Navigation** | Ctrl+PageDown/Up para navegar entre comments |
| **Rendering en canvas** | `CanvasRenderer` necesita dibujar los highlights de comment ranges |

---

### 6. Shapes — Funcionalidad Basica, Texto y Agrupacion Faltan

**Estado**: `ShapeRenderer` dibuja 20+ tipos. `ShapeSelectionOverlay` tiene move/resize. `ShapePlugin` tiene insert/move/resize/rotate/delete.

**Faltante**:

| Feature | Descripcion |
|---|---|
| **Text editing dentro de shapes** | Editar texto inline dentro de un shape (click → cursor, typing) |
| **Formato de texto en shapes** | Bold, italic, font, size dentro del texto del shape |
| **Shape grouping UI** | Seleccionar multiples shapes + Ctrl+G para agrupar |
| **Z-ordering** | "Bring to front", "Send to back", "Bring forward", "Send backward" |
| **Shape connectors** | Lineas que conectan shapes y se mueven con ellos |
| **Sombras/efectos** | Drop shadow, glow, reflection, soft edges |
| **Gradientes** | Gradientes radiales/conicos (hoy solo lineales) |
| **Alineacion de shapes** | Align left/center/right, distribute horizontal/vertical |

---

### 7. Spell Check — Rendering Existe pero Falta Conexion con React

**Estado**: `SpellcheckPlugin` detecta errores, `renderSpellErrors` en `canvas-renderer.ts` dibuja squiggly lines, `drawSquigglyLine` en `squiggly-renderer.ts` existe.

**Faltante**:

| Feature | Descripcion |
|---|---|
| **Conexion Plugin → Renderer** | El `SpellcheckPlugin` necesita llamar a `renderer.setSpellErrors()` cuando detecta errores — verificar que el wiring React lo hace |
| **Context menu con sugerencias** | Click derecho en palabra con error → sugerencias, "Add to Dictionary", "Ignore" |
| **Indicador visual en status bar** | Icono de spellcheck on/off en la barra de estado |
| **Multi-idioma** | Selector de idioma para el spellchecker |
| **Grammar check** | Squiggly azul para errores gramaticales (separado de spelling) |

---

## MEDIO — Features Completamente Faltantes

### 8. Table of Contents (TOC)

**No existe ninguna implementacion.**

| Componente | Archivo | Descripcion |
|---|---|---|
| TOC Model | `packages/model/src/nodes/toc.ts` | Nodo `toc` con entries basadas en headings |
| TOC Plugin | `packages/engine/src/plugins/toc/toc-plugin.ts` | Comandos: insert, update, remove TOC |
| TOC Generator | mismo plugin | Recorrer document, encontrar headings, generar entries con paginas |
| TOC Layout | `packages/layout/src/` | Layout especial: texto + tab leader + numero de pagina |
| TOC Renderer | `packages/renderer/src/` | Renderizar entries con hyperlinks internos |
| TOC DOCX | `packages/docx/src/` | Import/export w:sdt con TOC field codes |
| TOC PDF | `packages/pdf/src/` | Internal links en PDF a cada heading |
| TOC UI | `packages/react/src/` | Menu Insert → Table of Contents, dialog de opciones |

---

### 9. Paragraph Properties Dialog

**No existe dialog dedicado.** Hay `LineSpacingDropdown` en el toolbar pero no un dialog completo.

| Feature | Descripcion |
|---|---|
| **ParagraphPropertiesDialog** | Dialog con tabs: Indents & Spacing, Line & Page Breaks |
| **Indentation** | Left, right, first line, hanging — con spinners en twips/inches/cm |
| **Spacing** | Before, after — con spinners |
| **Line spacing** | Single, 1.5, double, exactly, at least, multiple — con valor custom |
| **Alignment** | Left, center, right, justify |
| **Page break before** | Checkbox |
| **Keep with next** | Checkbox |
| **Keep lines together** | Checkbox |
| **Widow/orphan control** | Checkbox |
| **Tab stops** | Dialog para configurar tab stops y leaders |

---

### 10. Borders & Shading Dialog

**No existe UI.** El modelo soporta borders en paragrafos y celdas.

| Feature | Descripcion |
|---|---|
| **ParagraphBordersDialog** | Borders arriba/abajo/izquierda/derecha con estilo, color, ancho |
| **ParagraphShadingPicker** | Background color de parrafo |
| **Page borders** | Borders de pagina (section props) |
| **Art borders** | Borders decorativos (fuera de scope inicial) |

---

### 11. Bookmarks & Cross-References

**Estado**: El modelo tiene `JPBookmarkStart`/`JPBookmarkEnd`. Se parsean en DOCX. Pero no hay UI ni navegacion.

| Feature | Descripcion |
|---|---|
| **BookmarkPlugin** | `packages/engine/src/plugins/bookmark/` — insert, delete, goto bookmark |
| **Bookmark dialog** | Insert → Bookmark, lista de bookmarks, Go To, Delete |
| **Cross-reference** | Insert → Cross Reference: referencia a heading, bookmark, figure, table |
| **Field codes** | REF field para cross-references (`{ REF _Ref123 \h }`) |
| **Hyperlink a bookmark** | Link interno que navega al bookmark |

---

### 12. Table of Figures / List of Tables

Similar a TOC pero para figuras y tablas.

| Feature | Descripcion |
|---|---|
| **CaptionPlugin** | Insertar captions en imagenes/tablas ("Figure 1: ...", "Table 1: ...") |
| **Auto-numbering** | Numeracion automatica de figuras/tablas |
| **List generation** | Generar lista con paginas, similar a TOC |

---

### 13. Columns Dialog

**Estado**: `column-layout.ts` existe con `calculateColumnRegions` y `distributeBlocksToColumns`. El modelo tiene `JPSectionColumns`.

**Faltante**:

| Feature | Descripcion |
|---|---|
| **ColumnsDialog** | Dialog: presets (1, 2, 3, left, right), custom widths, separator line |
| **Column break** | Insert column break (ya existe `column-break` en model?) |
| **Rendering visual** | Verificar que el renderer dibuja texto en columnas multiples |
| **Continuous section break** | Para cambiar numero de columnas mid-page |

---

### 14. Document Protection / Read-Only Mode

| Feature | Descripcion |
|---|---|
| **ProtectPlugin** | Proteger documento con password |
| **Editing restrictions** | Solo permitir comments, solo track changes, solo forms |
| **Lock sections** | Proteger secciones individuales |

---

## BAJO — Nice to Have

### 15. Temas de Color y UI

| Feature | Descripcion |
|---|---|
| **Theme color picker** | Mostrar colores del tema del documento en el color picker |
| **Theme fonts** | Mostrar heading/body fonts del tema |
| **Theme import completo** | `ThemeParser` basico existe, expandir para colores completos |

---

### 16. Zoom Interactivo

| Feature | Descripcion |
|---|---|
| **Zoom slider** | Slider en StatusBar para ajustar zoom (hoy solo texto) |
| **Ctrl+scroll** | Zoom con rueda del mouse |
| **Zoom presets** | Fit page, fit width, 100%, custom |

---

### 17. Drag & Drop Mejorado

| Feature | Descripcion |
|---|---|
| **Drag text selection** | Arrastrar texto seleccionado a otra posicion |
| **Drag images from filesystem** | Drop imagen desde explorador de archivos |
| **Drag table rows/columns** | Reordenar filas/columnas arrastrando |

---

### 18. Word Count Dialog

| Feature | Descripcion |
|---|---|
| **WordCountDialog** | Dialog detallado: pages, words, characters, characters w/spaces, paragraphs, lines |
| **Selection count** | Contar solo texto seleccionado |

---

### 19. Auto-Format

| Feature | Descripcion |
|---|---|
| **Auto-list** | Al escribir "1." + space, crear lista numerada automaticamente |
| **Auto-heading** | Al escribir "# " crear Heading 1 |
| **Auto-table** | Al escribir "+---+---+" crear tabla |
| **Smart dashes** | "--" → en-dash, "---" → em-dash (ya existe parcialmente en AutoCorrect) |

---

### 20. Accesibilidad Avanzada

| Feature | Descripcion |
|---|---|
| **ARIA completo** | Canvas con role="application", aria-label para estado |
| **Screen reader de contenido** | Leer contenido del documento via aria-live |
| **Keyboard-only navigation** | Tab order para todos los controles del toolbar |
| **High contrast rendering** | Colores de alto contraste en el canvas |
| **Alt text validator** | Warning si imagen no tiene alt text |

---

### 21. Performance para Documentos Grandes

| Feature | Descripcion |
|---|---|
| **Layout incremental real** | Solo relayoutar paragrafos dirty, no paginas enteras |
| **Virtual page rendering** | Solo renderizar paginas visibles (hoy renderiza con culling basico) |
| **Web Worker layout** | Mover calculo de layout a worker thread |
| **Font metrics caching** | Persistir cache de metricas entre sesiones (IndexedDB) |
| **Image lazy loading** | Solo cargar imagenes de paginas visibles |
| **Large document chunking** | Para docs 1000+ paginas, cargar por chunks |

---

## Resumen de Prioridades

### Prioridad 1 — Critico (Bloquea uso basico)
1. **ImageResizeOverlay** + rendering de crop/rotation/flip
2. **Image hit-test** (click sobre imagen)
3. **Headers/Footers UI** completa
4. **Paragraph Properties Dialog**

### Prioridad 2 — Alto (Features esperados de un word processor)
5. **Comments en documento** (highlights + margin markers)
6. **Find & Replace** en headers/footers/footnotes
7. **Shape text editing** inline
8. **Image Properties Dialog**
9. **Borders & Shading Dialog**
10. **Spell check context menu** (sugerencias, add to dictionary)

### Prioridad 3 — Medio (Completitud feature)
11. **Table of Contents**
12. **Bookmarks & Cross-References**
13. **Columns Dialog** + rendering visual
14. **Equation editor** mejorado (matrices, integrales)
15. **Shape grouping + Z-ordering**
16. **Table of Figures / Captions**

### Prioridad 4 — Bajo (Polish y UX)
17. **Zoom interactivo** (slider + Ctrl+scroll)
18. **Auto-format** (auto-list, auto-heading)
19. **Word Count Dialog**
20. **Accesibilidad avanzada**
21. **Performance** para documentos grandes
22. **Document Protection**
23. **Theme color integration**
24. **Drag & Drop mejorado**

---

## Estimacion de Archivos por Modulo

| Modulo | Archivos nuevos | Archivos a modificar |
|---|---|---|
| Image System | 3 nuevos (overlays + dialog) | 4 (image-renderer, hit-test, types.ts, ContextMenu) |
| Headers/Footers UI | 0 nuevos (ya existe HeaderFooterToolbar) | 3 (JPOfficeEditor, hit-test, EditorCanvas) |
| Paragraph Dialog | 1 nuevo | 1 (Toolbar) |
| Comments en doc | 0 nuevos | 3 (canvas-renderer, selection-renderer, ContextMenu) |
| TOC | 4 nuevos (model, plugin, renderer, dialog) | 3 (docx, pdf, toolbar) |
| Bookmarks | 2 nuevos (plugin, dialog) | 2 (toolbar, docx) |
| Equation mejorado | 0 nuevos | 2 (equation-renderer, EquationEditor) |
| Borders Dialog | 1 nuevo | 1 (toolbar) |
| Columns Dialog | 1 nuevo | 1 (toolbar) |
| Zoom interactivo | 0 nuevos | 1 (StatusBar o ScrollContainer) |

---

## Notas de Arquitectura

### Patron para nuevos overlays (ImageResize, ImageCrop)

Seguir el patron de `TableResizeOverlay.tsx`:
1. Overlay `<div>` con `position: absolute; inset: 0; pointerEvents: none`
2. Usar `rendererRef` para acceder al canvas y hacer coordinate transforms
3. `useEffect` para cursor management directamente en el `<canvas>` (Fix reciente)
4. Mouse listeners en el container, no en el overlay
5. Drag state machine: `idle → hover → drag → commit`

### Patron para nuevos dialogs

Seguir el patron de `PageSetupDialog` o `TablePropertiesDialog`:
1. `<dialog>` nativo HTML con `open` prop
2. State local con `useState` para form fields
3. `onApply` ejecuta `editor.executeCommand(...)` y cierra
4. `onCancel` cierra sin cambios
5. Leer valores actuales del modelo via `editor.getDocument()` + path

### Patron para nuevos plugins

Seguir el patron de cualquier plugin existente:
1. Implementar `JPPlugin` interface: `id`, `name`, `init(editor)`
2. En `init`, registrar comandos con `editor.registerCommand()`
3. Exportar desde `packages/engine/src/index.ts`
4. Registrar en `JPOfficeEditor.tsx` lista de default plugins
