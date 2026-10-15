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
        recipe: {quantity: number, ingredients: Ingredient[]}
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
            expect(computeRecipeNutrition(tc.recipe.ingredients, tc.recipe.quantity, tc.servings, fixtures.data)).toEqual(tc.expected);
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
        units: [], toolbox_ingredients: [], unit_aliases: [], foods: [],
        links: [{id: 'a', name: 'Flour', nutrition_id: 'f1'}],
    };

    it('replaces a link with the same id', () => {
        expect(withLink(data, {id: 'a', name: 'Flour', nutrition_id: 'f2'}).links).toEqual([{id: 'a', name: 'Flour', nutrition_id: 'f2'}]);
    });

    it('appends a new link', () => {
        expect(withLink(data, {id: 'b', name: 'Milk', nutrition_id: 'f3'}).links).toHaveLength(2);
    });
});
