import {describe, expect, it} from 'vitest';
import {foodToForm, formToRequest, parseAliases} from './adminFoods';
import type {Food} from './foods';

const egg: Food = {
    id: 'egg', names: {en: 'Egg', fr: 'Œuf'}, aliases: {en: ['eggs'], fr: ['oeuf', 'oeufs']}, grams_per_piece: 50,
    substitutes: {en: ['1 tbsp ground flax + 3 tbsp water', 'Mashed banana']},
    kcal_per_100g: 140, protein_g_per_100g: 12.7, carbs_g_per_100g: 0.3, fat_g_per_100g: 9.8, salt_g_per_100g: 0.3, sugar_g_per_100g: 0.3,
};

describe('parseAliases', () => {
    it('splits on commas, trims, drops blanks and case-insensitive repeats', () => {
        expect(parseAliases('a, b,, A , c ')).toEqual(['a', 'b', 'c']);
        expect(parseAliases('  ')).toEqual([]);
    });
});

describe('food form', () => {
    it('round-trips a food', () => {
        expect(formToRequest(foodToForm(egg))).toEqual({
            id: 'egg', names: {en: 'Egg', fr: 'Œuf', fi: '', zh: ''},
            aliases: {en: ['eggs'], fr: ['oeuf', 'oeufs'], fi: [], zh: []},
            substitutes: {en: ['1 tbsp ground flax + 3 tbsp water', 'Mashed banana'], fr: [], fi: [], zh: []},
            grams_per_piece: 50, g_per_100ml: null,
            kcal_per_100g: 140, protein_g_per_100g: 12.7, carbs_g_per_100g: 0.3, fat_g_per_100g: 9.8, salt_g_per_100g: 0.3, sugar_g_per_100g: 0.3,
        });
    });

    it('reads numbers typed into number inputs and blanks', () => {
        const form = {...foodToForm(), id: ' quince ', grams_per_piece: 250 as number | string, kcal_per_100g: '' as number | string};
        const req = formToRequest(form);
        expect(req.id).toBe('quince');
        expect(req.grams_per_piece).toBe(250);
        expect(req.g_per_100ml).toBeNull();
        expect(req.kcal_per_100g).toBe(0);
    });
});
