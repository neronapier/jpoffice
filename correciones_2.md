# JPOffice — Correcciones y Funcionalidades Pendientes (v2)

Auditoría completa del estado del editor JPOffice. Documento de referencia para todas las sesiones de desarrollo futuras.

---

## 1. ESTADO ACTUAL — Lo que YA funciona

### Completado al 100%

| Feature | Detalles |
|---------|----------|
| Texto básico | Insertar, borrar, Enter, Shift+Enter, Tab |
| Formato inline | Bold, italic, underline, strikethrough, super/subscript, font, size, color, highlight |
| Alineación (Fase 1) | 4 botones conectados → `format.align` con left/center/right/justify |
| Viñetas/números (Fase 2) | Layout genera marcadores visuales (•, ◦, ▪ para bullets; 1., a., i. para numbered) |
| Listas | Toggle bullet/numbered, indent/outdent por niveles (0-8) |
| Tablas | Insertar, agregar/eliminar filas y columnas |
| Imágenes inline | Insertar con file picker |
| Headings | H1-H6 via selector en toolbar |
| Undo/Redo | Completo con agrupación de operaciones batch |
| Copy/Cut/Paste | Texto plano funcional |
| Clear formatting | Limpia todas las propiedades del run |
| Context menu | Click derecho con menú estilo Google Docs (español) |
| DOCX import/export | ~90% completo |
| PDF export | ~85% completo |
| UI Google Docs | TitleBar, MenuBar, Toolbar, Sidebar, ModePanel, StatusBar, Ruler |

### Arquitectura del proyecto

```
packages/
  model/     → Tipos inmutables: JPDocument, JPParagraph, JPRun, JPText, operaciones
  engine/    → Editor, plugins (10), comandos (44), InputManager, keybindings
  layout/    → LayoutEngine, line-breaker, style-resolver, float-layout, table-layout
  renderer/  → CanvasRenderer + sub-renderers (text, table, image, selection, cursor, page)
  react/     → Componentes React: JPOfficeEditor, Toolbar, EditorCanvas, MenuBar, etc.
  docx/      → Lectura/escritura de archivos .docx
  pdf/       → Exportación a PDF
  core/      → Utilidades compartidas
```

### Comandos del engine (44 totales, todos implementados)

| Plugin | Comandos |
|--------|----------|
| Text (7) | `text.insert`, `text.deleteBackward`, `text.deleteForward`, `text.insertParagraph`, `text.insertLineBreak`, `text.insertTab`, `text.deleteSelection` |
| Formatting (14) | `format.bold`, `format.italic`, `format.underline`, `format.strikethrough`, `format.superscript`, `format.subscript`, `format.fontSize`, `format.fontFamily`, `format.color`, `format.highlight`, `format.clearFormatting`, `format.align`, `format.lineSpacing`, `format.indent` |
| Heading (3) | `heading.set`, `heading.clear`, `heading.toggle` |
| List (4) | `list.toggleBullet`, `list.toggleNumbered`, `list.indent`, `list.outdent` |
| Table (5) | `table.insert`, `table.insertRow`, `table.insertColumn`, `table.deleteRow`, `table.deleteColumn` |
| Selection (2) | `selection.move`, `selection.selectAll` |
| History (2) | `history.undo`, `history.redo` |
| Clipboard (3) | `clipboard.copy`, `clipboard.cut`, `clipboard.paste` |
| Image (1) | `image.insert` |
| Styles (2) | `styles.apply`, `styles.clear` |

### Keybindings actuales (7)

| Atajo | Comando |
|-------|---------|
| Ctrl+B / Meta+B | `format.bold` |
| Ctrl+I / Meta+I | `format.italic` |
| Ctrl+U / Meta+U | `format.underline` |
| Ctrl+Z / Meta+Z | `history.undo` |
| Ctrl+Y | `history.redo` |
| Ctrl+Shift+Z / Meta+Shift+Z | `history.redo` |
| Ctrl+A / Meta+A | `selection.selectAll` |

---

## 2. AUDITORÍA DE BRECHAS — Lo que FALTA

### 2.1 Toolbar — Botones con `onClick` vacío

| Línea | Botón | onClick actual | Lo que debería hacer |
|-------|-------|---------------|---------------------|
| 588 | Search | `() => {}` | Abrir barra de buscar/reemplazar |
| 604 | Spell check | `() => {}` | Corrector ortográfico (futuro) |
| 607 | Paint format | `() => {}` | Copiar formato del texto actual |
| 702 | Insert link | `() => {}` | Abrir dialog de insertar enlace |

