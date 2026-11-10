import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import {goto} from '$app/navigation';
import RecipeCard from './RecipeCard.svelte';
import '../app.css';
import type {RecipePreview} from '$lib/recipes';

vi.mock('$app/navigation', () => ({goto: vi.fn()}));
vi.mock('$lib/stores', async () => {
    const {writable} = await import('svelte/store');
    return {user: writable(null), serverUrl: writable('http://api.test')};
});
const familyItems: Partial<RecipePreview>[] = [];
vi.mock('$lib/api', () => ({
    apiFetchJson: async () => ({response: {ok: true}, data: {items: familyItems}}),
}));

beforeAll(async () => {
    addMessages('en', {
        recipeCard: {familySize: '{count} versions', diyBadge: 'DIY', title: 'Untitled', description: 'No description', noPicture: 'No picture yet'},
        recipes: {types: {dish: 'Dish'}},
        versionPicker: {title: 'Choose a version', description: 'Several versions', createTile: 'Submit your own version', error: 'Error'},
    });
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

beforeEach(() => {
    vi.mocked(goto).mockClear();
    familyItems.length = 0;
});

function preview(overrides: Partial<RecipePreview>): RecipePreview {
    return {
        id: 'r1', title: 'Lasagna', description: '', author: {username: 'flo'},
        preparation_time: 10, cooking_time: 30, resting_time: 0, quantity: 4,
        kind: 'dish', category: 'food', pictures: [], tags: [],
        favorite: false, favorite_count: 0, family_id: 'f1', family_size: 1,
        ...overrides,
    } as RecipePreview;
}

describe('RecipeCard', () => {
    it('shows the family badge when the family has several recipes', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 3})});
        await expect.element(screen.getByText('3 versions')).toBeVisible();
    });

    it('shows no badge for a standalone recipe', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 1})});
        await expect.element(screen.getByText('Lasagna')).toBeVisible();
        expect(screen.container.textContent).not.toMatch(/versions/);
    });

    it('shows a photo-sized placeholder when the recipe has no picture', async () => {
        const screen = render(RecipeCard, {recipe: preview({pictures: []})});
        const placeholder = screen.getByRole('img', {name: 'No picture yet'});
        await expect.element(placeholder).toBeVisible();
        const box = (placeholder.element() as HTMLElement).getBoundingClientRect();
        expect(box.height).toBeCloseTo(box.width * 9 / 16, 0);
    });

    it('opens the recipe directly even when it has variations', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 3})});
        (screen.getByText('Lasagna').element() as HTMLElement).click();
        expect(goto).toHaveBeenCalledWith('/en/recipes/r1');
    });

    it('lists the family versions in a picker when versionPicker is set', async () => {
        familyItems.push(
            preview({id: 'r2', title: 'Spicy lasagna', family_size: 2}),
            preview({id: 'r1', title: 'Lasagna', family_size: 2}),
        );
        const screen = render(RecipeCard, {recipe: preview({family_size: 2}), versionPicker: true});
        (screen.getByText('Lasagna').element() as HTMLElement).click();
        await expect.element(screen.getByText('Choose a version')).toBeVisible();
        expect(goto).not.toHaveBeenCalled();

        (screen.getByText('Spicy lasagna').element() as HTMLElement).click();
        expect(goto).toHaveBeenCalledWith('/en/recipes/r2');
    });

    it('submits a new version from the picker', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 2}), versionPicker: true});
        (screen.getByText('Lasagna').element() as HTMLElement).click();
        const tile = screen.getByText('Submit your own version');
        await expect.element(tile).toBeVisible();
        (tile.element() as HTMLElement).click();
        expect(goto).toHaveBeenCalledWith('/en/create?variation_of=r1');
    });

    it('opens a standalone recipe directly even with versionPicker set', async () => {
        const screen = render(RecipeCard, {recipe: preview({family_size: 1}), versionPicker: true});
        (screen.getByText('Lasagna').element() as HTMLElement).click();
        expect(goto).toHaveBeenCalledWith('/en/recipes/r1');
    });
});
