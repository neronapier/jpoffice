# JPOffice — Módulos Faltantes para Paridad con Google Docs

> Documento generado a partir de auditoría exhaustiva del codebase (14,000+ líneas, 143 archivos, 8 paquetes).
> Cada módulo describe: qué falta, dónde se integra, qué archivos crear/modificar, interfaces, y pasos de implementación.

---

## Índice

1. [Módulo 1: Comentarios y Anotaciones](#módulo-1-comentarios-y-anotaciones) ✅
2. [Módulo 2: Track Changes (Control de Cambios / Sugerencias)](#módulo-2-track-changes-control-de-cambios--sugerencias) ✅
3. [Módulo 3: Colaboración en Tiempo Real](#módulo-3-colaboración-en-tiempo-real) ✅
4. [Módulo 4: Footnotes y Endnotes](#módulo-4-footnotes-y-endnotes) ✅
5. [Módulo 5: Fields (Campos Dinámicos)](#módulo-5-fields-campos-dinámicos) ✅
6. [Módulo 6: Paste con Formato (HTML/RTF/Imágenes)](#módulo-6-paste-con-formato-htmlrtfimágenes) ✅
7. [Módulo 7: Spell Check y Grammar Check](#módulo-7-spell-check-y-grammar-check) ✅
8. [Módulo 8: Ecuaciones / Math Editor](#módulo-8-ecuaciones--math-editor) ✅
9. [Módulo 9: Shapes, Text Boxes y Drawing Layer](#módulo-9-shapes-text-boxes-y-drawing-layer) ✅
10. [Módulo 10: Multi-Column Layout](#módulo-10-multi-column-layout) ✅
11. [Módulo 11: Drag & Drop](#módulo-11-drag--drop) ✅
12. [Módulo 12: Font Embedding y Unicode Completo en PDF](#módulo-12-font-embedding-y-unicode-completo-en-pdf) ✅
13. [Módulo 13: Hyperlinks y Bookmarks en PDF](#módulo-13-hyperlinks-y-bookmarks-en-pdf) ✅
14. [Módulo 14: Tagged PDF / Accesibilidad PDF](#módulo-14-tagged-pdf--accesibilidad-pdf) ✅
15. [Módulo 15: Table Operations Avanzadas](#módulo-15-table-operations-avanzadas) ✅
16. [Módulo 16: Image Editing (Resize, Crop, Efectos)](#módulo-16-image-editing-resize-crop-efectos) ✅
17. [Módulo 17: Headers/Footers Editor UI](#módulo-17-headersfooters-editor-ui) ✅
18. [Módulo 18: Page Setup Dialog](#módulo-18-page-setup-dialog) ✅
19. [Módulo 19: Styles Panel UI](#módulo-19-styles-panel-ui) ✅
20. [Módulo 20: Accesibilidad (WCAG 2.1 AA)](#módulo-20-accesibilidad-wcag-21-aa) ✅
21. [Módulo 21: Mobile / Touch Support](#módulo-21-mobile--touch-support) ✅
22. [Módulo 22: Dark Mode y Theming](#módulo-22-dark-mode-y-theming) ✅
23. [Módulo 23: Version History](#módulo-23-version-history) ✅
24. [Módulo 24: Outline / Navigation Panel](#módulo-24-outline--navigation-panel) ✅
25. [Módulo 25: Keybindings Completos](#módulo-25-keybindings-completos) ✅
26. [Módulo 26: BiDi / RTL Text Support](#módulo-26-bidi--rtl-text-support) ✅
27. [Módulo 27: Knuth-Plass Line Breaking (Justificación Óptima)](#módulo-27-knuth-plass-line-breaking-justificación-óptima) ✅
28. [Módulo 28: Print Preview](#módulo-28-print-preview) ✅
29. [Módulo 29: Auto-correct y Smart Typing](#módulo-29-auto-correct-y-smart-typing) ✅
30. [Módulo 30: Floating Toolbar on Selection](#módulo-30-floating-toolbar-on-selection) ✅

---

## Módulo 1: Comentarios y Anotaciones ✅

### Qué falta
No existe soporte para comentarios en ninguna capa: modelo, engine, layout, renderer, React, DOCX ni PDF. Google Docs permite crear comentarios anclados a rangos de texto, responder en hilos, resolver comentarios, y asignar acciones.

### Dónde se integra

| Paquete | Cambios |
|---------|---------|
| `@jpoffice/model` | Nuevos node types + estructura de comentarios |
| `@jpoffice/engine` | Nuevo plugin `CommentPlugin` |
| `@jpoffice/layout` | Renderizar markers de comentario (highlight amarillo) |
| `@jpoffice/renderer` | Dibujar highlights y badges de comentario |
| `@jpoffice/react` | Panel de comentarios + UI inline |
| `@jpoffice/docx` | Import/export `w:commentRangeStart`, `w:commentRangeEnd`, `w:comments.xml` |

### Archivos a crear

```
packages/model/src/nodes/comment.ts
packages/model/src/properties/comment-props.ts
packages/engine/src/plugins/comment/comment-plugin.ts
packages/react/src/components/CommentsPanel.tsx
packages/react/src/components/CommentBubble.tsx
packages/react/src/hooks/useComments.ts
packages/docx/src/importer/comment-parser.ts
packages/docx/src/exporter/comment-writer.ts
```

### Archivos a modificar

```
packages/model/src/nodes/node.ts          → agregar 'comment-range-start' | 'comment-range-end' a JPNodeType
packages/model/src/nodes/index.ts         → re-export nuevos tipos
packages/model/src/document.ts            → agregar campo comments: JPComment[] al JPDocument
packages/model/src/index.ts               → export nuevos tipos
packages/engine/src/index.ts              → export CommentPlugin
packages/layout/src/layout-engine.ts      → detectar comment ranges y pasar a layout result
packages/layout/src/types.ts              → agregar commentRanges a LayoutResult
packages/renderer/src/canvas-renderer.ts  → renderizar highlights de comentarios
packages/renderer/src/selection-renderer.ts → highlight amarillo para comment ranges
packages/react/src/JPOfficeEditor.tsx      → integrar CommentsPanel
packages/docx/src/importer/docx-importer.ts → parsear comments.xml
packages/docx/src/importer/document-parser.ts → detectar w:commentRangeStart/End
packages/docx/src/exporter/docx-exporter.ts  → generar comments.xml y content types
packages/docx/src/exporter/document-writer.ts → serializar comment range markers
```

### Interfaces clave

```typescript
// packages/model/src/nodes/comment.ts

export interface JPCommentRangeStart extends JPLeaf {
  readonly type: 'comment-range-start';
  readonly id: string;
  readonly commentId: string;
}

export interface JPCommentRangeEnd extends JPLeaf {
  readonly type: 'comment-range-end';
  readonly id: string;
  readonly commentId: string;
}

export interface JPComment {
  readonly id: string;
  readonly author: string;
  readonly date: string;          // ISO 8601
  readonly text: string;
  readonly resolved: boolean;
  readonly parentId?: string;     // para hilos (replies)
}
```

### Pasos de implementación

1. **Modelo** (2-3 días):
   - Agregar `JPCommentRangeStart` y `JPCommentRangeEnd` como leaf nodes en `node.ts`
   - Agregar `comments: JPComment[]` al `JPDocument`
   - Crear operaciones: `add_comment`, `resolve_comment`, `delete_comment`, `reply_comment`
   - Los comment ranges son inline nodes dentro de paragraphs (como bookmarks)
   - Cada comment tiene un `commentId` que enlaza los range markers con el objeto `JPComment`

2. **Engine Plugin** (2-3 días):
   - `CommentPlugin` registra comandos:
     - `comment.add { text, author }` → inserta `comment-range-start` y `comment-range-end` alrededor de la selección, agrega `JPComment` al documento
     - `comment.resolve { commentId }` → marca `resolved: true`
     - `comment.delete { commentId }` → elimina ranges + comment object
     - `comment.reply { commentId, text, author }` → agrega comment con `parentId`
   - `onAfterApply` notifica cambios de comentarios para actualizar el panel

3. **Layout + Renderer** (1-2 días):
   - En `layout-engine.ts`, recolectar comment ranges durante el layout y anotar en `LayoutResult` las posiciones (rectángulos) de cada comment range
   - En `canvas-renderer.ts`, dibujar highlight amarillo semi-transparente (`rgba(255, 212, 0, 0.3)`) sobre los rangos con comentarios
   - Dibujar un badge/icono pequeño en el margen derecho indicando el número de comentarios

4. **React UI** (3-4 días):
   - `CommentsPanel.tsx`: panel lateral derecho que lista todos los comentarios, permite responder, resolver, eliminar. Scroll sincronizado con el documento
   - `CommentBubble.tsx`: tooltip que aparece al hacer hover sobre texto comentado
   - `useComments.ts`: hook que extrae comentarios del estado del editor
   - Integrar en `JPOfficeEditor.tsx` con prop `showComments?: boolean`

5. **DOCX** (2 días):
   - **Import**: parsear `word/comments.xml` (namespace `w:comments`), mapear `w:comment` → `JPComment`, detectar `w:commentRangeStart`/`w:commentRangeEnd` en document.xml
   - **Export**: generar `word/comments.xml`, insertar range markers en document.xml, agregar relationship en `.rels`

---

## Módulo 2: Track Changes (Control de Cambios / Sugerencias) ✅

### Qué falta
El botón "Suggesting" en la UI existe pero no hace nada. No hay forma de rastrear inserciones, eliminaciones ni cambios de formato. En OOXML esto se representa con `w:ins`, `w:del`, `w:rPrChange`.

### Dónde se integra

| Paquete | Cambios |
|---------|---------|
| `@jpoffice/model` | Propiedades de revisión en runs/paragraphs + metadata de revisiones |
| `@jpoffice/engine` | `TrackChangesPlugin` que intercepta operaciones |
| `@jpoffice/layout` | Estilos visuales para inserciones/eliminaciones |
| `@jpoffice/renderer` | Renders de revision marks (colores por autor, tachado para eliminaciones) |
| `@jpoffice/react` | Panel de revisiones, botones accept/reject |
| `@jpoffice/docx` | Import/export de `w:ins`, `w:del`, `w:rPrChange` |

### Archivos a crear

```
packages/model/src/properties/revision-props.ts
packages/engine/src/plugins/track-changes/track-changes-plugin.ts
packages/react/src/components/RevisionsPanel.tsx
packages/react/src/hooks/useRevisions.ts
packages/docx/src/importer/revision-parser.ts
packages/docx/src/exporter/revision-writer.ts
```

### Archivos a modificar

```
packages/model/src/properties/run-props.ts       → agregar campos de revisión
packages/model/src/properties/paragraph-props.ts  → agregar campos de revisión
packages/model/src/document.ts                    → agregar revisions metadata
packages/engine/src/editor.ts                     → modo tracking on/off
packages/layout/src/style-resolver.ts             → colores de revisión
packages/renderer/src/text-renderer.ts            → pintar tachado/subrayado de revisión
packages/react/src/JPOfficeEditor.tsx              → integrar modo sugerencias real
packages/react/src/components/ModeButtons.tsx      → conectar modo "Suggesting" al plugin
```

### Interfaces clave

```typescript
// packages/model/src/properties/revision-props.ts

export interface JPRevisionInfo {
  readonly revisionId: string;
  readonly author: string;
  readonly date: string;          // ISO 8601
  readonly type: 'insertion' | 'deletion' | 'formatChange' | 'move';
}

// Extender JPRunProperties:
export interface JPRunProperties {
  // ... existentes ...
  readonly revision?: JPRevisionInfo;
  readonly previousProperties?: JPRunProperties; // para formatChange, guardar estado anterior
}
```

### Pasos de implementación

1. **Modelo** (2-3 días):
   - Agregar `JPRevisionInfo` interface con `author`, `date`, `type`
   - Extender `JPRunProperties` con campo `revision?: JPRevisionInfo`
   - Extender `JPParagraphProperties` con `revision?: JPRevisionInfo` (para paragraph-level changes)
   - Los runs marcados con `revision.type === 'deletion'` representan texto eliminado (se muestra tachado en rojo)
   - Los runs marcados con `revision.type === 'insertion'` representan texto nuevo (se muestra subrayado en color del autor)
   - Agregar `revisions: JPRevisionMetadata` al `JPDocument` para tracking global (autores, estado tracking on/off)

2. **Engine Plugin** (3-4 días):
   - `TrackChangesPlugin` se activa cuando `editor.setTrackingMode(true)`
   - **Hook `onBeforeApply`**: intercepta TODAS las operaciones de mutación:
     - `insert_text` → en vez de insertar directamente, inserta un run con `revision: { type: 'insertion', author, date }`
     - `delete_text` → en vez de eliminar, marca el run con `revision: { type: 'deletion', author, date }` (el texto permanece visible pero tachado)
     - `set_properties` → guarda `previousProperties` y marca con `revision: { type: 'formatChange' }`
   - Comandos:
     - `trackChanges.toggle` → on/off
     - `trackChanges.acceptChange { revisionId }` → aplica el cambio definitivamente (elimina revision markers)
     - `trackChanges.rejectChange { revisionId }` → revierte el cambio
     - `trackChanges.acceptAll` → acepta todos
     - `trackChanges.rejectAll` → rechaza todos
   - Cada autor tiene un color asignado (cycling: azul, rojo, verde, morado, naranja...)

3. **Layout + Renderer** (2 días):
   - En `style-resolver.ts`: si un run tiene `revision`, aplicar estilos override:
     - `insertion` → color del autor + underline
     - `deletion` → color del autor + strikethrough + opacidad reducida
     - `formatChange` → borde punteado alrededor del texto
   - En `text-renderer.ts`: dibujar indicadores visuales específicos
   - En `canvas-renderer.ts`: dibujar líneas de revisión en el margen izquierdo (barra vertical coloreada)

4. **React UI** (3 días):
   - `RevisionsPanel.tsx`: lista todas las revisiones, permite accept/reject individual o en batch
   - Modificar `ModeButtons.tsx`: cuando se selecciona "Suggesting", activar `trackChanges.toggle`
   - Indicador visual en toolbar cuando tracking está activo
   - Tooltip sobre texto revisado mostrando autor y fecha

5. **DOCX** (2-3 días):
   - **Import**: detectar `w:ins`, `w:del`, `w:rPrChange` wrappers y convertir a `revision` property
   - **Export**: envolver runs con revision en `w:ins`/`w:del` elements, generar `w:rPrChange` para format changes

---

## Módulo 3: Colaboración en Tiempo Real ✅

### Qué falta
No existe ningún mecanismo de edición colaborativa. Google Docs permite que múltiples usuarios editen simultáneamente con cursores visibles y resolución de conflictos automática.

### Dónde se integra

| Paquete | Cambios |
|---------|---------|
| `@jpoffice/model` | Operation Transformation (OT) o CRDT |
| `@jpoffice/engine` | Sync layer, awareness, remote operations |
| `@jpoffice/renderer` | Remote cursors rendering |
| `@jpoffice/react` | Presence indicators, collaboration UI |
| Nuevo: `@jpoffice/collab` | Paquete dedicado a colaboración |

### Archivos a crear

```
packages/collab/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── collab-provider.ts          # Coordinador de colaboración
    ├── awareness.ts                # Presence: cursors, nombres, colores
    ├── operation-transform.ts      # OT: transform(op1, op2) → [op1', op2']
    ├── sync-protocol.ts            # Protocolo de sincronización client↔server
    ├── websocket-provider.ts       # WebSocket transport
    ├── offline-queue.ts            # Cola offline para reconexión
    └── types.ts                    # ClientId, AwarenessState, SyncMessage
```

```
packages/renderer/src/remote-cursor-renderer.ts
packages/react/src/components/PresenceIndicator.tsx
packages/react/src/components/RemoteCursor.tsx
packages/react/src/hooks/useCollaboration.ts
packages/react/src/hooks/usePresence.ts
```

### Pasos de implementación

1. **Decidir OT vs CRDT** (investigación 1-2 días):
   - **OT (Operation Transformation)**: más simple para operaciones tipo documento, pero requiere servidor central. Approach de Google Docs.
   - **CRDT (Conflict-free Replicated Data Types)**: peer-to-peer, más complejo pero sin servidor central. Libraries: Yjs, Automerge.
   - **Recomendación**: usar **Yjs** como CRDT backend. Es battle-tested, tiene bindings para muchos frameworks, y soporta awareness (cursors) out-of-the-box.

2. **Alternativa OT custom** (si no se quiere dependencia externa):
   - Implementar `transform(op1: JPOperation, op2: JPOperation): [JPOperation, JPOperation]` para cada par de tipos de operación (9 tipos × 9 tipos = 81 combinaciones, ~40 relevantes)
   - Transformación de paths: cuando op1 inserta/elimina nodos, ajustar paths de op2
   - El servidor mantiene el documento canónico y transforma operaciones recibidas

3. **Yjs Integration** (3-5 días):
   - Crear `YjsProvider` que mapea `JPDocument` ↔ `Y.Doc`
   - Cada run de texto → `Y.Text` compartido
   - Cada nodo del árbol → `Y.Map` con children como `Y.Array`
   - Bidireccional: cambios locales → Yjs ops, cambios remotos → JPOperations
   - `YjsAwareness` para cursors remotos

4. **WebSocket Provider** (2 días):
   - `WebSocketProvider` conecta a un servidor de sincronización
   - Protocolo: `{ type: 'sync' | 'awareness' | 'update', payload: Uint8Array }`
   - Reconexión automática con backoff exponencial
   - Cola offline: operaciones locales se acumulan durante desconexión

5. **Remote Cursors** (2 días):
   - `RemoteCursorRenderer`: dibujar cursores de otros usuarios en el canvas
     - Línea vertical coloreada + etiqueta con nombre del usuario
     - Highlight de selección remota (semi-transparente en color del usuario)
   - `PresenceIndicator.tsx`: avatares de usuarios conectados en la esquina superior derecha

6. **React Integration** (2 días):
   - `useCollaboration(roomId, userId)`: hook que inicializa provider y retorna estado de conexión
   - `usePresence()`: hook que retorna lista de usuarios conectados + sus cursores
   - Componente `<JPOfficeEditor collaboration={{ roomId, userId, serverUrl }} />`

### Arquitectura de sync

```
┌──────────────────────┐      WebSocket      ┌───────────────┐
│  Client A            │ ◄──────────────────► │  Sync Server  │
│  JPEditor            │                      │  (Yjs)        │
│  └─ CollabProvider   │                      │               │
│     └─ YjsProvider   │ ◄──────────────────► │  Y.Doc        │
│     └─ Awareness     │      Awareness       │  central      │
└──────────────────────┘                      └───────┬───────┘
                                                      │
┌──────────────────────┐      WebSocket      ┌────────┘
│  Client B            │ ◄──────────────────►
│  JPEditor            │
│  └─ CollabProvider   │
└──────────────────────┘
```

---

## Módulo 4: Footnotes y Endnotes ✅

### Qué falta
No existe soporte para notas al pie ni notas finales en ninguna capa. En OOXML se almacenan en `word/footnotes.xml` y `word/endnotes.xml` con referencias inline.

### Archivos a crear

```
packages/model/src/nodes/footnote.ts
packages/engine/src/plugins/footnote/footnote-plugin.ts
packages/layout/src/footnote-layout.ts
packages/renderer/src/footnote-renderer.ts
packages/react/src/components/FootnoteEditor.tsx
packages/docx/src/importer/footnote-parser.ts
packages/docx/src/exporter/footnote-writer.ts
```

### Archivos a modificar

```
packages/model/src/nodes/node.ts              → 'footnote-ref' | 'endnote-ref' | 'footnote' | 'endnote'
packages/model/src/document.ts                → footnotes: JPFootnote[], endnotes: JPEndnote[]
packages/layout/src/layout-engine.ts          → reservar espacio al pie para footnotes
packages/layout/src/types.ts                  → LayoutFootnote en LayoutPage
packages/renderer/src/canvas-renderer.ts      → renderizar zona de footnotes
packages/react/src/JPOfficeEditor.tsx          → UI para insertar notas
```

### Interfaces clave

```typescript
// packages/model/src/nodes/footnote.ts

/** Marca inline dentro de un paragraph que referencia una footnote */
export interface JPFootnoteRef extends JPLeaf {
  readonly type: 'footnote-ref';
  readonly id: string;
  readonly footnoteId: string;
}

/** El contenido de la footnote (vive fuera del body, en document.footnotes) */
export interface JPFootnote {
  readonly id: string;
  readonly content: JPParagraph[];    // una footnote puede tener múltiples párrafos
  readonly noteType: 'footnote' | 'endnote';
}
```

### Pasos de implementación

1. **Modelo** (1-2 días):
   - Agregar `JPFootnoteRef` y `JPEndnoteRef` como leaf nodes (van inline en paragraphs, como los bookmark markers)
   - Agregar `footnotes: JPFootnote[]` y `endnotes: JPEndnote[]` al `JPDocument`
   - Cada `JPFootnoteRef` tiene un `footnoteId` que apunta al `JPFootnote` correspondiente

2. **Layout** (2-3 días):
   - Crear `footnote-layout.ts`:
     - Durante el layout de cada página, recolectar todas las `footnote-ref` que aparecen
     - Reservar espacio en la parte inferior de la página para las footnotes
     - Calcular: `footnoteAreaHeight = sum(footnote content heights) + separator line`
     - Reducir `contentArea.height` de la página en esa cantidad
     - Layoutear el contenido de cada footnote con font más pequeño (10pt vs 12pt normal)
   - Para endnotes: acumular todas hasta la última página y layoutear ahí

3. **Renderer** (1-2 días):
   - Dibujar línea separadora horizontal (1/3 del ancho de página) antes de la zona de footnotes
   - Renderizar superscript con el número de nota antes del texto de la footnote
   - Renderizar el número de referencia como superscript en el texto principal

4. **Engine Plugin** (2 días):
   - `FootnotePlugin` registra comandos:
     - `footnote.insert` → inserta `JPFootnoteRef` en la posición del cursor, crea `JPFootnote` vacía, abre editor de nota
     - `footnote.delete { footnoteId }` → elimina ref + contenido
     - `endnote.insert` / `endnote.delete` → análogo
   - Numeración automática: contar footnote-refs en order de aparición → 1, 2, 3...

5. **DOCX** (2 días):
   - **Import**: parsear `word/footnotes.xml` y `word/endnotes.xml`, mapear `w:footnote` → `JPFootnote`, detectar `w:footnoteReference` en runs
   - **Export**: generar archivos XML separados, insertar references en document.xml, agregar relationships y content types

---

## Módulo 5: Fields (Campos Dinámicos) ✅

### Qué falta
No existe soporte para campos como número de página, total de páginas, fecha, tabla de contenidos, referencias cruzadas. En OOXML son `w:fldSimple` o `w:fldChar` + `w:instrText`.

### Archivos a crear

```
packages/model/src/nodes/field.ts
packages/engine/src/plugins/field/field-plugin.ts
packages/engine/src/plugins/field/field-resolver.ts
packages/engine/src/plugins/toc/toc-plugin.ts
packages/layout/src/field-layout.ts
packages/react/src/components/InsertFieldMenu.tsx
packages/react/src/components/TocDialog.tsx
packages/docx/src/importer/field-parser.ts
packages/docx/src/exporter/field-writer.ts
```

### Interfaces clave

```typescript
// packages/model/src/nodes/field.ts

export type JPFieldType =
  | 'PAGE'           // número de página actual
  | 'NUMPAGES'       // total de páginas
  | 'DATE'           // fecha actual
  | 'TIME'           // hora actual
  | 'AUTHOR'         // autor del documento
  | 'TITLE'          // título del documento
  | 'TOC'            // tabla de contenidos
  | 'REF'            // referencia cruzada a bookmark
  | 'HYPERLINK'      // enlace
  | 'SEQ'            // secuencia numerada (figuras, tablas)
  | 'FILENAME';      // nombre del archivo

export interface JPField extends JPLeaf {
  readonly type: 'field';
  readonly id: string;
  readonly fieldType: JPFieldType;
  readonly instruction: string;      // instrucción raw (e.g. "PAGE \\* MERGEFORMAT")
  readonly cachedResult?: string;    // último valor calculado
  readonly format?: string;          // formato de display
}
```

### Pasos de implementación

1. **Modelo** (1-2 días):
   - Agregar `JPField` como leaf node
   - Los fields son inline (van dentro de runs/paragraphs)
   - `cachedResult` almacena el último valor resuelto (para rendering sin recalcular)

2. **Field Resolver** (2-3 días):
   - `FieldResolver` class que dado un `JPField` + contexto (página actual, total páginas, fecha, documento) retorna el string a mostrar:
     - `PAGE` → necesita saber en qué página está el field (info del layout)
     - `NUMPAGES` → total de páginas del layout result
     - `DATE` → `new Date().toLocaleDateString()`
     - `TOC` → generar estructura de tabla de contenidos a partir de headings con `outlineLevel`
     - `REF` → buscar bookmark por nombre y retornar su contenido/página
   - Resolver se ejecuta post-layout (porque necesita info de paginación)

3. **Layout** (1-2 días):
   - Los fields se layoutean como texto normal usando su `cachedResult`
   - Después del layout, recorrer todos los fields y actualizar `cachedResult` con valores reales
   - Si algún valor cambia (ej: `NUMPAGES` cambió), re-layoutear (máximo 2 iteraciones para convergencia)

4. **TOC Plugin** (2-3 días):
   - Escanear documento buscando paragraphs con `outlineLevel` 0-8
   - Generar estructura: `{ level, text, pageNumber }[]`
   - Insertar como paragraphs con tab leaders (dots) y números de página alineados a la derecha
   - Actualizar al cambiar el documento

5. **Engine Plugin** (2 días):
   - Comandos: `field.insertPageNumber`, `field.insertDate`, `field.insertToc`, `field.updateAll`
   - `field.insertToc` genera múltiples paragraphs (uno por heading entry)

6. **DOCX** (2 días):
   - **Import**: parsear `w:fldSimple` (campo simple) y la secuencia `w:fldChar begin` → `w:instrText` → `w:fldChar separate` → resultado → `w:fldChar end`
   - **Export**: generar como `w:fldSimple` para campos simples, secuencia completa para TOC

7. **PDF** (1 día):
   - Los fields se resuelven durante el export a PDF (post-layout), se renderizan como texto normal

---

## Módulo 6: Paste con Formato (HTML/RTF/Imágenes) ✅

### Qué falta
Actualmente el clipboard solo soporta texto plano. El parámetro `html` en `ClipboardPlugin.paste()` se acepta pero se ignora (línea 76). No se pueden pegar imágenes desde el clipboard.

### Archivos a crear

```
packages/engine/src/plugins/clipboard/html-parser.ts
packages/engine/src/plugins/clipboard/html-to-document.ts
packages/engine/src/plugins/clipboard/document-to-html.ts
packages/engine/src/plugins/clipboard/image-paste-handler.ts
```

### Archivos a modificar

```
packages/engine/src/plugins/clipboard/clipboard-plugin.ts  → reescribir paste() para soportar HTML
packages/engine/src/input/input-manager.ts                  → leer text/html y image/* del clipboard
```

### Pasos de implementación

1. **InputManager** (1 día):
   - Modificar `onPaste` handler para leer múltiples MIME types:
     ```typescript
     const html = e.clipboardData?.getData('text/html');
     const text = e.clipboardData?.getData('text/plain');
     const items = Array.from(e.clipboardData?.items ?? []);
     const imageItem = items.find(i => i.type.startsWith('image/'));
     ```
   - Prioridad: HTML > Image > Plain Text
   - Pasar el contenido correcto al `clipboard.paste` command

2. **HTML Parser** (3-4 días):
   - `html-to-document.ts`: convierte HTML string → fragmento de `JPDocument`
   - Usar `DOMParser` nativo del browser para parsear HTML
   - Mapeo de elementos HTML → nodos JPOffice:
     - `<p>` → `JPParagraph`
     - `<strong>`, `<b>` → run con `bold: true`
     - `<em>`, `<i>` → run con `italic: true`
     - `<u>` → run con `underline: 'single'`
     - `<s>`, `<del>` → run con `strikethrough: true`
     - `<h1>`-`<h6>` → paragraph con `outlineLevel: 0-5`
     - `<ul>`, `<ol>` → paragraphs con `numbering`
     - `<table>` → `JPTable`
     - `<img>` → `JPImage` (descargar src como data URL)
     - `<a>` → `JPHyperlink`
     - `<br>` → `JPLineBreak`
     - `<span style="...">` → extraer inline styles y mapear a `JPRunProperties`
   - Manejar estilos inline CSS: `font-weight`, `font-style`, `text-decoration`, `font-size`, `font-family`, `color`, `background-color`, `text-align`
   - Sanitizar: eliminar scripts, event handlers, data URIs sospechosos

3. **HTML Export (Copy)** (2 días):
   - `document-to-html.ts`: convierte fragmento de documento → HTML string
   - Poner el HTML en el clipboard al copiar: `navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])`
   - Así al pegar en otro editor (Word, Google Docs) se preserva formato

4. **Image Paste** (1 día):
   - Detectar `clipboardData.items` con tipo `image/*`
   - Leer como `Blob` → `FileReader.readAsDataURL()`
   - Crear `JPImage` con las dimensiones naturales de la imagen
   - Insertar en la posición del cursor usando el comando `image.insert`

5. **Paste Special** (1 día):
   - Agregar opción "Paste without formatting" (Ctrl+Shift+V)
   - Fuerza paste como texto plano ignorando HTML

---

## Módulo 7: Spell Check y Grammar Check ✅

### Qué falta
El botón de spelling en el toolbar es un stub vacío. No hay integración con ningún servicio de verificación ortográfica.

### Archivos a crear

```
packages/engine/src/plugins/spellcheck/spellcheck-plugin.ts
packages/engine/src/plugins/spellcheck/dictionary.ts
packages/engine/src/plugins/spellcheck/spellcheck-types.ts
packages/renderer/src/squiggly-renderer.ts
packages/react/src/components/SpellcheckPopover.tsx
packages/react/src/hooks/useSpellcheck.ts
```

### Archivos a modificar

```
packages/layout/src/types.ts              → agregar SpellError[] a LayoutResult
packages/renderer/src/canvas-renderer.ts  → renderizar squiggly underlines
packages/renderer/src/text-renderer.ts    → posicionar squiggly lines bajo texto
packages/react/src/components/Toolbar.tsx  → activar botón spelling
```

### Interfaces clave

```typescript
// packages/engine/src/plugins/spellcheck/spellcheck-types.ts

export interface SpellError {
  readonly path: JPPath;
  readonly offset: number;
  readonly length: number;
  readonly word: string;
  readonly suggestions: string[];
  readonly type: 'spelling' | 'grammar';
}

export interface SpellCheckProvider {
  check(text: string, language: string): Promise<SpellError[]>;
  addToPersonalDictionary(word: string): void;
}
```

### Pasos de implementación

1. **Provider abstraction** (1 día):
   - Interface `SpellCheckProvider` que puede tener múltiples implementaciones:
     - `BrowserSpellCheckProvider`: usa la Web API `Intl` + diccionarios descargables
     - `HunspellProvider`: diccionarios Hunspell en WebAssembly (typo.js o nspell)
     - `APISpellCheckProvider`: llama a un servicio externo (LanguageTool, etc.)
   - El plugin recibe el provider por configuración

2. **SpellcheckPlugin** (2-3 días):
   - Ejecuta spell check de forma incremental:
     - En `onAfterApply`, marcar los paragraphs modificados como "dirty"
     - Debounce de 500ms después de la última edición
     - Verificar solo paragraphs dirty (no todo el documento)
   - Mantiene un `Map<string, SpellError[]>` (paragraphId → errors)
   - Comandos:
     - `spellcheck.checkAll` → verifica todo el documento
     - `spellcheck.ignore { word }` → agrega al diccionario personal
     - `spellcheck.replace { path, offset, length, replacement }` → reemplaza la palabra
     - `spellcheck.toggle` → activa/desactiva
   - Diccionario personal persistido en `localStorage`

3. **Squiggly Renderer** (2 días):
   - `squiggly-renderer.ts`: dibuja líneas onduladas debajo del texto con errores
   - Rojo para spelling, azul para grammar
   - Usa `ctx.beginPath()` + `ctx.quadraticCurveTo()` para crear la onda
   - Las posiciones vienen del layout (se mapean los offsets de error a coordenadas de canvas)
   - Squiggly se dibuja DESPUÉS del texto y ANTES de la selección

4. **React UI** (2 días):
   - `SpellcheckPopover.tsx`: al hacer right-click sobre una palabra con error, mostrar popover con:
     - Lista de sugerencias (click para reemplazar)
     - "Ignore" (agregar al diccionario)
     - "Ignore all" (ignorar todas las ocurrencias)
   - Integrar en `ContextMenu.tsx`: si click derecho sobre palabra con error, mostrar sugerencias primero
   - Indicador en StatusBar: "Spelling: On" / "No errors" / "3 errors"

5. **Diccionario offline** (1-2 días):
   - Usar `nspell` (Hunspell en JS) con diccionarios descargables
   - Descargar diccionario bajo demanda según `language` del documento
   - Cache en IndexedDB para no re-descargar

---

## Módulo 8: Ecuaciones / Math Editor ✅

### Qué falta
No existe soporte para fórmulas matemáticas. Google Docs tiene un editor de ecuaciones completo. En OOXML se representan con Office Math ML (`m:oMath`).

### Archivos a crear

```
packages/model/src/nodes/equation.ts
packages/engine/src/plugins/equation/equation-plugin.ts
packages/layout/src/equation-layout.ts
packages/renderer/src/equation-renderer.ts
packages/react/src/components/EquationEditor.tsx
packages/react/src/components/EquationDialog.tsx
packages/docx/src/importer/equation-parser.ts
packages/docx/src/exporter/equation-writer.ts
```

### Interfaces clave

```typescript
// packages/model/src/nodes/equation.ts

export interface JPEquation extends JPLeaf {
  readonly type: 'equation';
  readonly id: string;
  readonly latex: string;         // representación LaTeX (fuente de verdad)
  readonly display: 'inline' | 'block';  // inline = dentro de texto, block = párrafo propio
}
```

### Pasos de implementación

1. **Modelo** (1 día):
   - Agregar `JPEquation` como leaf node
   - Almacenar fórmula como LaTeX string (formato universal, convertible a MathML/OMML)
   - `display: 'inline'` va dentro de un run, `display: 'block'` reemplaza un paragraph

2. **LaTeX → Visual** (3-5 días):
   - **Opción A (recomendada)**: usar **KaTeX** como dependencia:
     - KaTeX renderiza LaTeX a HTML/SVG
     - Renderizar a un `OffscreenCanvas` o SVG → `drawImage()` en el canvas principal
     - KaTeX es ~300KB pero extremadamente rápido
   - **Opción B**: usar **MathJax** (más completo pero más pesado, ~500KB)
   - **Opción C**: implementar un subset de LaTeX rendering custom (muy costoso, no recomendado)
   - Pre-renderizar cada ecuación como imagen bitmap cacheada para evitar re-renders costosos

3. **Layout** (2 días):
   - `equation-layout.ts`:
     - Para inline: medir el bounds de la ecuación renderizada, tratarla como un "glyph" grande
     - Para block: centrar horizontalmente, agregar spacing before/after
     - Baseline alignment con el texto circundante

4. **Renderer** (1-2 días):
   - `equation-renderer.ts`:
     - Tomar el bitmap cacheado de KaTeX y dibujarlo con `ctx.drawImage()`
     - Invalidar cache cuando cambia la fórmula o el zoom

5. **React UI** (2-3 días):
   - `EquationDialog.tsx`: editor modal con:
     - Input de LaTeX con preview en tiempo real (renderizado con KaTeX)
     - Paleta de símbolos comunes (fracciones, integrales, sumatorias, matrices, griegas)
     - Botón "Insert" que ejecuta `equation.insert { latex, display }`
   - Double-click en ecuación existente → abrir dialog para editar

6. **DOCX** (2-3 días):
   - **Import**: parsear `m:oMath` elements, convertir OMML → LaTeX (existen librerías para esto: `omml-to-latex`)
   - **Export**: convertir LaTeX → OMML (requiere un converter, o exportar como imagen fallback)
   - Fallback: si la conversión falla, exportar la ecuación como imagen embedded

---

## Módulo 9: Shapes, Text Boxes y Drawing Layer ✅

### Qué falta
No existe soporte para formas geométricas, text boxes, líneas, flechas, ni ningún objeto de dibujo. Google Docs tiene un editor de dibujos integrado.

### Archivos a crear

```
packages/model/src/nodes/shape.ts
packages/model/src/nodes/textbox.ts
packages/model/src/properties/shape-props.ts
packages/engine/src/plugins/shape/shape-plugin.ts
packages/layout/src/shape-layout.ts
packages/renderer/src/shape-renderer.ts
packages/react/src/components/ShapeToolbar.tsx
packages/react/src/components/DrawingCanvas.tsx
packages/react/src/overlays/ShapeResizeHandles.tsx
```

### Interfaces clave

```typescript
// packages/model/src/nodes/shape.ts

export type JPShapeType =
  | 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'triangle'
  | 'diamond' | 'pentagon' | 'hexagon' | 'star'
  | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
  | 'line' | 'curved-line' | 'connector'
  | 'callout' | 'cloud' | 'heart';

export interface JPShape extends JPLeaf {
  readonly type: 'shape';
  readonly id: string;
  readonly shapeType: JPShapeType;
  readonly x: number;          // EMU from page left
  readonly y: number;          // EMU from page top
  readonly width: number;      // EMU
  readonly height: number;     // EMU
  readonly rotation?: number;  // degrees
  readonly fill?: JPShapeFill;
  readonly stroke?: JPShapeStroke;
  readonly text?: string;      // texto dentro del shape
  readonly zIndex?: number;
}

export interface JPTextBox extends JPElement {
  readonly type: 'textbox';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly children: readonly JPParagraph[];  // contenido editable
  readonly fill?: JPShapeFill;
  readonly stroke?: JPShapeStroke;
}
```

### Pasos de implementación

1. **Modelo** (2 días):
   - Agregar `JPShape` y `JPTextBox` como node types
   - `JPShape` es leaf (forma geométrica con texto simple opcional)
   - `JPTextBox` es element (contiene paragraphs editables como mini-documento)
   - Propiedades: fill (solid, gradient, pattern), stroke (color, width, dash), shadow, rotation

2. **Shape Renderer** (3-4 días):
   - `shape-renderer.ts`: dibujar cada tipo de forma usando Canvas 2D API
   - Rectángulos: `ctx.rect()`
   - Ellipses: `ctx.ellipse()`
   - Polígonos: `ctx.moveTo()` + `ctx.lineTo()` con coordenadas calculadas
   - Flechas: path custom con punta de flecha
   - Líneas: `ctx.moveTo()` + `ctx.lineTo()` con dashPattern opcional
   - Fills: `ctx.fillStyle` (color sólido o `ctx.createLinearGradient()`)
   - Stroke: `ctx.strokeStyle`, `ctx.lineWidth`, `ctx.setLineDash()`
   - Rotación: `ctx.rotate()` después de `ctx.translate()` al centro del shape
   - Texto dentro del shape: centrado horizontal y verticalmente

3. **Layout** (2 días):
   - Shapes y textboxes son floating objects (como imágenes flotantes)
   - Reutilizar `float-layout.ts` para posicionamiento y text wrapping
   - TextBoxes necesitan layout interno (paragraphs dentro del textbox)

4. **Engine Plugin** (2 días):
   - Comandos: `shape.insert { shapeType, position, size }`, `shape.delete`, `shape.resize`, `shape.move`, `shape.setProperties`
   - `textbox.insert`, `textbox.edit` (entra en modo edición del textbox)

5. **React UI** (2-3 días):
   - `ShapeToolbar.tsx`: paleta de formas disponibles
   - `ShapeResizeHandles.tsx`: handles en las 8 esquinas/bordes + rotación
   - `DrawingCanvas.tsx`: overlay para dibujar formas con mouse (click+drag)
   - Integrar en menú Insert → Drawing

---

## Módulo 10: Multi-Column Layout ✅

### Qué falta
El modelo ya tiene `JPSectionProperties.columns` definido pero el layout engine no lo implementa. Todo el contenido se renderiza en una sola columna.

### Archivos a crear

```
packages/layout/src/column-layout.ts
```

### Archivos a modificar

```
packages/layout/src/layout-engine.ts     → usar column-layout cuando section.columns.count > 1
packages/layout/src/types.ts             → agregar LayoutColumn a LayoutPage
packages/renderer/src/canvas-renderer.ts → renderizar separadores de columna
```

### Pasos de implementación

1. **Column Layout** (3-4 días):
   - `column-layout.ts`:
     - Dado un `contentArea` y `columns: { count, space, separator }`, dividir el área en N columnas
     - `columnWidth = (contentWidth - (count-1) * space) / count`
     - Layoutear contenido secuencialmente: llenar columna 1, cuando se llena pasar a columna 2, etc.
     - Cuando todas las columnas de una página se llenan, crear nueva página
     - Column balancing: distribuir contenido equitativamente entre columnas (opcional, Google Docs no balancea)
   - Manejar column breaks explícitos (`JPColumnBreak`)
   - Manejar paragraphs que cruzan columnas (split + continue en siguiente columna)

2. **Renderer** (1 día):
   - Dibujar línea separadora vertical entre columnas si `separator: true`
   - Offset X de cada bloque según su columna

3. **DOCX** (ya soportado):
   - Import/export de `w:cols` ya está en el section parser/writer
   - Solo necesita que el layout los respete

---

## Módulo 11: Drag & Drop ✅

### Qué falta
No hay ningún handler de drag & drop. No se pueden arrastrar imágenes, texto ni archivos al editor.

### Archivos a crear

```
packages/engine/src/plugins/drag-drop/drag-drop-plugin.ts
packages/react/src/hooks/useDragDrop.ts
```

### Archivos a modificar

```
packages/engine/src/input/input-manager.ts        → agregar drag event listeners
packages/react/src/components/EditorCanvas.tsx     → visual feedback durante drag
packages/renderer/src/canvas-renderer.ts           → drop indicator rendering
```

### Pasos de implementación

1. **Event Handlers** (2 días):
   - En `InputManager`, agregar handlers para:
     - `dragstart` → iniciar drag de texto seleccionado o imagen
     - `dragover` → prevenir default, calcular posición de drop, mostrar indicator
     - `dragleave` → limpiar indicator
     - `drop` → procesar el drop según tipo de contenido
   - Tipos de contenido a manejar:
     - `text/plain` → insertar texto en posición de drop
     - `text/html` → parsear HTML (reutilizar módulo 6) e insertar
     - `Files` (imágenes) → leer como data URL e insertar como imagen
     - Internal drag → mover texto/nodo de una posición a otra

2. **Visual Feedback** (1 día):
   - Durante `dragover`, dibujar un cursor/línea en la posición donde se insertaría el contenido
   - Highlight de la zona de drop (outline azul punteado)
   - Mostrar badge con tipo de contenido ("Image", "Text", etc.)

3. **Internal Text Drag** (2 días):
   - Seleccionar texto → `dragstart` crea `DataTransfer` con el texto
   - Durante drag, mostrar cursor de inserción (no el cursor de selección)
   - En `drop`, usar `move_node` o `delete_text` + `insert_text` para mover
   - Si se mantiene Ctrl, copiar en vez de mover

---

## Módulo 12: Font Embedding y Unicode Completo en PDF ✅

### Qué falta
El PDF export solo usa Standard 14 fonts (Helvetica, Times, Courier) con WinAnsiEncoding (256 caracteres). Cualquier carácter fuera de Latin básico se reemplaza con `?`.

### Archivos a crear

```
packages/pdf/src/cid-font.ts
packages/pdf/src/to-unicode-cmap.ts
packages/pdf/src/font-subsetter.ts
```

### Archivos a modificar

```
packages/pdf/src/pdf-document.ts    → usar CIDFont en vez de Type1
packages/pdf/src/text-painter.ts    → encoding UTF-16BE para CIDFont
packages/pdf/src/font-map.ts        → manejar custom fonts + subsetting
packages/pdf/src/pdf-writer.ts      → generar font descriptors + streams
```

### Pasos de implementación

1. **Font Subsetting** (3-4 días):
   - Usar `fontkit` (ya es dependencia) para:
     - Abrir archivo de fuente (.ttf/.otf)
     - Extraer solo los glyphs usados en el documento (subsetting)
     - Generar un archivo de fuente reducido
   - `font-subsetter.ts`:
     - Input: font buffer + set de caracteres usados
     - Output: subsetted font buffer + glyph-to-CID mapping

2. **CIDFont** (2-3 días):
   - `cid-font.ts`: generar objetos PDF para fuentes CIDFont Type 2 (TrueType):
     ```
     /Type /Font
     /Subtype /Type0
     /BaseFont /FontName
     /Encoding /Identity-H
     /DescendantFonts [CIDFont ref]
     /ToUnicode CMap ref
     ```
   - CIDFont descriptor con métricas: `/Ascent`, `/Descent`, `/CapHeight`, `/FontBBox`, `/ItalicAngle`, `/StemV`
   - Font stream: `/FontFile2` con la fuente subsetted comprimida

3. **ToUnicode CMap** (1-2 días):
   - `to-unicode-cmap.ts`: generar CMap que mapea CIDs → Unicode codepoints
   - Esto permite que los lectores de PDF copien texto correctamente
   - Formato: `beginbfchar` / `endbfchar` con entries hexadecimales

4. **Text Encoding** (1-2 días):
   - Modificar `text-painter.ts`:
     - En vez de WinAnsiEncoding, usar `/Identity-H` encoding
     - Los strings se codifican como UTF-16BE hex: `<XXXX>` por cada carácter
     - Mapear cada carácter → CID usando la tabla del subsetted font
   - Esto soporta CUALQUIER carácter Unicode (emoji, CJK, árabe, etc.)

5. **Font Loading** (1-2 días):
   - Estrategia para obtener fuentes:
     - Bundlear fuentes básicas (una sans-serif, una serif, una monospace) como assets
     - O permitir que el usuario pase fuentes: `exportToPdf(doc, { fonts: { 'Arial': arialBuffer } })`
     - Fallback a Standard 14 si no hay fuente disponible

---

## Módulo 13: Hyperlinks y Bookmarks en PDF ✅

### Qué falta
Los links y bookmarks del documento se pierden completamente al exportar a PDF. No hay `/Annot` objects ni `/Outline` entries.

### Archivos a crear

```
packages/pdf/src/pdf-annotations.ts
packages/pdf/src/pdf-outlines.ts
```

### Archivos a modificar

```
packages/pdf/src/pdf-document.ts  → agregar annotations y outlines al generar páginas
packages/pdf/src/pdf-writer.ts    → soporte para diccionarios de annotations
```

### Pasos de implementación

1. **Link Annotations** (2 días):
   - `pdf-annotations.ts`:
     - Para cada `JPHyperlink` en el documento, calcular su rectángulo en coordenadas de página (del layout result)
     - Generar un `/Annot` de tipo `/Link`:
       ```
       /Type /Annot
       /Subtype /Link
       /Rect [x1 y1 x2 y2]      % coordenadas PDF (bottom-left origin)
       /Border [0 0 0]           % sin borde visible
       /A << /Type /Action /S /URI /URI (https://...) >>
       ```
     - Para links internos (bookmarks), usar `/GoTo` action con `/Dest`
   - Agregar array de annotations a cada `/Page` object: `/Annots [ref1 ref2 ...]`

2. **Document Outlines** (2 días):
   - `pdf-outlines.ts`:
     - Recorrer el documento buscando paragraphs con `outlineLevel` (headings)
     - Construir árbol de outlines (heading hierarchy)
     - Generar objetos `/Outline`:
       ```
       /Type /Outlines
       /First ref1
       /Last refN
       /Count N
       ```
     - Cada outline item:
       ```
       /Title (Heading text)
       /Parent parentRef
       /Dest [pageRef /XYZ x y zoom]
       /Next nextRef
       /Prev prevRef
       ```
   - Agregar `/Outlines` ref al `/Catalog` del PDF
   - Esto crea el panel de navegación lateral en los lectores de PDF

---

## Módulo 14: Tagged PDF / Accesibilidad PDF ✅

### Qué falta
El PDF generado no tiene estructura semántica. No es accesible para screen readers ni cumple PDF/UA.

### Archivos a crear

```
packages/pdf/src/pdf-structure-tree.ts
packages/pdf/src/pdf-tags.ts
```

### Archivos a modificar

```
packages/pdf/src/pdf-document.ts → generar structure tree + marked content
packages/pdf/src/text-painter.ts → emitir marked content operators
packages/pdf/src/pdf-writer.ts   → soporte para StructTreeRoot
```

### Pasos de implementación

1. **Structure Tree** (3-4 días):
   - `pdf-structure-tree.ts`:
     - Crear `/StructTreeRoot` con la jerarquía del documento:
       - `/Document` → `/Sect` (secciones) → `/H1`-`/H6` (headings), `/P` (paragraphs), `/Table`, `/Figure`
     - Cada structure element tiene:
       - `/Type /StructElem`
       - `/S /P` (structure type)
       - `/P parentRef` (parent)
       - `/K` (kids: marked content IDs o sub-elements)
       - `/Pg pageRef` (page)
   - `pdf-tags.ts`: mapeo de JPNode types → PDF structure tags:
     - `paragraph` → `/P`
     - `paragraph` con `outlineLevel` → `/H1`-`/H6`
     - `table` → `/Table`, `table-row` → `/TR`, `table-cell` → `/TD` o `/TH`
     - `image` → `/Figure` con `/Alt` (alt text)
     - `hyperlink` → `/Link`
     - `list-item` → `/LI` dentro de `/L`

2. **Marked Content** (2 días):
   - En `text-painter.ts`, envolver contenido con marked content operators:
     ```
     /P <</MCID 0>> BDC    % begin marked content
     BT ... Tj ET           % texto normal
     EMC                    % end marked content
     ```
   - Cada MCID se vincula a un structure element en el StructTree
   - Agregar `/MarkInfo << /Marked true >>` al Catalog

3. **Metadata** (1 día):
   - Agregar `/Lang (es-AR)` al Catalog (idioma del documento)
   - Agregar alt text para imágenes: `/Alt (descripción de la imagen)`
   - Agregar `/ViewerPreferences << /DisplayDocTitle true >>`

---

## Módulo 15: Table Operations Avanzadas ✅

### Qué falta
Solo existen comandos básicos (insert table, insert/delete row/col). Falta merge de celdas, resize, bordes, shading, y navegación con Tab.

### Archivos a modificar

```
packages/engine/src/plugins/table/table-plugin.ts   → agregar comandos
packages/renderer/src/table-renderer.ts              → resize handles
packages/react/src/components/Toolbar.tsx             → botones de tabla
packages/react/src/overlays/TableResizeHandles.tsx   → crear handles interactivos
packages/react/src/components/TablePropertiesDialog.tsx → crear diálogo
```

### Comandos a agregar

```typescript
// Todos estos van en table-plugin.ts

'table.mergeCells'          // Merge celdas seleccionadas → set gridSpan + verticalMerge
'table.splitCell'           // Split una celda merged → revertir merge
'table.setCellShading'      // { color: string } → backgroundColor de celda
'table.setCellBorders'      // { top, right, bottom, left } con style/width/color
'table.setCellAlignment'    // { horizontal, vertical } alignment dentro de celda
'table.setColumnWidth'      // { columnIndex, width } → redimensionar columna
'table.setRowHeight'        // { rowIndex, height, rule } → altura de fila
'table.toggleHeaderRow'     // Marcar primera fila como header (repite en cada página)
'table.sortByColumn'        // { columnIndex, direction } → reordenar filas
'table.autoFitContents'     // Ajustar anchos de columna al contenido
'table.autoFitWindow'       // Ajustar ancho total de tabla al ancho de página
'table.setTableBorders'     // Bordes de toda la tabla (all, box, grid, none)
'table.navigateToNextCell'  // Tab → siguiente celda (crear fila si última)
'table.navigateToPrevCell'  // Shift+Tab → celda anterior
```

### Pasos de implementación

1. **Cell Merge/Split** (2-3 días):
   - `mergeCells`: dado un rango de celdas seleccionadas (row1,col1 → row2,col2):
     - Celda superior-izquierda: `gridSpan = col2-col1+1`, primer row mantiene contenido
     - Celdas en misma columna (rows > 1): `verticalMerge: 'restart'` en primera, `'continue'` en demás
     - Eliminar contenido de celdas absorbidas (mover a la primera)
   - `splitCell`: revertir gridSpan y verticalMerge, distribuir contenido

2. **Tab Navigation** (1 día):
   - Detectar si cursor está en tabla
   - Tab → mover a siguiente celda (derecha, luego siguiente fila)
   - Si es la última celda, crear nueva fila
   - Shift+Tab → celda anterior

3. **Resize Handles** (2-3 días):
   - `TableResizeHandles.tsx`: overlay React posicionado sobre la tabla
   - Handles en los bordes de columnas (drag horizontal para cambiar width)
   - Handles en los bordes de filas (drag vertical para cambiar height)
   - Al soltar, ejecutar `table.setColumnWidth` / `table.setRowHeight`

4. **Properties Dialog** (2 días):
   - `TablePropertiesDialog.tsx`: dialog modal con tabs:
     - Tab "Table": ancho total, alignment, indent
     - Tab "Row": altura, header row, allow break
     - Tab "Cell": width, vertical alignment, margins
     - Tab "Borders": selector visual de bordes (ninguno, box, grid, custom)
     - Tab "Shading": color picker para background

---

## Módulo 16: Image Editing (Resize, Crop, Efectos) ✅

### Qué falta
Solo se pueden insertar imágenes. No hay resize interactivo, crop, rotación, ni efectos.

### Archivos a crear

```
packages/react/src/overlays/ImageResizeHandles.tsx
packages/react/src/overlays/ImageCropOverlay.tsx
packages/react/src/components/ImagePropertiesDialog.tsx
packages/engine/src/plugins/image/image-transform.ts
```

### Archivos a modificar

```
packages/engine/src/plugins/image/image-plugin.ts  → agregar comandos resize/crop/rotate
packages/model/src/properties/image-props.ts        → agregar crop, rotation, effects
packages/renderer/src/image-renderer.ts              → aplicar crop y rotación al dibujar
```

### Comandos a agregar

```typescript
'image.resize'    // { width, height, preserveAspectRatio }
'image.crop'      // { top, right, bottom, left } en porcentaje
'image.rotate'    // { degrees }
'image.flip'      // { horizontal: boolean, vertical: boolean }
'image.setWrap'   // { wrapType: 'inline' | 'square' | 'tight' | 'behind' | 'inFront' }
'image.replace'   // { newSrc, newMimeType }
'image.setAltText' // { altText }
'image.resetSize' // Volver a tamaño original
```

### Pasos de implementación

1. **Resize Handles** (2 días):
   - `ImageResizeHandles.tsx`: 8 handles (4 esquinas + 4 bordes medios)
   - Corner handles mantienen aspect ratio por defecto
   - Border handles solo cambian una dimensión
   - Al soltar, ejecutar `image.resize` con nuevas dimensiones
   - Mostrar tooltip con dimensiones durante drag ("320 × 240 px")

2. **Crop** (2 días):
   - `ImageCropOverlay.tsx`: al entrar en modo crop, mostrar la imagen completa con zona oscurecida fuera del crop
   - 4 handles en los bordes del crop
   - Al confirmar, guardar crop values y re-renderizar

3. **Renderer** (1-2 días):
   - En `image-renderer.ts`:
     - Crop: usar `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` para dibujar solo la porción visible
     - Rotación: `ctx.save()` → `ctx.translate(centerX, centerY)` → `ctx.rotate(radians)` → draw → `ctx.restore()`
     - Flip: `ctx.scale(-1, 1)` para horizontal, `ctx.scale(1, -1)` para vertical

4. **Properties Dialog** (1 día):
   - `ImagePropertiesDialog.tsx`: tamaño, crop values, alt text, wrap type
   - Inputs numéricos con lock de aspect ratio

---

## Módulo 17: Headers/Footers Editor UI ✅

### Qué falta
El modelo y layout soportan headers/footers pero no hay UI para editarlos. El usuario no puede hacer click en el header/footer para editarlo.

### Archivos a crear

```
packages/react/src/components/HeaderFooterEditor.tsx
packages/engine/src/plugins/header-footer/header-footer-plugin.ts
```

### Archivos a modificar

```
packages/react/src/components/EditorCanvas.tsx     → detectar click en zona de header/footer
packages/renderer/src/canvas-renderer.ts           → modo edición de header/footer
packages/layout/src/layout-engine.ts               → layout separado para header/footer en edición
```

### Pasos de implementación

1. **Click Detection** (1 día):
   - En `EditorCanvas.tsx` y `hit-test.ts`: si el click cae en la zona de header (y > pageTop && y < marginTop) o footer (y > pageHeight - marginBottom), entrar en modo edición de header/footer
   - Mostrar borde punteado alrededor de la zona de header/footer

2. **Editor Mode** (2-3 días):
   - Cuando se edita header/footer, el editor principal se deshabilita (grayed out)
   - El foco pasa al contenido del header/footer
   - El cursor y la selección operan dentro del header/footer
   - El toolbar funciona normalmente (formatting aplica al contenido del header/footer)

3. **Plugin** (2 días):
   - Comandos:
     - `headerFooter.editHeader { type: 'default' | 'first' | 'even' }`
     - `headerFooter.editFooter { type }`
     - `headerFooter.exitEdit` → volver al body
     - `headerFooter.insertPageNumber` → insertar field PAGE
     - `headerFooter.toggleDifferentFirstPage`
     - `headerFooter.toggleDifferentOddEven`

4. **React UI** (2 días):
   - `HeaderFooterEditor.tsx`: toolbar contextual que aparece al editar header/footer
   - Opciones: "Different first page", "Different odd & even", "Insert page number", "Close"
   - Tab de header/footer label: "Header – Section 1"

---

## Módulo 18: Page Setup Dialog ✅

### Qué falta
No hay forma de cambiar tamaño de página, márgenes, orientación o columnas desde la UI.

### Archivos a crear

```
packages/react/src/components/PageSetupDialog.tsx
packages/engine/src/plugins/page-setup/page-setup-plugin.ts
```

### Pasos de implementación

1. **Dialog** (2-3 días):
   - `PageSetupDialog.tsx` con 3 tabs:
     - **Margins**: top, bottom, left, right, gutter (inputs numéricos en cm/inches)
     - **Paper**: size presets (Letter, Legal, A4, A3, A5, Custom) + orientation (portrait/landscape)
     - **Layout**: columns (1, 2, 3, custom), section start (new page, continuous), vertical alignment
   - Preview visual del layout de página en miniatura
   - Apply afecta la sección actual o todo el documento

2. **Plugin** (1-2 días):
   - Comandos:
     - `pageSetup.setMargins { top, bottom, left, right, gutter }`
     - `pageSetup.setPageSize { width, height }` (en twips)
     - `pageSetup.setOrientation { orientation: 'portrait' | 'landscape' }`
     - `pageSetup.setColumns { count, space, separator }`
   - Cada comando modifica `JPSectionProperties` de la sección actual via `set_properties`

3. **Ruler Update** (1 día):
   - Actualizar `Ruler.tsx` para reflejar los márgenes reales de la sección
   - Permitir drag de los márgenes en el ruler para cambiarlos visualmente

---

## Módulo 19: Styles Panel UI ✅

### Qué falta
No hay UI para ver, aplicar, crear o editar estilos nombrados. Solo existen los comandos `styles.apply` y `styles.clear`.

### Archivos a crear

```
packages/react/src/components/StylesPanel.tsx
packages/react/src/components/StyleEditor.tsx
packages/react/src/hooks/useStyles.ts
```

### Pasos de implementación

1. **Styles Panel** (2-3 días):
   - `StylesPanel.tsx`: panel lateral o dropdown que muestra:
     - Lista de estilos disponibles con preview visual (font, tamaño, color)
     - El estilo actualmente aplicado al cursor resaltado
     - Filtro: "All", "In use", "Paragraph", "Character"
   - Click en estilo → aplica al párrafo/selección actual

2. **Style Editor** (2-3 días):
   - `StyleEditor.tsx`: dialog para crear/editar estilos:
     - Nombre del estilo
     - Tipo: paragraph o character
     - "Based on": dropdown de estilos existentes
     - "Next style": dropdown (qué estilo aplica al presionar Enter)
     - Properties: font, size, bold, italic, color, alignment, spacing, indent
     - Preview del resultado
   - "Modify" → edita estilo existente (afecta todo el documento retro-activamente)
   - "New" → crea estilo nuevo

3. **Toolbar Integration** (1 día):
   - Agregar dropdown de estilos en el toolbar (similar a Google Docs: "Normal text", "Heading 1", etc.)
   - El dropdown muestra estilos de párrafo con preview

---

## Módulo 20: Accesibilidad (WCAG 2.1 AA) ✅

### Qué falta
ARIA mínimo (solo `aria-label` en textarea y ruler). Sin screen reader support, sin live regions, sin landmarks, sin keyboard navigation para menús.

### Archivos a modificar

```
packages/react/src/components/EditorCanvas.tsx   → ARIA roles, live regions
packages/react/src/components/Toolbar.tsx         → role="toolbar", aria-labels, keyboard nav
packages/react/src/components/MenuBar.tsx          → role="menubar", arrow key navigation
packages/react/src/components/ContextMenu.tsx      → role="menu", focus management
packages/react/src/components/StatusBar.tsx         → aria-live="polite"
packages/react/src/JPOfficeEditor.tsx              → landmarks, skip links
```

### Pasos de implementación

1. **ARIA Roles** (2 días):
   - `MenuBar`: `role="menubar"`, items con `role="menuitem"`, submenús con `role="menu"`
   - `Toolbar`: `role="toolbar"`, groups con `role="group"`, botones con `aria-pressed` para toggles
   - `EditorCanvas`: `role="textbox"`, `aria-multiline="true"`, `aria-label="Document editor"`
   - `ContextMenu`: `role="menu"`, items con `role="menuitem"`, separadores con `role="separator"`
   - `StatusBar`: `role="status"`, `aria-live="polite"`

2. **Keyboard Navigation** (3 días):
   - **MenuBar**: Arrow Left/Right entre menús, Arrow Up/Down dentro de submenú, Enter para seleccionar, Escape para cerrar
   - **Toolbar**: Tab entra al toolbar, Arrow Left/Right entre botones, Enter/Space para activar
   - **Context Menu**: Arrow Up/Down, Enter, Escape
   - **Dialogs**: Tab trap dentro del dialog, Escape para cerrar, focus en primer input
   - **Focus visible**: outline claramente visible en todos los elementos interactivos

3. **Live Regions** (1-2 días):
   - Anunciar cambios de formato: "Bold applied", "Font changed to Arial"
   - Anunciar navegación: "Page 3 of 5"
   - Anunciar errores de spelling: "Misspelled word: teh, 3 suggestions"
   - Anunciar estado de búsqueda: "3 results found"
   - Usar `aria-live="assertive"` para errores, `"polite"` para info

4. **Screen Reader** (2 días):
   - Mantener un `aria-label` dinámico en el textarea oculto que describe el contexto actual:
     - "Paragraph 1, Line 2, Position 15. Bold, Heading 1."
   - Cuando cambia la selección, actualizar la descripción
   - Implementar `aria-activedescendant` para toolbar items

5. **Skip Links** (0.5 días):
   - Agregar "Skip to document content" link al inicio
   - Agregar "Skip to toolbar" link
   - Links visibles solo con keyboard focus

6. **Color Contrast** (1 día):
   - Verificar que todos los colores cumplen WCAG AA (4.5:1 para texto, 3:1 para UI grande)
   - El gris `#70757a` sobre blanco NO cumple AA para texto pequeño → oscurecer a `#5f6368`
   - Agregar `prefers-reduced-motion` media query para cursor blinking

---

## Módulo 21: Mobile / Touch Support ✅

### Qué falta
Cero soporte táctil. No hay handlers de touch, no hay gestos, no hay adaptación de UI para pantallas pequeñas.

### Archivos a crear

```
packages/engine/src/input/touch-manager.ts
packages/react/src/components/MobileToolbar.tsx
packages/react/src/hooks/useResponsive.ts
```

### Archivos a modificar

```
packages/engine/src/input/input-manager.ts       → delegar a touch-manager
packages/react/src/components/EditorCanvas.tsx    → touch events
packages/react/src/components/Toolbar.tsx          → responsive layout
packages/react/src/components/MenuBar.tsx           → hamburger menu en mobile
packages/react/src/JPOfficeEditor.tsx              → responsive container
```

### Pasos de implementación

1. **Touch Events** (3 días):
   - `touch-manager.ts`:
     - `touchstart` → determinar si es tap (selección), long press (context menu), o inicio de scroll
     - `touchmove` → scroll del documento o selección de texto (drag)
     - `touchend` → finalizar acción
     - Double tap → seleccionar palabra
     - Pinch → zoom in/out (usar 2 touch points, calcular distancia)
   - Adaptar `hit-test.ts` para touch coordinates (touch target más grande que mouse)
   - Selection handles: dos "teardrops" azules que el usuario puede arrastrar para ajustar selección

2. **Responsive UI** (2-3 días):
   - `useResponsive.ts`: hook que detecta `window.innerWidth` y retorna breakpoints:
     - `desktop: > 1024px` → UI completa
     - `tablet: 768-1024px` → toolbar compacto, menú colapsado
     - `mobile: < 768px` → toolbar mínimo, menú hamburguesa
   - `MobileToolbar.tsx`: toolbar simplificado con los botones más usados + botón "More" que expande
   - MenuBar → se convierte en menú hamburguesa (3 líneas) en mobile
   - Ruler → se oculta en mobile
   - StatusBar → simplificado (solo página actual)

3. **Virtual Keyboard** (1-2 días):
   - Detectar cuando aparece el teclado virtual (viewport resize)
   - Ajustar scroll para que el cursor sea visible sobre el teclado
   - Manejar `inputmode` attribute en el textarea oculto

4. **Gestures** (2 días):
   - Swipe right → undo
   - Swipe left → redo
   - Long press → context menu
   - Three-finger tap → select all (opcional)

---

## Módulo 22: Dark Mode y Theming ✅

### Qué falta
Todos los colores están hardcodeados. No hay theme provider, no hay CSS variables, no hay dark mode.

### Archivos a crear

```
packages/react/src/theme/theme-provider.tsx
packages/react/src/theme/themes.ts
packages/react/src/theme/use-theme.ts
```

### Archivos a modificar

```
packages/react/src/components/*.tsx     → TODOS los componentes: reemplazar colores hardcoded por theme tokens
packages/react/src/JPOfficeEditor.tsx   → wrappear con ThemeProvider
packages/renderer/src/page-renderer.ts  → workspace background desde theme
packages/renderer/src/canvas-renderer.ts → colores de selección/cursor desde theme
```

### Pasos de implementación

1. **Theme System** (2-3 días):
   - `themes.ts`: definir tokens:
     ```typescript
     export interface JPTheme {
       colors: {
         background: string;
         surface: string;
         text: string;
         textSecondary: string;
         primary: string;
         border: string;
         toolbarBg: string;
         menuBg: string;
         hoverBg: string;
         activeBg: string;
         selection: string;
         cursor: string;
         pageBg: string;
         workspaceBg: string;
         // ... más tokens
       };
       fonts: { ui: string; };
       spacing: { xs: number; sm: number; md: number; lg: number; };
       borderRadius: { sm: number; md: number; };
     }
     ```
   - Definir `lightTheme` y `darkTheme`

2. **ThemeProvider** (1 día):
   - Context React que provee el theme actual
   - `useTheme()` hook para consumir
   - Soporte para `prefers-color-scheme` media query (auto-detect)
   - Prop `theme: 'light' | 'dark' | 'auto'` en `JPOfficeEditor`

3. **Migración de componentes** (2-3 días):
   - Reemplazar TODOS los colores inline por `theme.colors.xxx`
   - Esto es trabajo mecánico pero extenso (~15 componentes)
   - El canvas page background y workspace background también usan el theme

4. **Dark Mode específico** (1 día):
   - En dark mode, el page background sigue siendo blanco (es un documento)
   - Pero el workspace background es oscuro (#1e1e1e)
   - Toolbar, menus, dialogs usan colores oscuros
   - Iconos se invierten o usan versiones claras

---

## Módulo 23: Version History ✅

### Qué falta
No hay forma de ver versiones anteriores del documento ni restaurar a un estado previo.

### Archivos a crear

```
packages/engine/src/versioning/version-manager.ts
packages/engine/src/versioning/snapshot.ts
packages/react/src/components/VersionHistoryPanel.tsx
packages/react/src/hooks/useVersionHistory.ts
```

### Pasos de implementación

1. **Snapshot System** (2-3 días):
   - `snapshot.ts`: serializar/deserializar `JPDocument` a JSON compacto
   - `version-manager.ts`:
     - Almacenar snapshots en `IndexedDB` (no localStorage, demasiado grande)
     - Auto-snapshot cada N minutos o cada N operaciones
     - Cada snapshot: `{ id, timestamp, label?, document: serialized }`
     - Diff entre snapshots (opcional, para mostrar qué cambió)
     - Máximo de snapshots configurable (ej: últimas 50 versiones)

2. **React UI** (2-3 días):
   - `VersionHistoryPanel.tsx`: panel lateral con timeline de versiones
     - Cada versión muestra: timestamp, label (auto: "hace 5 minutos"), preview
     - Click en versión → previsualizar (modo read-only)
     - Botón "Restore this version" → reemplaza documento actual
     - Botón "Name this version" → agregar label custom
   - Integrar en menú File → "Version history"

---

## Módulo 24: Outline / Navigation Panel ✅

### Qué falta
El Sidebar muestra "Document tabs" como placeholder pero no tiene funcionalidad real. No hay panel de navegación por headings.

### Archivos a modificar

```
packages/react/src/components/Sidebar.tsx → reescribir completamente
```

### Archivos a crear

```
packages/react/src/components/OutlinePanel.tsx
packages/react/src/hooks/useDocumentOutline.ts
```

### Pasos de implementación

1. **Document Outline** (2 días):
   - `useDocumentOutline.ts`: extraer headings (paragraphs con `outlineLevel`) del documento
   - Retorna `{ level: number, text: string, path: JPPath }[]`
   - Actualizar cuando el documento cambia

2. **OutlinePanel** (2 días):
   - Lista jerárquica indentada de headings
   - Click en heading → scroll al heading en el documento + posicionar cursor
   - Highlight del heading visible actualmente (basado en scroll position)
   - Toggle expandir/colapsar niveles
   - Icono de level (H1, H2, etc.)

3. **Sidebar Tabs** (1 día):
   - Reescribir `Sidebar.tsx` con tabs:
     - "Outline" → `OutlinePanel`
     - "Comments" → `CommentsPanel` (módulo 1)
     - "Styles" → `StylesPanel` (módulo 19)

---

## Módulo 25: Keybindings Completos ✅

### Qué falta
Solo hay 14 keybindings. Faltan ~60+ atajos estándar de Google Docs / Word.

### Archivos a modificar

```
packages/engine/src/input/keybindings.ts                              → agregar todos los keybindings
packages/engine/src/plugins/formatting/formatting-plugin.ts           → registrar shortcuts en commands
packages/engine/src/plugins/selection/selection-plugin.ts              → shortcuts de selección
```

### Keybindings a agregar

```typescript
// Formatting
'Ctrl+E'           → format.align { alignment: 'center' }
'Ctrl+L'           → format.align { alignment: 'left' }
'Ctrl+R'           → format.align { alignment: 'right' }
'Ctrl+J'           → format.align { alignment: 'justify' }
'Ctrl+Shift+X'     → format.strikethrough
'Ctrl+.'           → format.superscript
'Ctrl+,'           → format.subscript
'Ctrl+Shift+>'     → format.increaseFontSize
'Ctrl+Shift+<'     → format.decreaseFontSize
'Ctrl+\\'          → format.clearFormatting
'Ctrl+Shift+L'     → list.toggleBullet
'Ctrl+Shift+7'     → list.toggleNumbered

// Navigation
'Home'              → selection.moveToLineStart
'End'               → selection.moveToLineEnd
'Ctrl+Home'         → selection.moveToDocStart
'Ctrl+End'          → selection.moveToDocEnd
'PageUp'            → selection.movePageUp
'PageDown'          → selection.movePageDown
'Ctrl+Shift+Home'   → selection.selectToDocStart
'Ctrl+Shift+End'    → selection.selectToDocEnd

// Document
'Ctrl+S'            → document.save (callback al host)
'Ctrl+P'            → document.print
'Ctrl+Shift+S'      → document.saveAs
'Ctrl+N'            → document.new
'Ctrl+O'            → document.open

// Edit
'Ctrl+D'            → format.fontDialog
'Ctrl+Shift+V'      → clipboard.pasteUnformatted
'F7'                → spellcheck.toggle

// View
'Ctrl+Shift+8'      → view.toggleNonPrintingChars
```

---

## Módulo 26: BiDi / RTL Text Support ✅

### Qué falta
No hay soporte para texto Right-to-Left (árabe, hebreo, persa). No hay algoritmo BiDi implementado.

### Archivos a crear

```
packages/layout/src/bidi.ts
```

### Archivos a modificar

```
packages/model/src/properties/paragraph-props.ts  → agregar direction: 'ltr' | 'rtl'
packages/model/src/properties/run-props.ts         → agregar direction override
packages/layout/src/line-breaker.ts                → reordenar fragments según BiDi
packages/layout/src/layout-engine.ts               → paragraph direction
packages/renderer/src/text-renderer.ts             → render RTL text
```

### Pasos de implementación

1. **Modelo** (0.5 días):
   - Agregar `direction?: 'ltr' | 'rtl'` a `JPParagraphProperties`
   - Agregar `direction?: 'ltr' | 'rtl' | 'auto'` a `JPRunProperties` (override por run)

2. **BiDi Algorithm** (3-5 días):
   - Implementar Unicode Bidirectional Algorithm (UAX #9) o usar librería `bidi-js`
   - `bidi.ts`:
     - Input: string de texto + base direction
     - Output: array de "runs" con sus niveles y direcciones visuales
     - Reordenar runs para display visual (logical order → visual order)
   - Integrar en `line-breaker.ts`: después de break en líneas, reordenar fragments según BiDi levels
   - Mirrors: paréntesis, brackets se espejan en RTL

3. **Layout** (2 días):
   - Paragraph con `direction: 'rtl'`: alinear a la derecha por defecto
   - Indentation: `indent.left` se convierte en `indent.right` en RTL
   - Numbering: números y bullets a la derecha

4. **Renderer** (1-2 días):
   - Canvas `direction` property: `ctx.direction = 'rtl'`
   - Posicionar fragments de derecha a izquierda
   - Cursor se posiciona correctamente en texto mixto

---

## Módulo 27: Knuth-Plass Line Breaking (Justificación Óptima) ✅

### Qué falta
Solo hay line breaking greedy. Para texto justified, Google Docs y Word usan algoritmos óptimos que distribuyen el espacio de forma uniforme.

### Archivos a modificar

```
packages/layout/src/line-breaker.ts → agregar algoritmo Knuth-Plass como opción
```

### Pasos de implementación

1. **Knuth-Plass** (3-5 días):
   - Implementar el algoritmo de "optimal paragraph breaking" de Knuth & Plass:
     - Modelar el texto como secuencia de boxes (glyphs), glue (spaces), penalties (hyphens)
     - Calcular "badness" de cada posible break point
     - Usar programación dinámica para encontrar la combinación de breaks con mínima "demerits" total
   - Parámetros: `looseness`, `tolerance`, `hyphenPenalty`, `doublePenalty` (penalty for consecutive hyphens)
   - Fallback a greedy si el algoritmo no converge (tolerance exceeded)

2. **Hyphenation** (2 días):
   - Integrar diccionario de hyphenation (patrón de Liang/Knuth)
   - Usar librería `hypher` o `hyphen` con diccionarios por idioma
   - Los puntos de hyphenation se agregan como penalties en el modelo Knuth-Plass

3. **Integración** (1 día):
   - En `line-breaker.ts`: si el paragraph es `justify`, usar Knuth-Plass; si no, usar greedy
   - Configurable: `layoutOptions.lineBreaking: 'greedy' | 'optimal'`

---

## Módulo 28: Print Preview ✅

### Qué falta
El menú File → Print llama `window.print()` directamente. No hay preview ni control de impresión.

### Archivos a crear

```
packages/react/src/components/PrintPreview.tsx
packages/react/src/hooks/usePrintPreview.ts
```

### Pasos de implementación

1. **Print Preview** (2-3 días):
   - `PrintPreview.tsx`: modal fullscreen con:
     - Páginas del documento renderizadas como imágenes (canvas → toDataURL)
     - Navegación entre páginas
     - Zoom controls
     - Botón "Print" que abre el dialog nativo del browser
   - Usar `@media print` CSS para ocultar UI y mostrar solo las páginas
   - Alternativa: generar PDF (reutilizar módulo PDF) y mostrarlo en un iframe

2. **CSS Print Styles** (1 día):
   - Stylesheet `@media print` que oculta toolbar, menus, sidebar
   - Muestra solo las páginas del canvas
   - Cada página es un `<div>` con `page-break-after: always`

---

## Módulo 29: Auto-correct y Smart Typing ✅

### Qué falta
No hay auto-corrección, smart quotes, smart dashes, ni auto-capitalización.

### Archivos a crear

```
packages/engine/src/plugins/autocorrect/autocorrect-plugin.ts
packages/engine/src/plugins/autocorrect/autocorrect-rules.ts
```

### Pasos de implementación

1. **AutoCorrectPlugin** (2-3 días):
   - Hook `onAfterApply`: después de cada `insert_text`, verificar si se activó una regla
   - Reglas de reemplazo (ejecutadas después de escribir un espacio o puntuación):
     ```
     (c) → ©    (r) → ®    (tm) → ™
     -- → —     ... → …    -> → →    <- → ←
     1/2 → ½    1/4 → ¼    3/4 → ¾
     ```
   - Smart quotes:
     - `"text"` → `"text"` (abrir comilla = `"`, cerrar = `"`)
     - `'text'` → `'text'` (single quotes)
     - Detectar contexto: después de espacio/inicio = abrir, antes de espacio/fin = cerrar
   - Auto-capitalización:
     - Primera letra después de `.`, `!`, `?` + espacio → mayúscula
     - Primera letra del documento → mayúscula
   - Configurable: on/off por regla, diccionario custom de reemplazos
   - Undo inmediato: si el usuario hace Ctrl+Z después de un auto-correct, revertir SOLO la corrección

---

## Módulo 30: Floating Toolbar on Selection ✅

### Qué falta
Google Docs muestra una barra de herramientas flotante cuando se selecciona texto. JPOffice no tiene esto.

### Archivos a crear

```
packages/react/src/overlays/FloatingToolbar.tsx
```

### Archivos a modificar

```
packages/react/src/components/EditorCanvas.tsx → posicionar floating toolbar
```

### Pasos de implementación

1. **FloatingToolbar** (2 días):
   - Aparece ~300ms después de seleccionar texto (debounce para evitar flicker)
   - Posicionada encima de la selección (centrada horizontalmente)
   - Contiene: Bold, Italic, Underline, Color, Highlight, Link, Comment, Heading style
   - Desaparece cuando la selección colapsa o cambia
   - No interfiere con el toolbar principal
   - Animación: fade-in/slide-up suave

2. **Positioning** (1 día):
   - Calcular la posición top-center del rectángulo de selección (del layout)
   - Ajustar si el toolbar se sale del viewport (flip abajo si no hay espacio arriba)
   - Offset de 8px arriba de la selección

---

## Resumen de Esfuerzo Estimado

| Módulo | Esfuerzo | Prioridad |
|--------|----------|-----------|
| 1. Comentarios | 10-14 días | ALTA |
| 2. Track Changes | 12-16 días | ALTA |
| 3. Colaboración Real-time | 15-20 días | ALTA |
| 4. Footnotes/Endnotes | 8-10 días | MEDIA |
| 5. Fields (TOC, Page#) | 10-12 días | ALTA |
| 6. Paste con Formato | 7-9 días | ALTA |
| 7. Spell Check | 8-10 días | ALTA |
| 8. Ecuaciones | 10-14 días | MEDIA |
| 9. Shapes/Drawing | 12-15 días | BAJA |
| 10. Multi-Column | 5-6 días | MEDIA |
| 11. Drag & Drop | 5-6 días | MEDIA |
| 12. Font Embedding PDF | 10-12 días | ALTA |
| 13. Links en PDF | 4-5 días | ALTA |
| 14. Tagged PDF | 6-8 días | MEDIA |
| 15. Table Operations | 8-10 días | ALTA |
| 16. Image Editing | 6-8 días | MEDIA |
| 17. Header/Footer UI | 5-7 días | MEDIA |
| 18. Page Setup | 4-5 días | MEDIA |
| 19. Styles Panel | 5-7 días | MEDIA |
| 20. Accesibilidad | 8-10 días | ALTA |
| 21. Mobile/Touch | 10-12 días | ALTA |
| 22. Dark Mode | 5-7 días | BAJA |
| 23. Version History | 5-6 días | MEDIA |
| 24. Outline Panel | 4-5 días | MEDIA |
| 25. Keybindings | 2-3 días | MEDIA |
| 26. BiDi/RTL | 8-12 días | MEDIA |
| 27. Knuth-Plass | 5-7 días | BAJA |
| 28. Print Preview | 3-4 días | BAJA |
| 29. Auto-correct | 3-4 días | BAJA |
| 30. Floating Toolbar | 3 días | MEDIA |

**Total estimado: ~220-280 días-desarrollador**

### Orden de implementación sugerido

**Fase A — Core Features (meses 1-3)**:
Módulos 6, 15, 25, 5, 17, 18, 24, 30

**Fase B — Collaboration & Review (meses 3-5)**:
Módulos 1, 2, 7, 23

**Fase C — PDF Profesional (meses 5-6)**:
Módulos 12, 13, 14

**Fase D — Advanced Features (meses 6-8)**:
Módulos 4, 8, 10, 11, 16, 19

**Fase E — Platform & Polish (meses 8-10)**:
Módulos 20, 21, 22, 26, 27, 28, 29

**Fase F — Real-time Collaboration (meses 10-12)**:
Módulo 3, 9
