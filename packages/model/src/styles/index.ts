export type { JPStyle, JPStyleType } from './style';

export type { JPStyleRegistry } from './style-registry';
export {
	createStyleRegistry,
	findStyle,
	findDefaultStyle,
	resolveStyleParagraphProperties,
	resolveStyleRunProperties,
} from './style-registry';

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
} from './defaults';
