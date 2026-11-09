import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import RecipeRefIngredient from './RecipeRefIngredient.svelte';
import type {Ingredient} from '$lib/recipes';

const {recipe} = vi.hoisted(() => ({
    recipe: (id: string, title: string, username: string, family_size = 3) => ({
        id, title, family_id: 'F', family_size, quantity: 1, ingredients: [], author: {username},
    }),
}));

// The real module needs $env/dynamic/public, which the browser project can't load.
vi.mock('$lib/recipes', () => ({
    getIngredientName: () => '',
    getReferenceQuantity: () => '',
    groupIngredients: () => [],
    getRecipe: vi.fn(async (id: string) => ({response: {ok: true}, data: recipe(id, id === 'b' ? 'Veggie' : 'Other', 'ana')})),
    getFamily: vi.fn(async () => ({
        response: {ok: true},
        data: {items: [recipe('c', 'Cheesy', 'cat'), recipe('b', 'Veggie', 'ana'), recipe('a', 'Lasagna', 'flo')]},
    })),
}));

beforeAll(async () => {
    addMessages('en', {recipe: {referenceExpand: 'Expand', referenceCollapse: 'Collapse'}, recipeCard: {by: 'by'}});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

describe('RecipeRefIngredient', () => {
    it('selects the referenced version among its family, in API order', async () => {
        const ingredient = {name: 'sauce', recipe_ref: 'b', resolved_ref_title: 'Veggie'} as Ingredient;
        const screen = render(RecipeRefIngredient, {ingredient});
        (screen.getByRole('button', {name: 'Expand'}).element() as HTMLElement).click();
        await expect.element(screen.getByRole('button', {name: /Lasagna/})).toBeVisible();
        const chips = Array.from(screen.container.querySelectorAll('button.rounded-full'));
        expect(chips.map(c => c.querySelector('span')?.textContent)).toEqual(['Cheesy', 'Veggie', 'Lasagna']);
        expect(chips.map(c => c.className.includes('bg-primary'))).toEqual([false, true, false]);
        expect(screen.container.querySelector('a')?.textContent).toBe('Veggie');
    });
});
