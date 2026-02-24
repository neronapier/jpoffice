import type { JPOrientation, JPSectionColumns, JPSectionProperties } from '@jpoffice/model';
import type { JPEditor } from '../../editor';
import type { JPPlugin } from '../plugin';
import { resolveSelectionContext } from '../text/text-utils';

// ── Unit conversion helpers (twips <-> mm) ──────────────────────────

/** Convert twips to millimeters. 1 inch = 1440 twips = 25.4 mm, so 1 twip = 25.4/1440 */
export function twipsToMm(twips: number): number {
	return (twips * 25.4) / 1440;
}

/** Convert millimeters to twips. 1 mm = 1440/25.4 twips */
export function mmToTwips(mm: number): number {
	return (mm * 1440) / 25.4;
}

// ── Page Presets ─────────────────────────────────────────────────────

export interface PagePreset {
	readonly width: number; // twips
	readonly height: number; // twips
	readonly name: string;
}

export const PAGE_PRESETS = {
	letter: { width: 12240, height: 15840, name: 'Letter (8.5" x 11")' },
	legal: { width: 12240, height: 20160, name: 'Legal (8.5" x 14")' },
	a4: { width: 11906, height: 16838, name: 'A4 (210mm x 297mm)' },
	a3: { width: 16838, height: 23811, name: 'A3 (297mm x 420mm)' },
	a5: { width: 8391, height: 11906, name: 'A5 (148mm x 210mm)' },
	b5: { width: 10318, height: 14570, name: 'B5 (182mm x 257mm)' },
	executive: { width: 10440, height: 15120, name: 'Executive (7.25" x 10.5")' },
} as const;

export type PagePresetName = keyof typeof PAGE_PRESETS;

// ── Command argument types ───────────────────────────────────────────

export interface SetMarginsArgs {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
	gutter?: number;
	header?: number;
	footer?: number;
}

export interface SetPageSizeArgs {
	width: number;
	height: number;
}

export interface SetOrientationArgs {
	orientation: JPOrientation;
}

export interface SetColumnsArgs {
	count: number;
	space?: number;
	separator?: boolean;
}

export interface ApplyPresetArgs {
	preset: PagePresetName;
}

// ── PageSetupInfo ────────────────────────────────────────────────────

export interface PageSetupInfo {
	readonly pageSize: { readonly width: number; readonly height: number };
	readonly margins: JPSectionProperties['margins'];
	readonly orientation: JPOrientation;
	readonly columns?: JPSectionColumns;
}

// ── Helper: resolve current section path ─────────────────────────────

function getCurrentSectionPath(editor: JPEditor): readonly number[] | null {
	const sel = editor.getSelection();
	if (!sel) return null;

	const doc = editor.getDocument();
	try {
		const ctx = resolveSelectionContext(doc, sel.anchor);
		return ctx.sectionPath;
	} catch {
		return null;
	}
}

function getCurrentSectionProps(editor: JPEditor): JPSectionProperties | null {
	const sel = editor.getSelection();
	if (!sel) return null;

	const doc = editor.getDocument();
	try {
		const ctx = resolveSelectionContext(doc, sel.anchor);
		return ctx.section.properties;
	} catch {
		return null;
	}
}

// ── PageSetupPlugin ──────────────────────────────────────────────────

/**
 * PageSetupPlugin provides commands to modify page layout properties
 * of the current section: margins, page size, orientation, and columns.
 */
export class PageSetupPlugin implements JPPlugin {
	readonly id = 'jpoffice.pageSetup';
	readonly name = 'Page Setup';

	initialize(editor: JPEditor): void {
		// ── pageSetup.setMargins ──
		editor.registerCommand<SetMarginsArgs>({
			id: 'pageSetup.setMargins',
			name: 'Set Page Margins',
			canExecute: () => !editor.isReadOnly() && getCurrentSectionPath(editor) !== null,
			execute: (_ed, args) => this.setMargins(editor, args),
		});

		// ── pageSetup.setPageSize ──
		editor.registerCommand<SetPageSizeArgs>({
			id: 'pageSetup.setPageSize',
			name: 'Set Page Size',
			canExecute: () => !editor.isReadOnly() && getCurrentSectionPath(editor) !== null,
			execute: (_ed, args) => this.setPageSize(editor, args),
		});

		// ── pageSetup.setOrientation ──
		editor.registerCommand<SetOrientationArgs>({
			id: 'pageSetup.setOrientation',
			name: 'Set Page Orientation',
			canExecute: () => !editor.isReadOnly() && getCurrentSectionPath(editor) !== null,
			execute: (_ed, args) => this.setOrientation(editor, args),
		});

		// ── pageSetup.setColumns ──
		editor.registerCommand<SetColumnsArgs>({
			id: 'pageSetup.setColumns',
			name: 'Set Columns',
			canExecute: () => !editor.isReadOnly() && getCurrentSectionPath(editor) !== null,
			execute: (_ed, args) => this.setColumns(editor, args),
		});

		// ── pageSetup.applyPreset ──
		editor.registerCommand<ApplyPresetArgs>({
			id: 'pageSetup.applyPreset',
			name: 'Apply Page Size Preset',
			canExecute: (_ed, args) =>
				!editor.isReadOnly() &&
				getCurrentSectionPath(editor) !== null &&
				args?.preset in PAGE_PRESETS,
			execute: (_ed, args) => this.applyPreset(editor, args),
		});
	}

