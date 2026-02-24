/**
 * Maps JPNode/layout block types to PDF structure tags for accessibility (Tagged PDF).
 *
 * PDF structure tags follow the standard role mapping defined in
 * PDF 1.7 (ISO 32000-1), Section 14.8.4.
 */

/** Standard PDF structure tag names for document semantics. */
export type PdfStructureTag =
	| 'Document'
	| 'Sect'
	| 'P'
	| 'H1'
	| 'H2'
	| 'H3'
	| 'H4'
	| 'H5'
	| 'H6'
	| 'Table'
	| 'TR'
	| 'TH'
	| 'TD'
	| 'Figure'
	| 'Link'
	| 'L'
	| 'LI'
	| 'LBody'
	| 'Span'
	| 'BlockQuote';

/**
 * Map a layout block type (or paragraph outline level) to its corresponding PDF structure tag.
 *
 * @param nodeType - The layout block kind: 'paragraph', 'table', 'image', or a specific role
 * @param outlineLevel - For paragraphs, the heading level (0 = H1, 5 = H6). Undefined = normal paragraph.
 * @returns The appropriate PDF structure tag
 */
export function nodeTypeToTag(nodeType: string, outlineLevel?: number): PdfStructureTag {
	switch (nodeType) {
		case 'paragraph': {
			if (outlineLevel !== undefined && outlineLevel >= 0 && outlineLevel <= 5) {
				const headingTags: PdfStructureTag[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
				return headingTags[outlineLevel];
			}
			return 'P';
		}
		case 'table':
			return 'Table';
		case 'table-row':
			return 'TR';
		case 'table-header-cell':
			return 'TH';
		case 'table-cell':
			return 'TD';
		case 'image':
			return 'Figure';
		case 'link':
			return 'Link';
		case 'list':
			return 'L';
		case 'list-item':
			return 'LI';
		case 'list-body':
			return 'LBody';
		case 'span':
			return 'Span';
		case 'blockquote':
			return 'BlockQuote';
		case 'section':
			return 'Sect';
		default:
			return 'P';
	}
}
