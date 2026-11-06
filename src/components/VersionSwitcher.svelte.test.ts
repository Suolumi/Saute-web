import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import VersionSwitcher from './VersionSwitcher.svelte';
import type {RecipePreview} from '$lib/recipes';

beforeAll(async () => {
    addMessages('en', {recipe: {versions: {label: 'Versions', original: 'Original', add: 'Add yours'}}});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

const root = {id: 'r', title: 'Lasagna', author: {username: 'flo'}} as RecipePreview;
const variations = [{id: 'v', title: 'Veggie', author: {username: 'ana'}, variation_of: 'r'} as RecipePreview];

describe('VersionSwitcher', () => {
    it('links each version and marks the current one', async () => {
        const screen = render(VersionSwitcher, {root, variations, currentId: 'v'});
        const original = screen.getByRole('link', {name: 'Original'});
        await expect.element(original).toHaveAttribute('href', '/en/recipes/r');
        await expect.element(original).not.toHaveAttribute('aria-current');
        await expect.element(screen.getByRole('link', {name: 'Veggie · ana'})).toHaveAttribute('aria-current', 'page');
    });

    it('shows Add yours only with onAdd, and calls it', async () => {
        const without = render(VersionSwitcher, {root, variations, currentId: 'r'});
        await expect.element(without.getByRole('link', {name: 'Original'})).toBeVisible();
        expect(without.container.querySelector('button')).toBeNull();
        without.unmount();

        const onAdd = vi.fn();
        const screen = render(VersionSwitcher, {root, variations, currentId: 'r', onAdd});
        (screen.getByRole('button', {name: 'Add yours'}).element() as HTMLElement).click();
        expect(onAdd).toHaveBeenCalledOnce();
    });
});