### 2.2 Toolbar — Controles sin conectar

| Línea | Control | Estado actual | Lo que falta |
|-------|---------|--------------|-------------|
| 614-622 | Zoom dropdown | `defaultValue="100"` sin onChange | Conectar a CanvasRenderer.zoom |
| 667 | Bold | Funcional pero sin `active` | Mostrar estado activo |
| 670 | Italic | Funcional pero sin `active` | Mostrar estado activo |
| 673 | Underline | Funcional pero sin `active` | Mostrar estado activo |
| 715-726 | Alignment (4) | Funcional pero sin `active` | Mostrar cuál está seleccionado |
| 731 | Bullet list | Funcional pero sin `active` | Mostrar si párrafo es lista |
| 734 | Numbered list | Funcional pero sin `active` | Mostrar si párrafo es lista |
| 737-740 | Indent/Outdent | Solo llama `list.indent/outdent` | Debe funcionar fuera de listas también |
| 747 | Strikethrough | Funcional pero sin `active` | Mostrar estado activo |
| 750-753 | Super/subscript | Funcional pero sin `active` | Mostrar estado activo |
| — | Line spacing | NO EXISTE en toolbar | Comando `format.lineSpacing` existe pero sin UI |

### 2.3 Toolbar — Componente TBtn ya tiene soporte para `active`

```typescript
// Toolbar.tsx línea 175-210
function TBtn({ title, children, onClick, disabled, active }: {
    // ...
    active?: boolean;  // ← YA EXISTE
}) {
    return (
        <button style={{
            backgroundColor: active ? '#c8d7f5' : hovered ? btnHover : 'transparent',
            // ↑ El estilo activo YA ESTÁ IMPLEMENTADO pero NINGÚN botón lo usa
        }}>
```

### 2.4 Engine — API faltante

| Problema | Archivo | Detalle |
|----------|---------|--------|
| No hay `getFormatAtCursor()` público | `engine/src/editor.ts` | El método privado `getCurrentFormat()` existe en FormattingPlugin (línea 281) pero no está expuesto. El editor no tiene forma de consultar "¿qué formato tiene el texto donde está el cursor?" |
| `getPendingMarks()` es público | `formatting-plugin.ts` línea 122 | Devuelve marcas pendientes para collapsed cursor |
| `resolveSelectionContext()` existe | `text-utils.ts` línea 49-110 | Devuelve contexto completo: textNode, run, paragraph, section con paths |

### 2.5 Keybindings faltantes

| Atajo | Comando | Fase |
|-------|---------|------|
| Ctrl+K | Insertar enlace | Fase 6 |
| Ctrl+F | Buscar | Fase 7 |
| Ctrl+H | Buscar y reemplazar | Fase 7 |
| Ctrl+Enter | Salto de página | Fase 10 |

### 2.6 Plugins que NO existen

| Plugin | Función |
|--------|---------|
| Link Plugin | Insertar/remover hyperlinks (`link.insert`, `link.remove`) |
| Find & Replace Plugin | Buscar texto, navegar coincidencias, reemplazar |
| (Page Break) | No necesita plugin propio, se agrega a text-plugin |

### 2.7 Renderer — Funcionalidad faltante

| Archivo | Problema | Detalle |
|---------|---------|--------|
| `canvas-renderer.ts` | Sin zoom UI | Tiene DPR (`ctx.scale(dpr, dpr)`) pero no factor de zoom adicional |
| `canvas-renderer.ts` | Floats no se dibujan | `page.floats` existe en el layout pero el método `render()` NO los itera |
| `text-renderer.ts` | Sin estilo hyperlink | Fragmentos de hyperlinks se renderizan como texto normal (sin azul, sin subrayado) |
| `selection-renderer.ts` | Sin highlight de búsqueda | Solo renderiza selección azul, no hay amarillo/naranja para resultados de búsqueda |
| `table-renderer.ts` | Bordes hardcoded | Línea 63: `strokeStyle = '#000000'`, `lineWidth = 0.5` — ignora `cell.borders` |

### 2.8 React — Componentes que NO existen

