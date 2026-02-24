import type { Room } from './room';

/**
 * Colors assigned to collaborators for cursor/selection display.
 */
const COLLABORATOR_COLORS = [
	'#4285F4',
	'#EA4335',
	'#FBBC04',
	'#34A853',
	'#FF6D01',
	'#46BDC6',
	'#7B61FF',
	'#E91E63',
];

let colorIndex = 0;

/**
 * Get the next collaborator color from the rotation.
 */
export function nextCollaboratorColor(): string {
	const color = COLLABORATOR_COLORS[colorIndex % COLLABORATOR_COLORS.length];
	colorIndex++;
	return color;
}

/**
 * Process an awareness update message from a client.
 */
export function handleAwarenessUpdate(
	room: Room,
	clientId: string,
	data: {
		selection?: { anchor: number[]; focus: number[] };
		cursor?: { path: number[]; offset: number };
	},
): void {
	room.updateAwareness(clientId, {
		clientId,
		selection: data.selection,
		cursor: data.cursor,
	});
}
