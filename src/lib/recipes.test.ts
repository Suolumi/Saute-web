import {describe, expect, it} from 'vitest';
import {formatDuration, formatScaledQuantity} from './recipes';

describe('formatScaledQuantity', () => {
    it('rounds a fractional part near 0 down to the whole number', () => {
        expect(formatScaledQuantity(2.01)).toBe('2');
    });

    it('rounds a fractional part near 1 up to the next whole number', () => {
        expect(formatScaledQuantity(2.99)).toBe('3');
    });

    it('shows an exact nice fraction under 1 as a fraction', () => {
        expect(formatScaledQuantity(0.25)).toBe('1/4');
        expect(formatScaledQuantity(1 / 3)).toBe('1/3');
        expect(formatScaledQuantity(0.5)).toBe('1/2');
        expect(formatScaledQuantity(2 / 3)).toBe('2/3');
        expect(formatScaledQuantity(0.75)).toBe('3/4');
    });

    it('shows a non-matching fraction under 1 as a 2-decimal number', () => {
        expect(formatScaledQuantity(0.125)).toBe('0.13');
        expect(formatScaledQuantity(0.375)).toBe('0.38');
        expect(formatScaledQuantity(0.625)).toBe('0.63');
        expect(formatScaledQuantity(0.875)).toBe('0.88');
    });

    it('always shows a decimal once the quantity is 1 or above, even for an exact nice fraction', () => {
        expect(formatScaledQuantity(1.5)).toBe('1.50');
        expect(formatScaledQuantity(1 + 2 / 3)).toBe('1.67');
        expect(formatScaledQuantity(2.25)).toBe('2.25');
    });

    it('rounds an arbitrary decimal to 2 digits', () => {
        expect(formatScaledQuantity(1.126)).toBe('1.13');
    });
});

describe('formatDuration', () => {
    it('shows only minutes under an hour', () => {
        expect(formatDuration(45, 'h', 'min')).toBe('45min');
    });

    it('shows zero minutes as-is', () => {
        expect(formatDuration(0, 'h', 'min')).toBe('0min');
    });

    it('splits into whole hours and a remainder, never a decimal hour count', () => {
        expect(formatDuration(100, 'h', 'min')).toBe('1h 40min');
    });

    it('shows a zero remainder when minutes is an exact multiple of 60', () => {
        expect(formatDuration(120, 'h', 'min')).toBe('2h 0min');
    });
});
