import {describe, expect, it} from 'vitest';
import {requiredNutritionField} from './nutrition';
import type {ToolboxUnit} from './toolbox';

const units: ToolboxUnit[] = [
    {id: 'g', name: 'Gram', symbol: 'g', kind: 'weight', to_base: 1, created_at: ''},
    {id: 'cup', name: 'Cup', symbol: 'cup', kind: 'volume', to_base: 240, created_at: ''},
];

describe('requiredNutritionField', () => {
    it('needs nothing for a weight unit', () => {
        expect(requiredNutritionField('g', units)).toBeNull();
    });

    it('needs a density for a volume unit unless the food has one', () => {
        expect(requiredNutritionField('cup', units)).toBe('density');
        expect(requiredNutritionField('cup', units, {g_per_100ml: 103})).toBeNull();
    });

    it('needs a weight per piece for a count unless the food has one', () => {
        expect(requiredNutritionField('', units, {g_per_100ml: 103})).toBe('grams_per_unit');
        expect(requiredNutritionField('whole', units, {grams_per_piece: 50})).toBeNull();
    });
});