	// ── Public query methods ─────────────────────────────────────────

	/**
	 * Return the current section's page setup info, or null if no selection.
	 */
	getCurrentPageSetup(editor: JPEditor): PageSetupInfo | null {
		const props = getCurrentSectionProps(editor);
		if (!props) return null;

		return {
			pageSize: props.pageSize,
			margins: props.margins,
			orientation: props.orientation,
			columns: props.columns,
		};
	}

	/**
	 * Return the list of available page size presets.
	 */
	getAvailablePresets(): ReadonlyArray<PagePreset & { readonly key: PagePresetName }> {
		return (Object.keys(PAGE_PRESETS) as PagePresetName[]).map((key) => ({
			key,
			...PAGE_PRESETS[key],
		}));
	}

	// ── Command implementations ──────────────────────────────────────

	private setMargins(editor: JPEditor, args: SetMarginsArgs): void {
		const sectionPath = getCurrentSectionPath(editor);
		if (!sectionPath) return;

		const props = getCurrentSectionProps(editor);
		if (!props) return;

		const oldMargins = props.margins;
		const newMargins = {
			top: args.top ?? oldMargins.top,
			bottom: args.bottom ?? oldMargins.bottom,
			left: args.left ?? oldMargins.left,
			right: args.right ?? oldMargins.right,
			gutter: args.gutter ?? oldMargins.gutter,
			header: args.header ?? oldMargins.header,
			footer: args.footer ?? oldMargins.footer,
		};

		editor.apply({
			type: 'set_properties',
			path: sectionPath,
			properties: { margins: newMargins },
			oldProperties: { margins: oldMargins },
		});
	}

	private setPageSize(editor: JPEditor, args: SetPageSizeArgs): void {
		const sectionPath = getCurrentSectionPath(editor);
		if (!sectionPath) return;

		const props = getCurrentSectionProps(editor);
		if (!props) return;

		const oldPageSize = props.pageSize;
		const newPageSize = { width: args.width, height: args.height };

		editor.apply({
			type: 'set_properties',
			path: sectionPath,
			properties: { pageSize: newPageSize },
			oldProperties: { pageSize: oldPageSize },
		});
	}

	private setOrientation(editor: JPEditor, args: SetOrientationArgs): void {
		const sectionPath = getCurrentSectionPath(editor);
		if (!sectionPath) return;

		const props = getCurrentSectionProps(editor);
		if (!props) return;

		const oldOrientation = props.orientation;
		const newOrientation = args.orientation;

		// If orientation actually changes, swap width and height
		if (oldOrientation === newOrientation) return;

		const oldPageSize = props.pageSize;
		const newPageSize = {
			width: oldPageSize.height,
			height: oldPageSize.width,
		};

		editor.batch(() => {
			editor.apply({
				type: 'set_properties',
				path: sectionPath,
				properties: { orientation: newOrientation, pageSize: newPageSize },
				oldProperties: { orientation: oldOrientation, pageSize: oldPageSize },
			});
		});
	}

	private setColumns(editor: JPEditor, args: SetColumnsArgs): void {
		const sectionPath = getCurrentSectionPath(editor);
		if (!sectionPath) return;

		const props = getCurrentSectionProps(editor);
		if (!props) return;

		const oldColumns = props.columns;
		const newColumns: JPSectionColumns = {
			count: args.count,
			space: args.space ?? oldColumns?.space ?? 720, // default 0.5 inch
			separator: args.separator ?? oldColumns?.separator ?? false,
		};

		editor.apply({
			type: 'set_properties',
			path: sectionPath,
			properties: { columns: newColumns },
			oldProperties: { columns: oldColumns },
		});
	}

	private applyPreset(editor: JPEditor, args: ApplyPresetArgs): void {
		const preset = PAGE_PRESETS[args.preset];
		if (!preset) return;

		const sectionPath = getCurrentSectionPath(editor);
		if (!sectionPath) return;

		const props = getCurrentSectionProps(editor);
		if (!props) return;

		const oldPageSize = props.pageSize;
		const oldOrientation = props.orientation;

		// Determine if the preset dimensions match the current orientation
		// In landscape, the preset width becomes height and vice versa
		let newWidth: number = preset.width;
		let newHeight: number = preset.height;
		if (oldOrientation === 'landscape') {
			newWidth = preset.height;
			newHeight = preset.width;
		}

		const newPageSize = { width: newWidth, height: newHeight };

		editor.apply({
			type: 'set_properties',
			path: sectionPath,
			properties: { pageSize: newPageSize },
			oldProperties: { pageSize: oldPageSize },
		});
	}
}
