/**
 * Types for the Styles Panel UI.
 * These types bridge the model-level JPStyle with the UI,
 * providing a simplified view of style information.
 */

/**
 * Simplified style properties for UI consumption.
 * Combines paragraph and run properties into a flat structure.
 */
export interface StyleProperties {
	// Paragraph properties
	readonly alignment?: string;
	readonly spacing?: { before?: number; after?: number; line?: number };
	readonly indent?: { left?: number; right?: number; firstLine?: number };
	readonly outlineLevel?: number;
	// Run properties
	readonly fontFamily?: string;
	readonly fontSize?: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly underline?: string;
	readonly color?: string;
}

/**
 * Full style information exposed to the UI.
 */
export interface StyleInfo {
	readonly id: string;
	readonly name: string;
	readonly type: 'paragraph' | 'character';
	readonly basedOn?: string;
	readonly nextStyle?: string;
	readonly builtIn: boolean;
	readonly inUse: boolean;
	readonly properties: StyleProperties;
}

/**
 * Arguments for creating a new custom style.
 */
export interface CreateStyleArgs {
	readonly name: string;
	readonly type: 'paragraph' | 'character';
	readonly basedOn?: string;
	readonly nextStyle?: string;
	readonly properties: StyleProperties;
}

/**
 * Arguments for modifying an existing style's properties.
 */
export interface ModifyStyleArgs {
	readonly styleId: string;
	readonly properties: Partial<StyleProperties>;
}

/**
 * Arguments for renaming a style.
 */
export interface RenameStyleArgs {
	readonly styleId: string;
	readonly newName: string;
}

/**
 * Arguments for deleting a style.
 */
export interface DeleteStyleArgs {
	readonly styleId: string;
}
