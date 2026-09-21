import {describe, expect, it} from 'vitest';
import {buildRecipeSummaries, buildShoppingListGroups, capitalizeIngredientHeading, entryRatio, type ShoppingListEntry} from './shoppingList';
import type {Ingredient} from './recipes';

function ingredient(overrides: Partial<Ingredient> = {}): Ingredient {
    return {name: 'Flour', quantity: 2, unit: 'cups', label: '', ...overrides};
}

function entry(overrides: Partial<ShoppingListEntry> = {}): ShoppingListEntry {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        recipeId: 'recipe-1',
        recipeTitle: 'Pancakes',
        recipeQuantity: 4,
        servings: 4,
        ingredient: ingredient(),
        checked: false,
        ...overrides,
    };
}

describe('entryRatio', () => {
    it('is 1 when servings matches the recipe base quantity', () => {
        expect(entryRatio(entry({recipeQuantity: 4, servings: 4}))).toBe(1);
    });

    it('scales proportionally when servings differs from the base quantity', () => {
        expect(entryRatio(entry({recipeQuantity: 4, servings: 8}))).toBe(2);
    });

    it('falls back to 1 when the recipe has no base quantity', () => {
        expect(entryRatio(entry({recipeQuantity: 0, servings: 4}))).toBe(1);
    });
});

describe('buildRecipeSummaries', () => {
    it('lists one summary per recipe, in first-added order', () => {
        const entries = [
            entry({recipeId: 'a', recipeTitle: 'Pancakes', ingredient: ingredient({name: 'Flour'})}),
            entry({recipeId: 'b', recipeTitle: 'Waffles', ingredient: ingredient({name: 'Sugar'})}),
            entry({recipeId: 'a', recipeTitle: 'Pancakes', ingredient: ingredient({name: 'Milk'})}),
        ];
        const summaries = buildRecipeSummaries(entries);
        expect(summaries.map(s => s.recipeId)).toEqual(['a', 'b']);
    });

    it('carries the recipe picture from its entries', () => {
        const entries = [entry({recipePicture: 'pancakes.jpg'})];
        const summaries = buildRecipeSummaries(entries);
        expect(summaries[0].recipePicture).toBe('pancakes.jpg');
    });
});

describe('buildShoppingListGroups', () => {
    it('sums exact name+unit matches across recipes into one line', () => {
        const entries = [
            entry({recipeId: 'a', recipeTitle: 'Pancakes', ingredient: ingredient({name: 'Flour', quantity: 2, unit: 'cups'})}),
            entry({recipeId: 'b', recipeTitle: 'Waffles', ingredient: ingredient({name: 'flour', quantity: 1, unit: 'Cups'})}),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups).toHaveLength(1);
        expect(groups[0].subLines).toHaveLength(1);
        expect(groups[0].name).toBe('Flour');
        expect(groups[0].subLines[0].text).toBe('3 cups');
        expect(groups[0].subLines[0].recipes.map(r => r.recipeId).sort()).toEqual(['a', 'b']);
    });

    it('groups same name but different units under one heading without summing', () => {
        const entries = [
            entry({ingredient: ingredient({name: 'Flour', quantity: 2, unit: 'cups'})}),
            entry({ingredient: ingredient({name: 'Flour', quantity: 4, unit: 'dl'})}),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('Flour');
        expect(groups[0].subLines.map(s => s.text).sort()).toEqual(['2 cups', '4 dl']);
    });

    it('never merges reference ingredients, even when names collide (both blank)', () => {
        const entries = [
            entry({
                id: 'e1',
                ingredient: {name: '', quantity: 1, unit: 'batch', label: '', recipe_ref: 'ref-a', resolved_ref_title: 'Tart Dough'},
            }),
            entry({
                id: 'e2',
                ingredient: {name: '', quantity: 1, unit: 'batch', label: '', recipe_ref: 'ref-b', resolved_ref_title: 'Pie Crust'},
            }),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups).toHaveLength(2);
        expect(groups.map(g => g.name).sort()).toEqual(['Pie Crust', 'Tart Dough']);
        expect(groups.every(g => g.subLines[0].isReference)).toBe(true);
    });

    it('scales quantities by each entry servings ratio before summing', () => {
        const entries = [
            entry({recipeId: 'a', recipeQuantity: 4, servings: 8, ingredient: ingredient({name: 'Sugar', quantity: 1, unit: 'cup'})}),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups[0].name).toBe('Sugar');
        expect(groups[0].subLines[0].text).toBe('2 cup');
    });

    it('checks a merged line only when every contributing entry is checked', () => {
        const entries = [
            entry({id: 'e1', recipeId: 'a', checked: true, ingredient: ingredient({name: 'Salt', quantity: 1, unit: 'tsp'})}),
            entry({id: 'e2', recipeId: 'b', checked: false, ingredient: ingredient({name: 'Salt', quantity: 1, unit: 'tsp'})}),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups[0].subLines[0].checked).toBe(false);
        expect(groups[0].subLines[0].entryIds.sort()).toEqual(['e1', 'e2']);
    });

    it('orders groups by when the ingredient was first added', () => {
        const entries = [
            entry({ingredient: ingredient({name: 'Sugar', quantity: 1, unit: 'cup'})}),
            entry({ingredient: ingredient({name: 'Flour', quantity: 1, unit: 'cup'})}),
        ];
        const groups = buildShoppingListGroups(entries);
        expect(groups.map(g => g.name)).toEqual(['Sugar', 'Flour']);
    });

    it('still lists an ingredient with no quantity, without a scaled amount', () => {
        const entries = [entry({ingredient: ingredient({name: 'Salt to taste', quantity: 0, unit: ''})})];
        const groups = buildShoppingListGroups(entries);
        expect(groups[0].name).toBe('Salt to taste');
        expect(groups[0].subLines[0].text).toBe('');
    });
});

describe('capitalizeIngredientHeading', () => {
    it('uppercases only the first letter, regardless of input casing', () => {
        expect(capitalizeIngredientHeading('flour')).toBe('Flour');
        expect(capitalizeIngredientHeading('FLOUR')).toBe('Flour');
        expect(capitalizeIngredientHeading('fLOUR')).toBe('Flour');
        expect(capitalizeIngredientHeading('all-purpose flour')).toBe('All-purpose flour');
    });

    it('leaves an empty name as-is', () => {
        expect(capitalizeIngredientHeading('')).toBe('');
    });
});
