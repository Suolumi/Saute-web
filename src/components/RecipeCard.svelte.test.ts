import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import {goto} from '$app/navigation';
import RecipeCard from './RecipeCard.svelte';
import type {RecipePreview} from '$lib/recipes';

vi.mock('$app/navigation', () => ({goto: vi.fn()}));
vi.mock('$lib/stores', async () => {
    const {writable} = await import('svelte/store');
    return {user: writable(null), serverUrl: writable('http://api.test')};
});
vi.mock('$lib/api', () => ({
    apiFetchJson: async () => ({response: {ok: true}, data: {items: []}}),
}));

beforeAll(async () => {
    addMessages('en', {
        recipeCard: {familySize: '{count} versions', variationCount: '{count} variations', diyBadge: 'DIY', title: 'Untitled', description: 'No description'},
        recipes: {types: {dish: 'Dish'}},
    });
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

beforeEach(() => vi.mocked(goto).mockClear());

function preview(overrides: Partial<RecipePreview>): RecipePreview {
    return {
        id: 'r1', title: 'Lasagna', description: '', author: {username: 'flo'},
        preparation_time: 10, cooking_time: 30, resting_time: 0, quantity: 4,
        kind: 'dish', category: 'food', pictures: [], tags: [],
        favorite: false, favorite_count: 0, variation_count: 0,
        ...overrides,
    } as RecipePreview;
}

describe('RecipeCard', () => {
    it('shows the family badge when the family has several recipes', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 3, variation_count: 2})});
        await expect.element(screen.getByText('3 versions')).toBeVisible();
    });

    it('shows no badge for a standalone recipe', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 1})});
        await expect.element(screen.getByText('Lasagna')).toBeVisible();
        expect(screen.container.textContent).not.toMatch(/versions|variations/);
    });

    it('opens the recipe directly even when it has variations', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 3, variation_count: 2})});
        await screen.getByText('Lasagna').click();
        expect(goto).toHaveBeenCalledWith('/en/recipes/r1');
    });
});