| Componente | Propósito |
|-----------|----------|
| `LinkDialog.tsx` | Modal para insertar enlace (URL + texto) |
| `FindReplaceBar.tsx` | Barra flotante de buscar/reemplazar |
| `MenuDropdown.tsx` | Dropdown genérico para submenús del MenuBar |
| `LineSpacingDropdown` | Dropdown de interlineado (puede ser inline en Toolbar.tsx) |

### 2.9 MenuBar — Completamente decorativo

Los 8 menús (File, Edit, View, Insert, Format, Tools, Extensions, Help) en `MenuBar.tsx` línea 34 son stubs. Solo disparan `onMenuAction?.(item, 'open')` sin dropdown ni acciones.

---

## 3. FASES DE IMPLEMENTACIÓN

---

### FASE 3: Estado activo del Toolbar (CRITICO)

**Impacto:** El más visible. Sin esto, el usuario no sabe si el texto es bold, qué alineación tiene, etc.

#### 3.1 Agregar `getFormatAtCursor()` a JPEditor

**Archivo:** `packages/engine/src/editor.ts`
**Ubicación:** Después de `getSelectedText()` (línea 220)

```typescript
getFormatAtCursor(): {
    run: Partial<JPRunProperties>;
    paragraph: Partial<JPParagraphProperties>;
} | null {
    const sel = this.state.selection;
    if (!sel) return null;
    const doc = this.state.document;
    const ctx = resolveSelectionContext(doc, sel.anchor);
    const formattingPlugin = this.getPlugin('jpoffice.formatting') as FormattingPlugin | undefined;
    const pendingMarks = formattingPlugin?.getPendingMarks();
    return {
        run: { ...ctx.run.properties, ...(pendingMarks ?? {}) },
        paragraph: ctx.paragraph.properties,
    };
}
```

**Imports necesarios:**
- `resolveSelectionContext` de `./plugins/text/text-utils`
- `JPRunProperties`, `JPParagraphProperties` de `@jpoffice/model`
- `FormattingPlugin` de `./plugins/formatting/formatting-plugin`

#### 3.2 Conectar `active` en cada botón del Toolbar

**Archivo:** `packages/react/src/components/Toolbar.tsx`

Agregar al inicio del componente `Toolbar` (después de línea 442):
```typescript
const format = editor.getFormatAtCursor();
const runFmt = format?.run ?? {};
const paraFmt = format?.paragraph ?? {};
```

Modificar cada TBtn:

| Botón | Prop `active` |
|-------|--------------|
| Bold (667) | `active={!!runFmt.bold}` |
| Italic (670) | `active={!!runFmt.italic}` |
| Underline (673) | `active={runFmt.underline != null && runFmt.underline !== 'none'}` |
| Strikethrough (747) | `active={!!runFmt.strikethrough}` |
| Superscript (750) | `active={!!runFmt.superscript}` |
| Subscript (753) | `active={!!runFmt.subscript}` |
| Align Left (715) | `active={(paraFmt.alignment ?? 'left') === 'left'}` |
| Align Center (718) | `active={paraFmt.alignment === 'center'}` |
| Align Right (721) | `active={paraFmt.alignment === 'right'}` |
| Align Justify (724) | `active={paraFmt.alignment === 'justify'}` |
| Bullet list (731) | `active={paraFmt.numbering?.numId === 1}` |
| Numbered list (734) | `active={paraFmt.numbering?.numId === 2}` |

#### 3.3 Controlar selects con valor actual

- **Heading** (627): Cambiar `defaultValue="0"` → `value={String(paraFmt.outlineLevel ?? 0)}`
- **Font family** (640): Cambiar `defaultValue="Arial"` → `value={runFmt.fontFamily ?? 'Arial'}`
- **Font size**: Pasar `currentSize` como prop a `FontSizeControl`

---

### FASE 4: Interlineado y espaciado de párrafo (UI)

**Prerequisito:** Fase 3 (usa formato actual para mostrar valor seleccionado)

#### 4.1 Agregar comandos `format.spaceBefore` y `format.spaceAfter`

**Archivo:** `packages/engine/src/plugins/formatting/formatting-plugin.ts`
**Ubicación:** Después de `format.lineSpacing` (línea 111)

```typescript
editor.registerCommand<{ space: number }>({
    id: 'format.spaceBefore',
    name: 'Space Before',
    canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
    execute: (_ed, args) => this.setParagraphProperty(editor, { spacing: { before: args.space } }),
});

editor.registerCommand<{ space: number }>({
    id: 'format.spaceAfter',
    name: 'Space After',
    canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
    execute: (_ed, args) => this.setParagraphProperty(editor, { spacing: { after: args.space } }),
});
```

