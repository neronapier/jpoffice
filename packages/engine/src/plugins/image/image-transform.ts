import type { JPImageCrop } from '@jpoffice/model';

/**
 * Calculate dimensions that maintain the original aspect ratio.
 * Given a desired width and height, adjusts whichever dimension
 * exceeds the aspect ratio constraint.
 *
 * @param width - Desired width (EMU)
 * @param height - Desired height (EMU)
 * @param originalWidth - Original image width (EMU)
 * @param originalHeight - Original image height (EMU)
 * @returns Dimensions constrained to the original aspect ratio
 */
export function constrainToAspectRatio(
	width: number,
	height: number,
	originalWidth: number,
	originalHeight: number,
): { width: number; height: number } {
	if (originalWidth <= 0 || originalHeight <= 0) {
		return { width, height };
	}

	const aspectRatio = originalWidth / originalHeight;
	const newAspectRatio = width / height;

	if (newAspectRatio > aspectRatio) {
		// Width is too large relative to height, constrain width
		return { width: Math.round(height * aspectRatio), height };
	}
	// Height is too large relative to width, constrain height
	return { width, height: Math.round(width / aspectRatio) };
}

/**
 * Calculate the visible region after applying a crop.
 * The crop specifies percentages (0-1) to remove from each edge.
 *
 * @param width - Full image width (EMU)
 * @param height - Full image height (EMU)
 * @param crop - Crop percentages from each edge
 * @returns Visible dimensions and the offset from top-left
 */
export function getCroppedDimensions(
	width: number,
	height: number,
	crop: JPImageCrop,
): { visibleWidth: number; visibleHeight: number; offsetX: number; offsetY: number } {
	const offsetX = width * crop.left;
	const offsetY = height * crop.top;
	const visibleWidth = width * (1 - crop.left - crop.right);
	const visibleHeight = height * (1 - crop.top - crop.bottom);

	return {
		visibleWidth: Math.max(0, visibleWidth),
		visibleHeight: Math.max(0, visibleHeight),
		offsetX,
		offsetY,
	};
}

/**
 * Convert rotation in degrees to radians.
 *
 * @param degrees - Rotation angle in degrees
 * @returns Rotation angle in radians
 */
export function degreesToRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Normalize a rotation angle to the range [0, 360).
 *
 * @param degrees - Rotation angle in degrees (may be negative or > 360)
 * @returns Normalized angle in [0, 360)
 */
export function normalizeRotation(degrees: number): number {
	const normalized = degrees % 360;
	return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Validate that crop values are within the valid range [0, 1]
 * and that opposing edges don't exceed 1 combined.
 *
 * @param crop - Crop percentages to validate
 * @returns true if the crop is valid
 */
export function isValidCrop(crop: JPImageCrop): boolean {
	const { top, right, bottom, left } = crop;
	if (
		top < 0 ||
		top > 1 ||
		right < 0 ||
		right > 1 ||
		bottom < 0 ||
		bottom > 1 ||
		left < 0 ||
		left > 1
	) {
		return false;
	}
	if (top + bottom >= 1 || left + right >= 1) {
		return false;
	}
	return true;
}

/**
 * Clamp crop values to valid ranges.
 * Each edge is clamped to [0, 1) and opposing edges sum to less than 1.
 *
 * @param crop - Crop percentages to clamp
 * @returns Clamped crop values
 */
export function clampCrop(crop: JPImageCrop): JPImageCrop {
	const maxEdge = 0.99;
	let top = Math.max(0, Math.min(maxEdge, crop.top));
	let right = Math.max(0, Math.min(maxEdge, crop.right));
	let bottom = Math.max(0, Math.min(maxEdge, crop.bottom));
	let left = Math.max(0, Math.min(maxEdge, crop.left));

	// Ensure opposing edges don't sum to >= 1
	if (top + bottom >= 1) {
		const scale = 0.99 / (top + bottom);
		top *= scale;
		bottom *= scale;
	}
	if (left + right >= 1) {
		const scale = 0.99 / (left + right);
		left *= scale;
		right *= scale;
	}

	return { top, right, bottom, left };
}
