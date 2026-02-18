import { describe, it, expect } from 'vitest';
import { ContentStreamBuilder } from '../src/content-stream';

describe('ContentStreamBuilder', () => {
	it('builds text operations', () => {
		const stream = new ContentStreamBuilder();
		stream
			.beginText()
			.setFont('/F1', 12)
			.setTextPosition(72, 700)
			.showText('Hello')
			.endText();

		const result = stream.build();
		expect(result).toContain('BT');
		expect(result).toContain('/F1 12 Tf');
		expect(result).toContain('72 700 Td');
		expect(result).toContain('(Hello) Tj');
		expect(result).toContain('ET');
	});

	it('builds color operations', () => {
		const stream = new ContentStreamBuilder();
		stream.setFillColor(1, 0, 0);
		stream.setStrokeColor(0, 0, 1);

		const result = stream.build();
		expect(result).toContain('1 0 0 rg');
		expect(result).toContain('0 0 1 RG');
	});

	it('builds graphics operations', () => {
		const stream = new ContentStreamBuilder();
		stream
			.save()
			.setLineWidth(1.5)
			.moveTo(0, 0)
			.lineTo(100, 100)
			.stroke()
			.restore();

		const result = stream.build();
		expect(result).toContain('q');
		expect(result).toContain('1.5 w');
		expect(result).toContain('0 0 m');
		expect(result).toContain('100 100 l');
		expect(result).toContain('S');
		expect(result).toContain('Q');
	});

	it('builds rectangle and fill operations', () => {
		const stream = new ContentStreamBuilder();
		stream
			.rect(10, 20, 100, 50)
			.fill();

		const result = stream.build();
		expect(result).toContain('10 20 100 50 re');
		expect(result).toContain('f');
	});

	it('builds XObject operations', () => {
		const stream = new ContentStreamBuilder();
		stream.save()
			.setTransform(100, 0, 0, 100, 72, 500)
			.drawXObject('/Im1')
			.restore();

		const result = stream.build();
		expect(result).toContain('100 0 0 100 72 500 cm');
		expect(result).toContain('/Im1 Do');
	});

	it('separates operations with newlines', () => {
		const stream = new ContentStreamBuilder();
		stream.beginText().endText();

		const result = stream.build();
		expect(result).toBe('BT\nET');
	});
});
