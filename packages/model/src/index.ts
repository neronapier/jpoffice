// === Nodes ===
export type {
	JPNodeType,
	JPBaseNode,
	JPElement,
	JPLeaf,
	JPNode,
} from './nodes/node';
export { isElement, isLeaf, generateId, resetIdCounter } from './nodes/node';

export type { JPText } from './nodes/text';
export { createText, isText } from './nodes/text';

export type { JPRun } from './nodes/run';
export { createRun, isRun } from './nodes/run';

export type { JPParagraph, JPInlineNode } from './nodes/paragraph';
export { createParagraph, isParagraph } from './nodes/paragraph';

export type { JPTable, JPTableRow, JPTableCell, JPCellContent } from './nodes/table';
export {
	createTable,
	createTableRow,
	createTableCell,
	isTable,
	isTableRow,
	isTableCell,
} from './nodes/table';

export type { JPImage } from './nodes/image';
export { createImage, isImage } from './nodes/image';

export type { JPDrawing } from './nodes/drawing';
export { createDrawing, isDrawing } from './nodes/drawing';

export type { JPHyperlink } from './nodes/hyperlink';
export { createHyperlink } from './nodes/hyperlink';

export type { JPBookmarkStart, JPBookmarkEnd } from './nodes/bookmark';
export { createBookmarkStart, createBookmarkEnd } from './nodes/bookmark';

export type { JPPageBreak, JPLineBreak, JPColumnBreak, JPTab } from './nodes/break';
export { createPageBreak, createLineBreak, createColumnBreak, createTab } from './nodes/break';

export type { JPSection, JPBlockNode } from './nodes/section';
export { createSection, isSection } from './nodes/section';

export type { JPBody } from './nodes/body';
export { createBody, isBody } from './nodes/body';

export type { JPHeader, JPFooter, JPHeaderFooterContent } from './nodes/header-footer';
export { createHeader, createFooter } from './nodes/header-footer';

// === Document ===
export type { JPDocument, JPDocumentMetadata, JPMediaAsset } from './document';
export { createDocument, isDocument } from './document';

// === Properties ===
export type {
	JPBorderStyle,
	JPBorderDef,
	JPParagraphBorders,
	JPTableBorders,
	JPCellBorders,
	JPShading,
} from './properties/border-props';

export type { JPRunProperties, JPUnderlineStyle } from './properties/run-props';

export type {
	JPParagraphProperties,
	JPAlignment,
	JPLineSpacingRule,
	JPTabStopType,
	JPTabLeader,
	JPTabStop,
	JPNumberingRef,
} from './properties/paragraph-props';

export type {
	JPSectionProperties,
	JPOrientation,
	JPHeaderFooterType,
	JPHeaderFooterRef,
	JPSectionColumns,
} from './properties/section-props';
export { DEFAULT_SECTION_PROPERTIES } from './properties/section-props';

export type {
	JPTableProperties,
	JPTableWidth,
	JPTableWidthType,
	JPTableLayout,
	JPTableCellMargins,
	JPTableGridCol,
	JPTableRowProperties,
	JPVerticalMerge,
	JPTextDirection,
	JPTableCellProperties,
} from './properties/table-props';

export type {
	JPImageProperties,
	JPWrapSide,
	JPWrapping,
	JPFloatRelativeTo,
	JPFloatAlign,
	JPFloatPosition,
	JPDrawingProperties,
} from './properties/image-props';

export type {
	JPNumberFormat,
	JPNumberingLevel,
	JPAbstractNumbering,
	JPNumberingInstance,
	JPNumberingRegistry,
} from './properties/numbering';
export {
	EMPTY_NUMBERING_REGISTRY,
	addAbstractNumbering,
	removeAbstractNumbering,
	updateAbstractNumbering,
	addNumberingInstance,
	removeNumberingInstance,
	updateNumberingInstance,
	findAbstractNumbering,
	findNumberingInstance,
	resolveNumberingLevel,
} from './properties/numbering';

// === Styles ===
export type { JPStyle, JPStyleType } from './styles/style';
export type { JPStyleRegistry } from './styles/style-registry';
export {
	createStyleRegistry,
	findStyle,
	findDefaultStyle,
	resolveStyleParagraphProperties,
	resolveStyleRunProperties,
} from './styles/style-registry';
export {
	STYLE_NORMAL,
	STYLE_HEADING1,
	STYLE_HEADING2,
	STYLE_HEADING3,
	STYLE_HEADING4,
	STYLE_HEADING5,
	STYLE_HEADING6,
	STYLE_LIST_PARAGRAPH,
	STYLE_DEFAULT_TABLE,
	DEFAULT_STYLES,
} from './styles/defaults';

// === Path & Selection ===
export type { JPPath, JPPoint, JPRange, JPSelection } from './path';
export {
	comparePaths,
	pathEquals,
	isAncestor,
	isAncestorOrEqual,
	parentPath,
	lastIndex,
	siblingPath,
	childPath,
	commonAncestor,
	transformPathAfterInsert,
	transformPathAfterRemove,
} from './path';

// === Operations ===
export type {
	JPOperation,
	JPOperationBatch,
	JPInsertTextOp,
	JPDeleteTextOp,
	JPInsertNodeOp,
	JPRemoveNodeOp,
	JPSplitNodeOp,
	JPMergeNodeOp,
	JPMoveNodeOp,
	JPSetPropertiesOp,
	JPSetSelectionOp,
} from './operations/operation';
export { applyOperation, getNodeAtPath } from './operations/apply';
export { invertOperation } from './operations/invert';

// === Traverse ===
export {
	traverseNodes,
	traverseElements,
	traverseTexts,
	traverseByType,
	getAncestors,
	getParent,
	findNode,
	countText,
	getPlainText,
} from './traverse';

// === Normalize ===
export { getNormalizationOps, needsNormalization } from './normalize';

// === Units ===
export {
	twipsToPx,
	pxToTwips,
	twipsToPt,
	ptToTwips,
	twipsToInches,
	inchesToTwips,
	twipsToCm,
	cmToTwips,
	twipsToEmu,
	emuToTwips,
	emuToPx,
	pxToEmu,
	emuToPt,
	ptToEmu,
	emuToInches,
	inchesToEmu,
	emuToCm,
	cmToEmu,
	halfPointsToPt,
	ptToHalfPoints,
	halfPointsToPx,
	eighthPointsToPt,
	ptToEighthPoints,
} from './units';
