import {describe, expect, it} from 'vitest';
import {formatRemaining, isPaused, remainingMs, type ActiveTimer} from './recipeTimers';

function timer(overrides: Partial<ActiveTimer> = {}): ActiveTimer {
    return {
        id: 't1',
        recipeId: null,
        stepIndex: null,
        label: 'Timer 1',
        recipeTitle: null,
        durationMs: 5 * 60_000,
        endsAt: Date.now() + 5 * 60_000,
        remainingMs: null,
        ringing: false,
        ...overrides,
    };
}

describe('isPaused', () => {
    it('is false for a running timer', () => {
        expect(isPaused(timer({endsAt: Date.now() + 1000, remainingMs: null}))).toBe(false);
    });

    it('is true once remainingMs is frozen', () => {
        expect(isPaused(timer({endsAt: null, remainingMs: 30_000}))).toBe(true);
    });
});

describe('remainingMs', () => {
    it('computes from endsAt while running, never drifting off a stored duration', () => {
        const now = 1_000_000;
        expect(remainingMs(timer({endsAt: now + 42_000, remainingMs: null}), now)).toBe(42_000);
    });

    it('clamps a running timer past its end to zero rather than going negative', () => {
        const now = 1_000_000;
        expect(remainingMs(timer({endsAt: now - 5_000, remainingMs: null}), now)).toBe(0);
    });

    it('returns the frozen value while paused, ignoring how much time has passed', () => {
        const now = 1_000_000;
        expect(remainingMs(timer({endsAt: null, remainingMs: 12_345}), now)).toBe(12_345);
    });
});

describe('formatRemaining', () => {
    it('formats as m:ss, zero-padding seconds', () => {
        expect(formatRemaining(65_000)).toBe('1:05');
    });

    it('rounds up to the next second rather than truncating', () => {
        expect(formatRemaining(1)).toBe('0:01');
    });

    it('floors at 0:00 for zero or negative input', () => {
        expect(formatRemaining(0)).toBe('0:00');
        expect(formatRemaining(-500)).toBe('0:00');
    });
});
