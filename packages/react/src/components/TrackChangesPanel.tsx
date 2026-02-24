'use client';

/**
 * TrackChangesPanel displays a sidebar listing all tracked revisions
 * in the document. Each revision shows type, author, date, and affected
 * text with accept/reject buttons. Bulk Accept All / Reject All at top.
 */

import type { JPEditor } from '@jpoffice/engine';
import type { CSSProperties } from 'react';
import { useTrackChanges } from '../hooks/useTrackChanges';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const panelStyle: CSSProperties = {
	position: 'absolute',
	right: 0,
	top: 0,
	bottom: 0,
	width: 300,
	background: '#fff',
	borderLeft: '1px solid #e0e0e0',
	display: 'flex',
	flexDirection: 'column',
	zIndex: 10,
};

const headerStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '12px 16px',
	borderBottom: '1px solid #e0e0e0',
	flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
	fontSize: 14,
	fontWeight: 600,
	color: '#202124',
	margin: 0,
};

const closeBtnStyle: CSSProperties = {
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	fontSize: 18,
	color: '#5f6368',
	padding: '2px 6px',
	borderRadius: 4,
	lineHeight: 1,
};

const toolbarRowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '8px 16px',
	borderBottom: '1px solid #f1f3f4',
	flexShrink: 0,
};

const trackingToggleStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	fontSize: 12,
	color: '#3c4043',
};

const toggleBtnBase: CSSProperties = {
	width: 36,
	height: 20,
	borderRadius: 10,
	border: 'none',
	cursor: 'pointer',
	position: 'relative',
	transition: 'background 0.2s',
	padding: 0,
};

const toggleDotBase: CSSProperties = {
	width: 16,
	height: 16,
	borderRadius: '50%',
	background: '#fff',
	position: 'absolute',
	top: 2,
	transition: 'left 0.2s',
	boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
};

const bulkActionsStyle: CSSProperties = {
	display: 'flex',
	gap: 6,
	padding: '8px 16px',
	borderBottom: '1px solid #f1f3f4',
	flexShrink: 0,
};

const bulkBtnStyle: CSSProperties = {
	flex: 1,
	border: '1px solid #dadce0',
	background: '#fff',
	cursor: 'pointer',
	fontSize: 12,
	color: '#3c4043',
	padding: '6px 8px',
	borderRadius: 4,
	fontWeight: 500,
};

const acceptAllBtnStyle: CSSProperties = {
	...bulkBtnStyle,
	background: '#e6f4ea',
	borderColor: '#ceead6',
	color: '#137333',
};

const rejectAllBtnStyle: CSSProperties = {
	...bulkBtnStyle,
	background: '#fce8e6',
	borderColor: '#f5c6c2',
	color: '#c5221f',
};

const bodyStyle: CSSProperties = {
	flex: 1,
	overflowY: 'auto',
	padding: '4px 0',
};

const revisionCardStyle: CSSProperties = {
	padding: '10px 16px',
	borderBottom: '1px solid #f1f3f4',
};

const revisionHeaderStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	marginBottom: 4,
};

const revisionTypeBadgeStyle: CSSProperties = {
	fontSize: 10,
	padding: '1px 6px',
	borderRadius: 3,
	fontWeight: 600,
	textTransform: 'uppercase',
};

const revisionAuthorStyle: CSSProperties = {
	fontSize: 12,
	fontWeight: 500,
	color: '#202124',
};

const revisionDateStyle: CSSProperties = {
	fontSize: 11,
	color: '#80868b',
	marginBottom: 4,
};

const revisionTextStyle: CSSProperties = {
	fontSize: 13,
	color: '#3c4043',
	lineHeight: 1.4,
	marginBottom: 8,
	padding: '4px 8px',
	borderRadius: 4,
	background: '#f8f9fa',
	wordBreak: 'break-word',
};

const revisionActionsStyle: CSSProperties = {
	display: 'flex',
	gap: 6,
};

const acceptBtnStyle: CSSProperties = {
	border: '1px solid #ceead6',
	background: '#e6f4ea',
	cursor: 'pointer',
	fontSize: 11,
	color: '#137333',
	padding: '4px 10px',
	borderRadius: 4,
	fontWeight: 500,
};

