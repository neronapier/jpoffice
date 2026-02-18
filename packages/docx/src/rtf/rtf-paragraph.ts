/**
 * Serializes JPParagraph to RTF paragraph commands.
 */

import type { JPParagraph, JPRun } from '@jpoffice/model';
import { serializeRun } from './rtf-run';
import type { RtfWriter } from './rtf-writer';

/** Build RTF paragraph formatting commands from properties. */
function buildParagraphFormatting(paragraph: JPParagraph): string {
	const props = paragraph.properties;
	let rtf = '\\pard';

	// Alignment
	if (props.alignment) {
		const alignMap: Record<string, string> = {
			left: '\\ql',
			center: '\\qc',
			right: '\\qr',
			justify: '\\qj',
			distribute: '\\qj', // RTF doesn't have distribute; approximate with justify
		};
		rtf += alignMap[props.alignment] ?? '';
	}

	// Spacing
	if (props.spacing) {
		if (props.spacing.before !== undefined) {
			rtf += `\\sb${props.spacing.before}`;
		}
		if (props.spacing.after !== undefined) {
			rtf += `\\sa${props.spacing.after}`;
		}
		if (props.spacing.line !== undefined) {
			rtf += `\\sl${props.spacing.line}`;
			if (props.spacing.lineRule === 'exact') {
				rtf += '\\slmult0';
			} else if (props.spacing.lineRule === 'auto') {
				rtf += '\\slmult1';
			} else {
				rtf += '\\slmult0'; // atLeast
			}
		}
	}

	// Indent
	if (props.indent) {
		if (props.indent.left !== undefined) {
			rtf += `\\li${props.indent.left}`;
		}
		if (props.indent.right !== undefined) {
			rtf += `\\ri${props.indent.right}`;
		}
		if (props.indent.firstLine !== undefined) {
			rtf += `\\fi${props.indent.firstLine}`;
		}
		if (props.indent.hanging !== undefined) {
			rtf += `\\fi-${props.indent.hanging}`;
		}
	}

	// Keep with next / keep lines together
	if (props.keepNext) rtf += '\\keepn';
	if (props.keepLines) rtf += '\\keep';
	if (props.pageBreakBefore) rtf += '\\pagebb';
	if (props.widowControl === false) rtf += '\\nowidctlpar';

	// Tab stops
	if (props.tabs) {
		for (const tab of props.tabs) {
			const typeMap: Record<string, string> = {
				center: '\\tqc',
				right: '\\tqr',
				decimal: '\\tqdec',
			};
			if (tab.type !== 'left') {
				rtf += typeMap[tab.type] ?? '';
			}
			if (tab.leader) {
				const leaderMap: Record<string, string> = {
					dot: '\\tldot',
					hyphen: '\\tlhyph',
					underscore: '\\tlul',
				};
				rtf += leaderMap[tab.leader] ?? '';
			}
			rtf += `\\tx${tab.position}`;
		}
	}

	return rtf;
}

/** Serialize a complete paragraph to RTF. */
export function serializeParagraph(paragraph: JPParagraph, writer: RtfWriter): string {
	let rtf = buildParagraphFormatting(paragraph);

	// Serialize inline children
	for (const child of paragraph.children) {
		if (child.type === 'run') {
			rtf += serializeRun(child as JPRun, writer);
		} else if (child.type === 'line-break') {
			rtf += '\\line ';
		} else if (child.type === 'tab') {
			rtf += '\\tab ';
		} else if (child.type === 'column-break') {
			rtf += '\\column ';
		}
	}

	rtf += '\\par\n';
	return rtf;
}
