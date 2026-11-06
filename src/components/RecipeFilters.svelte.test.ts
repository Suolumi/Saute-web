import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import RecipeFilters from './RecipeFilters.svelte';
import '../app.css';

vi.mock('$lib/stores', async () => {
    const {writable} = await import('svelte/store');
    return {serverUrl: writable('http://api.test')};
});
vi.mock('$lib/api', () => ({
    apiFetchJson: async () => ({response: {ok: true}, data: {items: []}}),
}));

beforeAll(async () => {
    addMessages('en', {home: {mostPopular: 'Most popular', moreFilters: 'More filters', collapseFamilies: 'Group versions'}});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

const props = {searchTerm: '', author: '', ingredients: [], searchPlaceholder: 'Search', ingredientsLabel: 'Ingredients', ingredientsPlaceholder: '', showKind: false};

describe('RecipeFilters', () => {
    it('shows Group versions as a toggle in the top row, beside Most popular', async () => {
        const screen = render(RecipeFilters, {...props, showCollapse: true});
        const toggle = screen.getByRole('button', {name: 'Group versions'});
        await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
        const popular = screen.getByRole('button', {name: 'Most popular'}).element();
        expect(toggle.element().parentElement).toBe(popular.parentElement);

        (toggle.element() as HTMLElement).click();
        await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('hides the toggle unless asked for', async () => {
        const screen = render(RecipeFilters, props);
        await expect.element(screen.getByRole('button', {name: 'Most popular'})).toBeVisible();
        expect(screen.container.textContent).not.toContain('Group versions');
    });
});