**IMPORTANTE:** `setParagraphProperty()` (línea 313) hace merge plano. Para `spacing` necesita merge profundo:
```typescript
// Dentro de setParagraphProperty, para cada párrafo:
const existingSpacing = para.node.properties.spacing ?? {};
const newSpacing = props.spacing ? { ...existingSpacing, ...props.spacing } : undefined;
const mergedProps = newSpacing ? { ...props, spacing: newSpacing } : props;
```

#### 4.2 Agregar dropdown de interlineado al Toolbar

**Archivo:** `packages/react/src/components/Toolbar.tsx`

Crear componente `LineSpacingDropdown` (similar a `ColorPicker`):
- Opciones: Single (240), 1.15 (276), 1.5 (360), Double (480), 2.5 (600), 3.0 (720)
- Valores en unidades OOXML (240 = interlineado simple)
- Ubicar entre indent buttons y strikethrough (después de línea 742)
- Ejecuta: `editor.executeCommand('format.lineSpacing', { spacing: value })`
- Agregar icono de interlineado al objeto `icons`

---

### FASE 5: Sangría inteligente (fuera de listas)

**Problema:** Los botones indent (líneas 456-457) solo llaman `list.indent`/`list.outdent`, que retorna `false` si el párrafo no está en una lista.

#### 5.1 Cambiar handlers de indent

**Archivo:** `packages/react/src/components/Toolbar.tsx`

Reemplazar líneas 456-457:
```typescript
// ANTES:
const { execute: indentInc } = useCommand('list.indent');
const { execute: indentDec } = useCommand('list.outdent');

// DESPUÉS:
const handleIndentIncrease = useCallback(() => {
    if (editor.canExecuteCommand('list.indent')) {
        editor.executeCommand('list.indent');
    } else {
        try { editor.executeCommand('format.indent', { direction: 'increase' }); } catch {}
    }
}, [editor]);

const handleIndentDecrease = useCallback(() => {
    if (editor.canExecuteCommand('list.outdent')) {
        editor.executeCommand('list.outdent');
    } else {
        try { editor.executeCommand('format.indent', { direction: 'decrease' }); } catch {}
    }
}, [editor]);
```

Actualizar líneas 737/740 para usar `handleIndentIncrease`/`handleIndentDecrease`.

El comando `format.indent` ya existe y funciona (formatting-plugin.ts línea 114-119, método `changeIndent()` línea 336-357, paso de 720 twips = 0.5 pulgada).

---

### FASE 6: Insertar enlace (Hyperlinks)

#### 6.1 Crear Link Plugin

**Archivo NUEVO:** `packages/engine/src/plugins/link/link-plugin.ts`

Comandos:
- `link.insert` — args: `{ href: string, text?: string }` — Envuelve selección en `JPHyperlink`
- `link.remove` — Desenvuelve hyperlink, mueve children al nivel del párrafo

Registrar en `JPOfficeEditor.tsx` (línea ~260).

#### 6.2 Keybinding Ctrl+K

**Archivo:** `packages/engine/src/input/keybindings.ts`

```typescript
{ shortcut: 'Ctrl+K', commandId: 'link.showDialog' },
{ shortcut: 'Meta+K', commandId: 'link.showDialog' },
```

#### 6.3 Crear LinkDialog

**Archivo NUEVO:** `packages/react/src/components/LinkDialog.tsx`

Modal con:
- Input para URL
- Input para texto a mostrar (default: texto seleccionado)
- Botones "Aplicar" y "Cancelar"
- Estilo Google Docs (fondo blanco, bordes redondeados, botón azul)

#### 6.4 Estilo visual de hyperlinks

**Archivo:** `packages/layout/src/layout-engine.ts` (método `collectInlineItems`, case `'hyperlink'` línea 680)

Después de agregar items del hyperlink, parchear su estilo:
```typescript
case 'hyperlink': {
    const hyperlink = child as JPHyperlink;
    const startIdx = items.length;
    for (let hi = 0; hi < hyperlink.children.length; hi++) {
        const hRun = hyperlink.children[hi];
        const hRunPath: JPPath = [...childPath, hi];
        this.collectRunItems(styles, paragraph, hRun, hRunPath, items);
    }
    // Parchear estilo para hyperlinks
    for (let i = startIdx; i < items.length; i++) {
        items[i] = {
            ...items[i],
            style: { ...items[i].style, color: '#1a73e8', underline: 'single' },
        };
    }
    break;
}
```

