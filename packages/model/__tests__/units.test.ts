import { describe, it, expect } from 'vitest';
import {
	twipsToPx,
	pxToTwips,
	twipsToPt,
	ptToTwips,
	emuToPx,
	pxToEmu,
	emuToTwips,
	twipsToEmu,
	halfPointsToPt,
	ptToHalfPoints,
	eighthPointsToPt,
	ptToEighthPoints,
} from '../src';

describe('Unit conversions', () => {
	describe('twips <-> px', () => {
		it('converts at 96 DPI', () => {
			// 1440 twips = 1 inch = 96 px
			expect(twipsToPx(1440)).toBe(96);
			expect(pxToTwips(96)).toBe(1440);
		});

		it('converts 15 twips to 1 px', () => {
			expect(twipsToPx(15)).toBe(1);
			expect(pxToTwips(1)).toBe(15);
		});
	});

	describe('twips <-> pt', () => {
		it('converts correctly', () => {
			expect(twipsToPt(20)).toBe(1);
			expect(ptToTwips(12)).toBe(240);
		});
	});

	describe('EMU <-> px', () => {
		it('converts at 96 DPI', () => {
			// 914400 EMU = 1 inch = 96 px
			expect(emuToPx(914400)).toBe(96);
			expect(pxToEmu(96)).toBe(914400);
		});
	});

	describe('EMU <-> twips', () => {
		it('converts correctly', () => {
			expect(emuToTwips(635)).toBe(1);
			expect(twipsToEmu(1)).toBe(635);
		});
	});

	describe('half-points <-> pt', () => {
		it('converts correctly', () => {
			expect(halfPointsToPt(24)).toBe(12);
			expect(ptToHalfPoints(11)).toBe(22);
		});
	});

	describe('eighth-points <-> pt', () => {
		it('converts correctly', () => {
			expect(eighthPointsToPt(8)).toBe(1);
			expect(ptToEighthPoints(1)).toBe(8);
		});
	});
});
