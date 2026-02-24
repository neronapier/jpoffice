import type { JPEquation } from '@jpoffice/model';
import { NS } from '../xml/namespaces';
import type { XmlBuilder } from '../xml/xml-builder';

/**
 * Write a JPEquation node as OOXML math markup.
 */
export function writeEquation(b: XmlBuilder, eq: JPEquation): void {
	if (eq.display === 'block') {
		b.open('m:oMathPara', { 'xmlns:m': NS.m });
	}

	b.open('m:oMath', eq.display === 'inline' ? { 'xmlns:m': NS.m } : {});
	b.open('m:r');
	b.open('m:t');
	b.text(eq.latex);
	b.close(); // m:t
	b.close(); // m:r
	b.close(); // m:oMath

	if (eq.display === 'block') {
		b.close(); // m:oMathPara
	}
}