El renderer ya lee `style.color` y `style.underline`, así que los links se dibujarán azules automáticamente.

#### 6.5 Integrar dialog

**Archivo:** `packages/react/src/JPOfficeEditor.tsx`

Agregar estado `linkDialogOpen` y handlers para abrir/cerrar/aplicar.

---

### FASE 7: Buscar y reemplazar

#### 7.1 Crear FindReplacePlugin

**Archivo NUEVO:** `packages/engine/src/plugins/find-replace/find-replace-plugin.ts`

```typescript
interface SearchMatch {
    path: JPPath;       // path al text node
    offset: number;     // offset dentro del texto
    length: number;     // longitud del match
}
```

Comandos:
- `find.search` — args: `{ term: string, caseSensitive?: boolean }` — Busca en todos los JPText nodes
- `find.next` — Navega al siguiente match
- `find.previous` — Navega al match anterior
- `find.replace` — args: `{ replacement: string }` — Reemplaza match actual
- `find.replaceAll` — args: `{ replacement: string }` — Reemplaza todos

#### 7.2 Keybindings

**Archivo:** `packages/engine/src/input/keybindings.ts`

```typescript
{ shortcut: 'Ctrl+F', commandId: 'find.showUI' },
{ shortcut: 'Meta+F', commandId: 'find.showUI' },
{ shortcut: 'Ctrl+H', commandId: 'find.showUI', args: { replace: true } },
```

#### 7.3 Crear FindReplaceBar

**Archivo NUEVO:** `packages/react/src/components/FindReplaceBar.tsx`

Barra flotante top-right (estilo Google Docs):
- Input de búsqueda
- Botones ↑/↓ para navegar
- Contador "3 de 15"
- Botón X para cerrar
- Modo reemplazar: input adicional + botones Replace / Replace All

#### 7.4 Highlights de búsqueda en renderer

**Archivo:** `packages/renderer/src/selection-renderer.ts`

Nuevo método `renderSearchHighlights()`:
- Matches normales: fondo amarillo `rgba(255, 235, 59, 0.4)`
- Match actual: fondo naranja `rgba(255, 152, 0, 0.5)`

**Archivo:** `packages/renderer/src/canvas-renderer.ts`

Agregar storage para matches y llamar a `renderSearchHighlights()` en el loop de render.

---

### FASE 8: Zoom funcional

#### 8.1 Estado de zoom

**Archivo:** `packages/react/src/JPOfficeEditor.tsx`

```typescript
const [zoom, setZoom] = useState(100);
// Pasar zoom/100 a EditorCanvas y zoom a Toolbar
```

#### 8.2 Conectar dropdown

**Archivo:** `packages/react/src/components/Toolbar.tsx`

Cambiar zoom `<select>` de `defaultValue` a controlado con `value` y `onChange`.

Props nuevos en `ToolbarProps`: `zoom?: number`, `onZoomChange?: (zoom: number) => void`

#### 8.3 Zoom en EditorCanvas

**Archivo:** `packages/react/src/components/EditorCanvas.tsx`

Nuevo prop `zoom?: number`. Efecto que llama `renderer.setZoom(zoom)` cuando cambia.

#### 8.4 Zoom en CanvasRenderer

**Archivo:** `packages/renderer/src/canvas-renderer.ts`

```typescript
private zoom = 1.0;

setZoom(zoom: number): void { this.zoom = zoom; }

// En render() línea 130:
ctx.scale(this.dpr * this.zoom, this.dpr * this.zoom);

// En getTotalHeight():
return base * this.zoom;

// En hitTest() — dividir coordenadas por zoom:
const adjustedX = canvasX / this.zoom;
const adjustedY = canvasY / this.zoom + this.scrollY;
```

---

### FASE 9: Paint format (copiar formato)

#### 9.1 Comandos

**Archivo:** `packages/engine/src/plugins/formatting/formatting-plugin.ts`

Campos nuevos:
```typescript
private copiedFormat: Partial<JPRunProperties> | null = null;
private paintFormatActive = false;
```

Comandos:
- `format.copyFormat` — Copia propiedades del run actual, activa modo paint
- `format.pasteFormat` — Aplica formato copiado a la selección actual, desactiva modo

Getters públicos: `isPaintFormatActive()`, `clearPaintFormat()`

