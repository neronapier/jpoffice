/**
 * Unit conversion utilities for JPOffice.
 *
 * OOXML uses twips (1/20 of a point) for most dimensions and
 * EMU (English Metric Units, 914400 per inch) for drawings.
 * We use these as internal units to avoid floating-point rounding
 * during DOCX import/export. Conversion to px happens only at render time.
 *
 * Reference:
 *   1 inch = 72 pt = 1440 twips = 914400 EMU = 96 px (at 96 DPI)
 *   1 pt = 20 twips = 12700 EMU
 *   1 twip = 635 EMU
 *   1 half-point = 10 twips (used for font sizes in OOXML w:sz)
 */

// -- Twips conversions --

export function twipsToPx(twips: number, dpi = 96): number {
	return (twips * dpi) / 1440;
}

export function pxToTwips(px: number, dpi = 96): number {
	return (px * 1440) / dpi;
}

export function twipsToPt(twips: number): number {
	return twips / 20;
}

export function ptToTwips(pt: number): number {
	return pt * 20;
}

export function twipsToInches(twips: number): number {
	return twips / 1440;
}

export function inchesToTwips(inches: number): number {
	return inches * 1440;
}

export function twipsToCm(twips: number): number {
	return twips / 567;
}

export function cmToTwips(cm: number): number {
	return cm * 567;
}

export function twipsToEmu(twips: number): number {
	return twips * 635;
}

export function emuToTwips(emu: number): number {
	return emu / 635;
}

// -- EMU conversions --

export function emuToPx(emu: number, dpi = 96): number {
	return (emu * dpi) / 914400;
}

export function pxToEmu(px: number, dpi = 96): number {
	return (px * 914400) / dpi;
}

export function emuToPt(emu: number): number {
	return emu / 12700;
}

export function ptToEmu(pt: number): number {
	return pt * 12700;
}

export function emuToInches(emu: number): number {
	return emu / 914400;
}

export function inchesToEmu(inches: number): number {
	return inches * 914400;
}

export function emuToCm(emu: number): number {
	return emu / 360000;
}

export function cmToEmu(cm: number): number {
	return cm * 360000;
}

// -- Half-point conversions (OOXML font sizes: w:sz) --

export function halfPointsToPt(halfPts: number): number {
	return halfPts / 2;
}

export function ptToHalfPoints(pt: number): number {
	return pt * 2;
}

export function halfPointsToPx(halfPts: number, dpi = 96): number {
	return (halfPts * dpi) / 144;
}

// -- Eighths of a point (OOXML border widths: w:sz on borders) --

export function eighthPointsToPt(eighths: number): number {
	return eighths / 8;
}

export function ptToEighthPoints(pt: number): number {
	return pt * 8;
}
