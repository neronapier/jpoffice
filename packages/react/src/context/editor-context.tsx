'use client';

import type { JPEditor } from '@jpoffice/engine';
import { createContext } from 'react';

export interface EditorContextValue {
	editor: JPEditor;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
