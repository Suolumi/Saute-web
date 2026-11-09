import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import VersionSwitcher from './VersionSwitcher.svelte';
import type {RecipePreview} from '$lib/recipes';

beforeAll(async () => {
    addMessages('en', {recipe: {versions: {label: 'Versions', add: 'Add yours'}}});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

const version = (id: string, title: string, username: string) => ({id, title, author: {username}} as RecipePreview);
// Newest first, as the API returns them.
const versions = [version('c', 'Cheesy', 'cat'), version('b', 'Veggie', 'ana'), version('a', 'Lasagna', 'flo')];

describe('VersionSwitcher', () => {
    it('renders every version as title and author in the given order, with no original', async () => {
        const screen = render(VersionSwitcher, {versions, currentId: 'b'});
        const links = Array.from(screen.container.querySelectorAll('a')).map(a => a.textContent?.trim());
        expect(links).toEqual(['Cheesy · cat', 'Veggie · ana', 'Lasagna · flo']);
        expect(screen.container.textContent).not.toContain('Original');
        await expect.element(screen.getByRole('link', {name: 'Veggie · ana'})).toHaveAttribute('aria-current', 'page');
        await expect.element(screen.getByRole('link', {name: 'Lasagna · flo'})).not.toHaveAttribute('aria-current');
        await expect.element(screen.getByRole('link', {name: 'Lasagna · flo'})).toHaveAttribute('href', '/en/recipes/a');
    });

    it('shows Add yours only with onAdd, and calls it', async () => {
        const without = render(VersionSwitcher, {versions, currentId: 'a'});
        await expect.element(without.getByRole('link', {name: 'Lasagna · flo'})).toBeVisible();
        expect(without.container.querySelector('button')).toBeNull();
        without.unmount();

        const onAdd = vi.fn();
        const screen = render(VersionSwitcher, {versions, currentId: 'a', onAdd});
        (screen.getByRole('button', {name: 'Add yours'}).element() as HTMLElement).click();
        expect(onAdd).toHaveBeenCalledOnce();
    });
});
