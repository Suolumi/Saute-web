import {describe, expect, it} from 'vitest';
import {foodMatcher, foodName, type Food} from './foods';

function food(id: string, names: Record<string, string>, aliases: Record<string, string[]> = {}, extra: Partial<Food> = {}): Food {
    return {
        id, names, aliases, kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0,
        fat_g_per_100g: 0, salt_g_per_100g: 0, sugar_g_per_100g: 0, ...extra,
    };
}

const foods = [
    food('egg', {en: 'Egg', fr: 'Œuf'}, {en: ['eggs'], fr: ['oeuf', 'oeufs']}, {grams_per_piece: 50}),
    food('bread', {en: 'Bread', fr: 'Pain'}),
];

describe('foodMatcher', () => {
    it('matches a name or alias in the locale, trimmed and case-insensitive', () => {
        expect(foodMatcher(foods, [], 'fr').match('oeufs')?.food.id).toBe('egg');
        expect(foodMatcher(foods, [], 'fr').match(' Œuf ')?.food.id).toBe('egg');
        expect(foodMatcher(foods, [], 'en').match('Eggs')?.food.id).toBe('egg');
        expect(foodMatcher(foods, [], 'en-GB').match('bread')?.food.id).toBe('bread');
    });

    it('ignores names from other locales', () => {
        expect(foodMatcher(foods, [], 'fr').match('eggs')).toBeNull();
    });

    it('searches every locale for a blank or unsupported locale', () => {
        expect(foodMatcher(foods, [], '').match('pain')?.food.id).toBe('bread');
        expect(foodMatcher(foods, [], 'de').match('pain')?.food.id).toBe('bread');
    });

    it('prefers the link and its overrides over the food defaults', () => {
        const links = [{name: 'Big egg', food_id: 'egg', grams_per_unit: 100}];
        expect(foodMatcher(foods, links, 'en').match('big egg')).toEqual({food: foods[0], g_per_100ml: null, grams_per_piece: 100});
        expect(foodMatcher(foods, [], 'en').match('egg')).toEqual({food: foods[0], g_per_100ml: null, grams_per_piece: 50});
    });

    it('leaves a link to an unknown food unmatched', () => {
        expect(foodMatcher(foods, [{name: 'Egg', food_id: 'gone'}], 'en').match('egg')).toBeNull();
    });
});

describe('foodName', () => {
    it('uses the locale, then English, then the id', () => {
        expect(foodName(foods[0], 'fr')).toBe('Œuf');
        expect(foodName(foods[0], 'fi')).toBe('Egg');
        expect(foodName(food('x', {}), 'fr')).toBe('x');
    });
});