#### 9.2 Toolbar

**Archivo:** `packages/react/src/components/Toolbar.tsx`

Botón paint format (línea 607): `active={isPaintFormatActive}`, onClick toggle copy/paste.

#### 9.3 Comportamiento click-to-apply

Cuando paint format está activo, el siguiente mouseUp con selección ejecuta `format.pasteFormat`. Se puede implementar en el hook `onAfterApply` del FormattingPlugin detectando cambios de selección.

---

### FASE 10: Salto de página

#### 10.1 Comando

**Archivo:** `packages/engine/src/plugins/text/text-plugin.ts`

```typescript
editor.registerCommand({
    id: 'text.insertPageBreak',
    name: 'Insert Page Break',
    canExecute: () => !editor.isReadOnly() && editor.getSelection() !== null,
    execute: () => this.insertPageBreak(editor),
});
```

Método `insertPageBreak()`:
1. Insertar nuevo párrafo (`text.insertParagraph`)
2. Establecer `pageBreakBefore: true` en el párrafo nuevo

El layout engine ya maneja `pageBreakBefore` (layout-engine.ts línea 212-219) y nodos `page-break` (línea 207-209).

#### 10.2 Keybinding

**Archivo:** `packages/engine/src/input/keybindings.ts`

```typescript
{ shortcut: 'Ctrl+Enter', commandId: 'text.insertPageBreak' },
{ shortcut: 'Meta+Enter', commandId: 'text.insertPageBreak' },
```

---

### FASE 11: Mejoras de rendering

#### 11a: Dibujar imágenes flotantes

**Archivo:** `packages/renderer/src/canvas-renderer.ts`

En `render()` (alrededor de línea 167), después de renderizar blocks:

```typescript
if (page.floats) {
    for (const float of page.floats) {
        this.imageRenderer.renderImage(ctx, {
            kind: 'image',
            rect: { x: float.x, y: float.y, width: float.width, height: float.height },
            nodePath: [],
            src: float.src,
            mimeType: float.mimeType,
        }, pageX, pageY, () => this.render());
    }
}
```

Nota: Floats behind-text deben renderizarse ANTES de los blocks, in-front-of-text DESPUÉS.

#### 11b: Estilo visual hyperlinks

Ya cubierto en Fase 6.4 (parchear estilo en layout-engine.ts).

#### 11c: Bordes de tabla con propiedades reales

**Archivo:** `packages/renderer/src/table-renderer.ts`

Reemplazar bordes hardcoded (líneas 63-66) con lectura de `cell.borders`:

