/**
 * Revision tracking properties for track changes (control de cambios).
 *
 * Each tracked change is represented as revision info attached to a run.
 * - 'insertion': the run was inserted while tracking was on
 * - 'deletion': the run was marked for deletion while tracking was on
 * - 'formatChange': the run's formatting was changed while tracking was on
 */

export type JPRevisionType = 'insertion' | 'deletion' | 'formatChange';

export interface JPRevisionInfo {
	readonly revisionId: string;
	readonly author: string;
	readonly date: string; // ISO 8601
	readonly type: JPRevisionType;
}

/**
 * Track changes configuration stored at document level.
 */
export interface JPTrackChangesConfig {
	readonly enabled: boolean;
	readonly currentAuthor: string;
}
