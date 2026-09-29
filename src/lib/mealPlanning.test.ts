import {describe, expect, it} from 'vitest';
import {addDays, effectiveServings, entriesForWeek, findMeal, getWeekDates, getWeekStart, toISODate, type MealPlanEntry} from './mealPlanning';

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        date: '2026-09-28',
        mealType: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Roast Chicken',
        recipeQuantity: 4,
        ...overrides,
    };
}

describe('getWeekStart', () => {
    it('returns the same date when given a Monday', () => {
        expect(toISODate(getWeekStart(new Date(2026, 8, 28)))).toBe('2026-09-28');
    });

    it('returns the prior Monday for a mid-week date', () => {
        expect(toISODate(getWeekStart(new Date(2026, 8, 30)))).toBe('2026-09-28');
    });

    it('returns the prior Monday for a Sunday', () => {
        expect(toISODate(getWeekStart(new Date(2026, 9, 4)))).toBe('2026-09-28');
    });
});

describe('getWeekDates', () => {
    it('lists 7 consecutive ISO dates starting from the week start', () => {
        expect(getWeekDates(new Date(2026, 8, 28))).toEqual([
            '2026-09-28', '2026-09-29', '2026-09-30',
            '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
        ]);
    });
});

describe('addDays', () => {
    it('rolls over month boundaries', () => {
        expect(toISODate(addDays(new Date(2026, 8, 30), 1))).toBe('2026-10-01');
    });
});

describe('entriesForWeek', () => {
    it('keeps only entries whose date falls in the given week', () => {
        const weekDates = getWeekDates(new Date(2026, 8, 28));
        const entries = [
            entry({date: '2026-09-29'}),
            entry({date: '2026-10-05'}),
            entry({date: '2026-10-04'}),
        ];
        expect(entriesForWeek(entries, weekDates).map(e => e.date)).toEqual(['2026-09-29', '2026-10-04']);
    });
});

describe('findMeal', () => {
    it('finds the entry for an exact date+mealType slot', () => {
        const entries = [entry({date: '2026-09-28', mealType: 'lunch'}), entry({date: '2026-09-28', mealType: 'dinner'})];
        expect(findMeal(entries, '2026-09-28', 'dinner')?.mealType).toBe('dinner');
    });

    it('returns undefined for an empty slot', () => {
        const entries = [entry({date: '2026-09-28', mealType: 'lunch'})];
        expect(findMeal(entries, '2026-09-28', 'dinner')).toBeUndefined();
    });
});

describe('effectiveServings', () => {
    it("falls back to the recipe's own base servings when nothing is set", () => {
        expect(effectiveServings(entry({recipeQuantity: 4}), {}, null)).toBe(4);
    });

    it('falls back to the week default over the recipe base', () => {
        expect(effectiveServings(entry({recipeQuantity: 4}), {}, 2)).toBe(2);
    });

    it("falls back to the day's override over the week default", () => {
        expect(effectiveServings(entry({date: '2026-09-28', recipeQuantity: 4}), {'2026-09-28': 3}, 2)).toBe(3);
    });

    it("prefers the meal's own override over the day and week defaults", () => {
        expect(effectiveServings(entry({date: '2026-09-28', recipeQuantity: 4, servings: 6}), {'2026-09-28': 3}, 2)).toBe(6);
    });

    it("only uses a day's override for that exact date", () => {
        expect(effectiveServings(entry({date: '2026-09-29', recipeQuantity: 4}), {'2026-09-28': 3}, 2)).toBe(2);
    });
});
