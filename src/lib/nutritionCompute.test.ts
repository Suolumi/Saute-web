import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {computeRecipeNutrition, withLink, type NutritionReferenceData} from './nutritionCompute';
import type {Ingredient} from './recipes';
import type {RecipeNutrition} from './nutrition';

type FixtureFile = {
    data: NutritionReferenceData
    cases: {
        name: string
        recipe: {quantity: number, source_locale?: string, ingredients: Ingredient[]}
        servings: number
        expected: RecipeNutrition
    }[]
}

const fixturePath = fileURLToPath(new URL('./testdata/nutrition_cases.json', import.meta.url));
const raw = readFileSync(fixturePath);
const fixtures: FixtureFile = JSON.parse(raw.toString('utf8'));

describe('computeRecipeNutrition (shared fixtures with Saute-api)', () => {
    for (const tc of fixtures.cases) {
        it(tc.name, () => {
            expect(computeRecipeNutrition(tc.recipe.ingredients, tc.recipe.quantity, tc.servings, fixtures.data, tc.recipe.source_locale)).toEqual(tc.expected);
        });
    }
});

describe('nutrition fixture copy', () => {
    it('matches the hash recorded by scripts/sync-nutrition-fixtures.mjs', () => {
        const recorded = readFileSync(`${fixturePath}.sha256`, 'utf8').trim();
        expect(createHash('sha256').update(raw).digest('hex')).toBe(recorded);
    });

    const sibling = fileURLToPath(new URL('../../../Saute-api/internal/recipe_service/testdata/nutrition_cases.json', import.meta.url));
    it.skipIf(!existsSync(sibling))('is in sync with the sibling Saute-api checkout', () => {
        expect(raw.equals(readFileSync(sibling))).toBe(true);
    });
});

describe('withLink', () => {
    const data: NutritionReferenceData = {
        units: [], unit_aliases: [], foods: [],
        links: [{id: 'a', name: 'Flour', food_id: 'flour'}],
    };

    it('replaces a link with the same id', () => {
        expect(withLink(data, {id: 'a', name: 'Flour', food_id: 'spelt-flour'}).links).toEqual([{id: 'a', name: 'Flour', food_id: 'spelt-flour'}]);
    });

    it('appends a new link', () => {
        expect(withLink(data, {id: 'b', name: 'Milk', food_id: 'milk'}).links).toHaveLength(2);
    });
});

describe('food matching by locale', () => {
    const data: NutritionReferenceData = {
        units: [{id: 'ml', name: 'Milliliter', symbol: 'ml', kind: 'volume', to_base: 1}],
        unit_aliases: [],
        links: [],
        foods: [{
            id: 'milk', names: {en: 'Milk', zh: '牛奶'}, aliases: {}, g_per_100ml: 103,
            kcal_per_100g: 100, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0, salt_g_per_100g: 0, sugar_g_per_100g: 0,
        }],
    };
    const ingredient = (name: string) => ({name, quantity: 100, unit: 'ml'}) as Ingredient;

    it('matches a food by its name in the recipe locale, with its density', () => {
        expect(computeRecipeNutrition([ingredient('牛奶')], 1, 1, data, 'zh').kcal).toBe(103);
    });

    it('does not match a name from another locale', () => {
        expect(computeRecipeNutrition([ingredient('牛奶')], 1, 1, data, 'en').matched_count).toBe(0);
    });
});
