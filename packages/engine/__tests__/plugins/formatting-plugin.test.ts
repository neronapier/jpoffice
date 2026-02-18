import { describe, it, expect, beforeEach } from 'vitest';
import { JPEditor } from '../../src/editor';
import { TextPlugin } from '../../src/plugins/text/text-plugin';
import { FormattingPlugin } from '../../src/plugins/formatting/formatting-plugin';
import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	resetIdCounter,
	getNodeAtPath,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';
import type { JPRun, JPRunProperties } from '@jpoffice/model';

const TEXT_PATH = [0, 0, 0, 0, 0];
const RUN_PATH = [0, 0, 0, 0];

function makeDoc(text = 'Hello World', runProps: JPRunProperties = {}) {
	return createDocument({
		id: generateId(),
		body: createBody(generateId(), [
			createSection(
				generateId(),
				[
					createParagraph(generateId(), [
						createRun(generateId(), [createText(generateId(), text)], runProps),
					]),
				],
				DEFAULT_SECTION_PROPERTIES,
			),
		]),
	});
}

function getRunAt(editor: JPEditor, path: number[]): JPRun {
	return getNodeAtPath(editor.getDocument(), path) as JPRun;
}

describe('FormattingPlugin', () => {
	beforeEach(() => resetIdCounter());

	function createEditor(text = 'Hello World', runProps: JPRunProperties = {}) {
		return new JPEditor({
			document: makeDoc(text, runProps),
			plugins: [new TextPlugin(), new FormattingPlugin()],
		});
	}

	describe('format.bold', () => {
		it('applies bold to range selection', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.bold');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.bold).toBe(true);
		});

		it('toggles off bold when all runs are bold', () => {
			const editor = createEditor('Hello', { bold: true });
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('format.bold');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.bold).toBe(false);
		});

		it('sets pending marks on collapsed selection', () => {
			const editor = createEditor();
			const plugin = editor.getPlugin('jpoffice.formatting') as FormattingPlugin;
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 3 },
				focus: { path: TEXT_PATH, offset: 3 },
			});

			editor.executeCommand('format.bold');
			expect(plugin.getPendingMarks()?.bold).toBe(true);
		});
	});

	describe('format.italic', () => {
		it('applies italic to range selection', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.italic');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.italic).toBe(true);
		});
	});

	describe('format.underline', () => {
		it('applies single underline', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.underline');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.underline).toBe('single');
		});

		it('toggles off underline when all are underlined', () => {
			const editor = createEditor('Hello', { underline: 'single' });
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('format.underline');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.underline).toBe('none');
		});
	});

	describe('format.fontSize', () => {
		it('sets font size on range selection', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.fontSize', { size: 48 }); // 24pt
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.fontSize).toBe(48);
		});
	});

	describe('format.fontFamily', () => {
		it('sets font family on range selection', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.fontFamily', { family: 'Georgia' });
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.fontFamily).toBe('Georgia');
		});
	});

	describe('format.color', () => {
		it('sets text color on range selection', () => {
			const editor = createEditor();
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 11 },
			});

			editor.executeCommand('format.color', { color: 'FF0000' });
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.color).toBe('FF0000');
		});
	});

	describe('format.superscript', () => {
		it('applies superscript and clears subscript', () => {
			const editor = createEditor('Hello', { subscript: true });
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('format.superscript');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties.superscript).toBe(true);
			expect(run.properties.subscript).toBe(false);
		});
	});

	describe('format.clearFormatting', () => {
		it('clears all formatting', () => {
			const editor = createEditor('Hello', {
				bold: true,
				italic: true,
				fontSize: 48,
			});
			editor.setSelection({
				anchor: { path: TEXT_PATH, offset: 0 },
				focus: { path: TEXT_PATH, offset: 5 },
			});

			editor.executeCommand('format.clearFormatting');
			const run = getRunAt(editor, RUN_PATH);
			expect(run.properties).toEqual({});
		});
	});
});
