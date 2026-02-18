export type {
	JPBorderStyle,
	JPBorderDef,
	JPParagraphBorders,
	JPTableBorders,
	JPCellBorders,
	JPShading,
} from './border-props';

export type {
	JPRunProperties,
	JPUnderlineStyle,
} from './run-props';

export type {
	JPParagraphProperties,
	JPAlignment,
	JPLineSpacingRule,
	JPTabStopType,
	JPTabLeader,
	JPTabStop,
	JPNumberingRef,
} from './paragraph-props';

export type {
	JPSectionProperties,
	JPOrientation,
	JPHeaderFooterType,
	JPHeaderFooterRef,
	JPSectionColumns,
} from './section-props';
export { DEFAULT_SECTION_PROPERTIES } from './section-props';

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
} from './table-props';

export type {
	JPImageProperties,
	JPWrapSide,
	JPWrapping,
	JPFloatRelativeTo,
	JPFloatAlign,
	JPFloatPosition,
	JPDrawingProperties,
} from './image-props';

export type {
	JPNumberFormat,
	JPNumberingLevel,
	JPAbstractNumbering,
	JPNumberingInstance,
	JPNumberingRegistry,
} from './numbering';
export { EMPTY_NUMBERING_REGISTRY } from './numbering';