```typescript
private drawBorder(ctx, side: 'top'|'bottom'|'left'|'right', cell, offsetX, offsetY): void {
    const border = cell.borders?.[side];
    if (!border || border.style === 'none') return;
    ctx.strokeStyle = border.color ? `#${border.color}` : '#000000';
    ctx.lineWidth = border.size ? border.size / 8 : 0.5;
    // Dibujar línea según el lado
}
```

---

### FASE 12: Menús dropdown del MenuBar (BAJA PRIORIDAD)

#### 12.1 Crear MenuDropdown genérico

**Archivo NUEVO:** `packages/react/src/components/MenuDropdown.tsx`

```typescript
interface MenuItemDef {
    id: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
    submenu?: MenuItemDef[];
}
```

#### 12.2 Definir contenido de menús

```typescript
const MENUS = {
    File: [
        { id: 'file.new', label: 'Nuevo', shortcut: 'Ctrl+N' },
        { id: 'file.open', label: 'Abrir', shortcut: 'Ctrl+O' },
        { id: 'file.download', label: 'Descargar', submenu: [
            { id: 'file.download.docx', label: 'Microsoft Word (.docx)' },
            { id: 'file.download.pdf', label: 'Documento PDF (.pdf)' },
        ]},
        { id: 'file.print', label: 'Imprimir', shortcut: 'Ctrl+P' },
    ],
    Edit: [
        { id: 'edit.undo', label: 'Deshacer', shortcut: 'Ctrl+Z' },
        { id: 'edit.redo', label: 'Rehacer', shortcut: 'Ctrl+Y' },
        { id: 'edit.cut', label: 'Cortar', shortcut: 'Ctrl+X' },
        { id: 'edit.copy', label: 'Copiar', shortcut: 'Ctrl+C' },
        { id: 'edit.paste', label: 'Pegar', shortcut: 'Ctrl+V' },
        { id: 'edit.selectAll', label: 'Seleccionar todo', shortcut: 'Ctrl+A' },
        { id: 'edit.find', label: 'Buscar y reemplazar', shortcut: 'Ctrl+H' },
    ],
    Insert: [
        { id: 'insert.image', label: 'Imagen' },
        { id: 'insert.table', label: 'Tabla' },
        { id: 'insert.link', label: 'Enlace', shortcut: 'Ctrl+K' },
        { id: 'insert.pageBreak', label: 'Salto de página', shortcut: 'Ctrl+Enter' },
    ],
    Format: [
        { id: 'format.bold', label: 'Negrita', shortcut: 'Ctrl+B' },
        { id: 'format.italic', label: 'Cursiva', shortcut: 'Ctrl+I' },
        { id: 'format.underline', label: 'Subrayado', shortcut: 'Ctrl+U' },
        { id: 'format.lineSpacing', label: 'Interlineado y espaciado' },
        { id: 'format.clearFormatting', label: 'Borrar formato' },
    ],
};
```

#### 12.3 Integrar en MenuBar.tsx

Refactorizar para mantener estado de menú abierto y renderizar `MenuDropdown` al hacer click.

---

## 4. TABLA RESUMEN

| Fase | Feature | Prioridad | Esfuerzo | Archivos a modificar | Archivos nuevos |
|------|---------|-----------|----------|---------------------|----------------|
| **3** | **Toolbar estado activo** | **CRITICO** | **~150 líneas** | `editor.ts`, `Toolbar.tsx` | — |
| **5** | **Sangría inteligente** | **Alto** | **~20 líneas** | `Toolbar.tsx` | — |
| **10** | **Salto de página** | **Alto** | **~40 líneas** | `text-plugin.ts`, `keybindings.ts` | — |
| **11a** | **Floats render** | **Medio** | **~30 líneas** | `canvas-renderer.ts` | — |
| **11c** | **Bordes tabla** | **Bajo** | **~60 líneas** | `table-renderer.ts` | — |
| **4** | **Interlineado UI** | **Alto** | **~100 líneas** | `formatting-plugin.ts`, `Toolbar.tsx` | — |
| **9** | **Paint format** | **Medio** | **~100 líneas** | `formatting-plugin.ts`, `Toolbar.tsx` | — |
| **8** | **Zoom** | **Medio** | **~80 líneas** | `Toolbar.tsx`, `EditorCanvas.tsx`, `canvas-renderer.ts`, `JPOfficeEditor.tsx` | — |
| **6** | **Insertar enlace** | **Medio** | **~300 líneas** | `layout-engine.ts`, `keybindings.ts`, `Toolbar.tsx`, `JPOfficeEditor.tsx` | `link-plugin.ts`, `LinkDialog.tsx` |
| **7** | **Buscar/reemplazar** | **Medio** | **~400 líneas** | `canvas-renderer.ts`, `selection-renderer.ts`, `keybindings.ts`, `JPOfficeEditor.tsx` | `find-replace-plugin.ts`, `FindReplaceBar.tsx` |
| **12** | **Menús dropdown** | **Bajo** | **~500 líneas** | `MenuBar.tsx`, `JPOfficeEditor.tsx` | `MenuDropdown.tsx` |

**Total estimado: ~1,780 líneas de código, 5 archivos nuevos**

---

## 5. ORDEN DE EJECUCIÓN RECOMENDADO

```
Bloque 1 (Quick wins + crítico):
  Fase 3  → Toolbar estado activo
  Fase 5  → Sangría inteligente (trivial, ~20 líneas)
  Fase 10 → Salto de página (trivial, ~40 líneas)
  Fase 11a → Floats render (pequeño, ~30 líneas)
  Fase 11c → Bordes tabla (pequeño, ~60 líneas)

Bloque 2 (Dependen de Fase 3):
  Fase 4  → Interlineado UI
  Fase 9  → Paint format

Bloque 3 (Independientes):
  Fase 8  → Zoom funcional

Bloque 4 (Features grandes):
  Fase 6  → Insertar enlace
  Fase 7  → Buscar y reemplazar

Bloque 5 (Baja prioridad):
  Fase 12 → Menús dropdown del MenuBar
```

---

## 6. GRAFO DE DEPENDENCIAS

```
Fase 3 (Active State)
  ├─→ Fase 4 (Line Spacing UI) — usa getFormatAtCursor() para mostrar valor actual
  └─→ Fase 9 (Paint Format) — usa getFormatAtCursor() para copiar formato

