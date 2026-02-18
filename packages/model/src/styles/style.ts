import type { JPParagraphProperties } from '../properties/paragraph-props';
import type { JPRunProperties } from '../properties/run-props';
import type { JPTableProperties } from '../properties/table-props';

export type JPStyleType = 'paragraph' | 'character' | 'table' | 'numbering';

/**
 * JPStyle defines a named style that can be referenced by paragraphs,
 * runs, or tables. Styles support inheritance via `basedOn`.
 */
export interface JPStyle {
	readonly id: string;
	readonly name: string;
	readonly type: JPStyleType;
	readonly basedOn?: string; // parent style id
	readonly next?: string; // style for next paragraph after Enter
	readonly isDefault?: boolean;
	readonly paragraphProperties?: JPParagraphProperties;
	readonly runProperties?: JPRunProperties;
	readonly tableProperties?: JPTableProperties;
}
