/**
 * Server-side OT using the real transformation functions from @jpoffice/engine.
 *
 * Re-exports the OT functions needed by room.ts for transforming
 * concurrent operations from different clients.
 */
export {
	transformOperation,
	transformOperationAgainstMany,
	transformManyAgainstOperation,
} from '@jpoffice/engine';
