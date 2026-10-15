import {describe, expect, it} from 'vitest';
import {formatDuration, formatScaledQuantity, getIngredientName, getReferenceQuantity, normalizeIngredientsForSave, sameRecipeForm, type Ingredient, type RecipeForm} from './recipes';

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

    it('never snaps a small positive amount down to 0', () => {
        expect(formatScaledQuantity(0.02)).toBe('0.02');
        expect(formatScaledQuantity(0.004)).toBe('0.004');
    });
});

describe('getIngredientName', () => {
    const ingredient = (quantity: number, unit = 'cup'): Ingredient => ({name: 'Milk', quantity, unit, label: ''});

    it('formats an authored quantity at ratio 1 like a scaled one', () => {
        expect(getIngredientName(ingredient(1 / 3))).toBe('1/3 cup - Milk');
        expect(getIngredientName(ingredient(0.3333333))).toBe('0.33 cup - Milk');
    });

    it('scales by the ratio', () => {
        expect(getIngredientName(ingredient(1), 0.5)).toBe('1/2 cup - Milk');
    });

    it('drops the quantity when there is none', () => {
        expect(getIngredientName(ingredient(0))).toBe('Milk');
    });
});

describe('getReferenceQuantity', () => {
    it('formats an authored quantity at ratio 1 like a scaled one', () => {
        expect(getReferenceQuantity({name: '', quantity: 0.6666667, unit: '', label: '', recipe_ref: 'x'})).toBe('0.67');
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

describe('normalizeIngredientsForSave', () => {
    it('drops blank rows and trims like the backend', () => {
        const got = normalizeIngredientsForSave([
            {name: ' Flour ', quantity: 200, unit: ' g ', label: ' Dough '},
            {name: '', quantity: 0, unit: '', label: 'Dough'},
            {name: 'Butter', quantity: 50, unit: 'g', label: 'dough'},
            {name: 'ignored', quantity: 1, unit: '', label: '', recipe_ref: 'r1', ref_label: ' Crust '},
        ]);
        expect(got).toEqual([
            {name: 'Flour', quantity: 200, unit: 'g', label: 'Dough', ref_label: ''},
            {name: 'Butter', quantity: 50, unit: 'g', label: 'Dough', ref_label: ''},
            {name: '', quantity: 1, unit: '', label: '', recipe_ref: 'r1', ref_label: 'Crust'},
        ]);
    });
});

describe('sameRecipeForm', () => {
    const form = (title: string, resolved?: string): RecipeForm => ({
        title, description: '', quantity: 4, kind: 'dish', category: 'food',
        preparation_time: 0, cooking_time: 0, resting_time: 0, steps: [], pictures: [],
        ingredients: [{name: '', quantity: 1, unit: '', label: '', recipe_ref: 'r1', resolved_ref_title: resolved}],
    });

    it('ignores server-decorated reference titles', () => {
        expect(sameRecipeForm(form('Tart', 'Crust'), form('Tart', 'Renamed crust'))).toBe(true);
    });

    it('detects a content change', () => {
        expect(sameRecipeForm(form('Tart'), form('Pie'))).toBe(false);
    });
});
