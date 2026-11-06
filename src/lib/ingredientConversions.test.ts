import {describe, expect, it} from 'vitest';
import {formatConversion, ingredientConversions, type ConversionData} from './ingredientConversions';
import type {ToolboxUnit} from './toolbox';

function unit(symbol: string, kind: 'weight' | 'volume', to_base: number): ToolboxUnit {
    return {id: symbol, name: symbol, symbol, kind, to_base, created_at: ''};
}

const grams = unit('g', 'weight', 1);
const tbsp = unit('tbsp', 'volume', 15);

const data: ConversionData = {
    units: [grams, unit('kg', 'weight', 1000), unit('ml', 'volume', 1), unit('L', 'volume', 1000), unit('cup', 'volume', 240), tbsp, unit('tsp', 'volume', 5)],
    densities: [{name: 'Honey', g_per_100ml: 141}, {name: 'Flour (all-purpose)', g_per_100ml: 53}],
    unit_aliases: [{id: 'a1', alias: 'cuillères à soupe', unit_id: 'tbsp', created_at: ''}],
    links: [],
};

describe('ingredientConversions', () => {
    it('converts a volume with a known density to grams and ml only', () => {
        expect(ingredientConversions(2, 'tbsp', 'honey', data).map(formatConversion)).toEqual(['≈ 42 g', '≈ 30 ml']);
    });

    it('converts a weight to ml and a kitchen unit when the density is known', () => {
        const out = ingredientConversions(200, 'g', 'Flour (all-purpose)', data);
        expect(out.map(c => c.unit.symbol)).toEqual(['ml', 'cup']);
        expect(out[0].amount).toBeCloseTo(377.36, 1);
        expect(out[1].amount).toBeCloseTo(1.572, 2);
    });

    it('keeps a weight without density to weight units', () => {
        expect(ingredientConversions(1, 'kg', 'potatoes', data).map(formatConversion)).toEqual(['≈ 1000 g']);
    });

    it('resolves a unit alias', () => {
        expect(ingredientConversions(2, 'cuillères à soupe', 'Honey', data).map(c => c.unit.symbol)).toEqual(['g', 'ml']);
    });

    it('prefers the nutrition link density', () => {
        const withLink = {...data, links: [{name: 'honey', g_per_100ml: 100}]};
        expect(ingredientConversions(2, 'tbsp', 'Honey', withLink).map(formatConversion)).toEqual(['≈ 30 g', '≈ 30 ml']);
    });

    it('returns nothing without a quantity, without a unit, or for an unknown unit', () => {
        expect(ingredientConversions(0, 'g', 'x', data)).toEqual([]);
        expect(ingredientConversions(3, '', 'eggs', data)).toEqual([]);
        expect(ingredientConversions(1, 'pinch', 'salt', data)).toEqual([]);
    });

    it('falls back to tsp for small volumes', () => {
        expect(ingredientConversions(2, 'ml', 'water', data).map(c => c.unit.symbol)).toEqual(['tsp']);
    });
});

describe('formatConversion', () => {
    it('formats small metric amounts with one decimal', () => {
        expect(formatConversion({amount: 7.46, unit: grams})).toBe('≈ 7.5 g');
        expect(formatConversion({amount: 3, unit: grams})).toBe('≈ 3 g');
    });

    it('formats kitchen units as friendly fractions', () => {
        expect(formatConversion({amount: 0.5, unit: tbsp})).toBe('≈ 1/2 tbsp');
    });
});