const rejectBtnStyle: CSSProperties = {
	border: '1px solid #f5c6c2',
	background: '#fce8e6',
	cursor: 'pointer',
	fontSize: 11,
	color: '#c5221f',
	padding: '4px 10px',
	borderRadius: 4,
	fontWeight: 500,
};

const emptyStyle: CSSProperties = {
	padding: '24px 16px',
	textAlign: 'center',
	color: '#80868b',
	fontSize: 13,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTypeBadgeColor(type: string): { bg: string; color: string } {
	switch (type) {
		case 'insertion':
			return { bg: '#e6f4ea', color: '#137333' };
		case 'deletion':
			return { bg: '#fce8e6', color: '#c5221f' };
		case 'formatChange':
			return { bg: '#e8f0fe', color: '#1967d2' };
		default:
			return { bg: '#f1f3f4', color: '#5f6368' };
	}
}

function formatTypeLabel(type: string): string {
	switch (type) {
		case 'insertion':
			return 'Insert';
		case 'deletion':
			return 'Delete';
		case 'formatChange':
			return 'Format';
		default:
			return type;
	}
}

function formatDate(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return iso;
	}
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TrackChangesPanelProps {
	editor: JPEditor;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TrackChangesPanel({ editor, onClose }: TrackChangesPanelProps) {
	const {
		revisions,
		isTracking,
		toggleTracking,
		acceptRevision,
		rejectRevision,
		acceptAll,
		rejectAll,
	} = useTrackChanges(editor);

	return (
		<div style={panelStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<h3 style={headerTitleStyle}>Track Changes</h3>
				<button type="button" style={closeBtnStyle} onClick={onClose} title="Close">
					&times;
				</button>
			</div>

			{/* Tracking toggle */}
			<div style={toolbarRowStyle}>
				<div style={trackingToggleStyle}>
					<button
						type="button"
						style={{
							...toggleBtnBase,
							background: isTracking ? '#1a73e8' : '#dadce0',
						}}
						onClick={toggleTracking}
						title={isTracking ? 'Disable tracking' : 'Enable tracking'}
					>
						<div
							style={{
								...toggleDotBase,
								left: isTracking ? 18 : 2,
							}}
						/>
					</button>
					<span>{isTracking ? 'Tracking ON' : 'Tracking OFF'}</span>
				</div>
				<span style={{ fontSize: 11, color: '#80868b' }}>{revisions.length} changes</span>
			</div>

			{/* Bulk actions */}
			{revisions.length > 0 && (
				<div style={bulkActionsStyle}>
					<button type="button" style={acceptAllBtnStyle} onClick={acceptAll}>
						Accept All
					</button>
					<button type="button" style={rejectAllBtnStyle} onClick={rejectAll}>
						Reject All
					</button>
				</div>
			)}

			{/* Body */}
			<div style={bodyStyle}>
				{revisions.length === 0 ? (
					<div style={emptyStyle}>No tracked changes.</div>
				) : (
					revisions.map((rev) => {
						const badge = getTypeBadgeColor(rev.type);
						return (
							<div key={rev.revisionId} style={revisionCardStyle}>
								<div style={revisionHeaderStyle}>
									<span
										style={{
											...revisionTypeBadgeStyle,
											background: badge.bg,
											color: badge.color,
										}}
									>
										{formatTypeLabel(rev.type)}
									</span>
									<span
										style={{
											...revisionAuthorStyle,
											color: rev.color,
										}}
									>
										{rev.author}
									</span>
								</div>
								<div style={revisionDateStyle}>{formatDate(rev.date)}</div>
								{rev.text && (
									<div
										style={{
											...revisionTextStyle,
											textDecoration: rev.type === 'deletion' ? 'line-through' : undefined,
										}}
									>
										{rev.text || '(empty)'}
									</div>
								)}
								<div style={revisionActionsStyle}>
									<button
										type="button"
										style={acceptBtnStyle}
										onClick={() => acceptRevision(rev.revisionId)}
									>
										Accept
									</button>
									<button
										type="button"
										style={rejectBtnStyle}
										onClick={() => rejectRevision(rev.revisionId)}
									>
										Reject
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