Fase 5 (Smart Indent) — independiente
Fase 6 (Links) — independiente
Fase 7 (Find & Replace) — independiente
Fase 8 (Zoom) — independiente
Fase 10 (Page Break) — independiente
Fase 11a (Float Render) — independiente
Fase 11c (Table Borders) — independiente
Fase 12 (Menus) — beneficia de Fases 6, 7, 10 para items del menú
```

---

## 7. VERIFICACIÓN POR FASE

| Fase | Test manual |
|------|------------|
| 3 | Seleccionar texto bold → botón B se resalta azul. Cambiar alineación → botón correcto resaltado. |
| 4 | Abrir dropdown de interlineado → seleccionar "Double" → espacio entre líneas duplica visualmente. |
| 5 | Cursor en párrafo sin lista → click "Increase indent" → sangría aumenta 0.5 pulgada. |
| 6 | Ctrl+K → dialog aparece → ingresar URL → texto se muestra azul con subrayado. |
| 7 | Ctrl+F → barra aparece → escribir texto → coincidencias resaltadas amarillo, actual naranja. |
| 8 | Cambiar zoom a 150% → documento se escala → click funciona en posición correcta. |
| 9 | Click "Paint format" → botón se resalta → seleccionar otro texto → formato se aplica. |
| 10 | Ctrl+Enter → salto de página → texto continúa en página siguiente. |
| 11a | Abrir DOCX con imagen flotante → imagen aparece en posición correcta. |
| 11c | Abrir DOCX con tabla con bordes coloreados → bordes respetan color y grosor. |
| 12 | Click en "File" → dropdown aparece con opciones. Click en "Edit > Undo" → ejecuta undo. |

### Comando de build para verificar cada fase:

```bash
pnpm turbo typecheck --filter=@jpoffice/engine --filter=@jpoffice/layout --filter=@jpoffice/renderer --filter=@jpoffice/react
pnpm turbo build
pnpm turbo lint
cd ../Testing/jpoffice-test && rm -rf node_modules/.vite && pnpm install --force
pnpm dev
```

---

## 8. ARCHIVOS CLAVE — REFERENCIA RÁPIDA

| Archivo | Path completo | Líneas clave |
|---------|--------------|-------------|
| Editor principal | `packages/engine/src/editor.ts` | Línea 53-267 (clase JPEditor) |
| Formatting plugin | `packages/engine/src/plugins/formatting/formatting-plugin.ts` | L122 getPendingMarks(), L281 getCurrentFormat() (privado) |
| Text utils | `packages/engine/src/plugins/text/text-utils.ts` | L49-110 resolveSelectionContext() |
| Keybindings | `packages/engine/src/input/keybindings.ts` | L11-30 DEFAULT_KEYBINDINGS[] |
| Input manager | `packages/engine/src/input/input-manager.ts` | L72-105 onKeyDown handler |
| Toolbar | `packages/react/src/components/Toolbar.tsx` | L175-210 TBtn (tiene active prop), L440-761 Toolbar component |
| EditorCanvas | `packages/react/src/components/EditorCanvas.tsx` | L10-16 props, L104-130 handleMouseDown |
| JPOfficeEditor | `packages/react/src/JPOfficeEditor.tsx` | L101-159 EditorInner state & handlers |
| Layout engine | `packages/layout/src/layout-engine.ts` | L522-620 layoutParagraph(), L680-688 hyperlink case |
| Style resolver | `packages/layout/src/style-resolver.ts` | L122-162 resolveParagraphLayout() |
| Canvas renderer | `packages/renderer/src/canvas-renderer.ts` | L122-203 render(), L252-260 hitTest() |
| Text renderer | `packages/renderer/src/text-renderer.ts` | L22-92 renderLine(), L108-157 decorations |
| Selection renderer | `packages/renderer/src/selection-renderer.ts` | L24-87 renderSelection() |
| Table renderer | `packages/renderer/src/table-renderer.ts` | L35-67 renderCell(), L63 bordes hardcoded |
| List plugin | `packages/engine/src/plugins/list/list-plugin.ts` | L6-7 BULLET_NUM_ID=1, NUMBERED_NUM_ID=2 |
| Text plugin | `packages/engine/src/plugins/text/text-plugin.ts` | L18-69 initialize() — 7 comandos |
