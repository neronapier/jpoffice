/**
 * Serializes JPRun formatting to RTF control words.
 */

import type { JPRun, JPRunProperties } from '@jpoffice/model';
import { isText } from '@jpoffice/model';
import type { RtfWriter } from './rtf-writer';
import { escapeRtf } from './rtf-writer';

const HIGHLIGHT_MAP: Record<string, number> = {
	yellow: 7,
	green: 11,
	cyan: 10,
	magenta: 12,
	blue: 9,
	red: 6,
	darkBlue: 1,
	darkCyan: 2,
	darkGreen: 3,
	darkMagenta: 4,
	darkRed: 5,
	darkYellow: 14,
	darkGray: 8,
	lightGray: 15,
	black: 0,
};

/** Build RTF formatting commands for run properties. */
export function buildRunFormatting(props: JPRunProperties, writer: RtfWriter): string {
	let rtf = '';

	if (props.bold) rtf += '\\b';
	if (props.italic) rtf += '\\i';

	if (props.underline && props.underline !== 'none') {
		const ulMap: Record<string, string> = {
			single: '\\ul',
			double: '\\uldb',
			thick: '\\ulth',
			dotted: '\\uld',
			dashed: '\\uldash',
			dashDot: '\\uldashd',
			dashDotDot: '\\uldashdd',
			wave: '\\ulwave',
		};
		rtf += ulMap[props.underline] ?? '\\ul';
	}

	if (props.strikethrough) rtf += '\\strike';
	if (props.doubleStrikethrough) rtf += '\\striked1';
	if (props.superscript) rtf += '\\super';
	if (props.subscript) rtf += '\\sub';
	if (props.allCaps) rtf += '\\caps';
	if (props.smallCaps) rtf += '\\scaps';

	if (props.fontFamily) {
		const fi = writer.getFontIndex(props.fontFamily);
		rtf += `\\f${fi}`;
	}

	// fontSize is in half-points in model
	if (props.fontSize) {
		rtf += `\\fs${props.fontSize}`;
	}

	if (props.color) {
		const ci = writer.addColor(props.color);
		rtf += `\\cf${ci}`;
	}

	if (props.highlight) {
		const hi = HIGHLIGHT_MAP[props.highlight];
		if (hi !== undefined) {
			rtf += `\\highlight${hi}`;
		}
	}

	if (props.backgroundColor) {
		const ci = writer.addColor(props.backgroundColor);
		rtf += `\\chshdng0\\chcbpat${ci}`;
	}

	if (props.letterSpacing) {
		// letterSpacing is in twips, RTF \expnd is in quarter-points (twips/5)
		rtf += `\\expnd${Math.round(props.letterSpacing / 5)}`;
	}

	return rtf;
}

/** Serialize a JPRun (including its text children) to RTF. */
export function serializeRun(run: JPRun, writer: RtfWriter): string {
	const fmt = buildRunFormatting(run.properties, writer);
	let text = '';

	for (const child of run.children) {
		if (isText(child)) {
			text += escapeRtf(child.text);
		}
	}

	if (!fmt) return text;
	return `{${fmt} ${text}}`;
}
