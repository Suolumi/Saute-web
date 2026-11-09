import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {page} from '@vitest/browser/context';
import {addMessages, init} from 'svelte-i18n';
import RecipePickerModal from './RecipePickerModal.svelte';

vi.mock('$lib/stores', async () => {
    const {writable} = await import('svelte/store');
    return {
        user: writable(null), accessToken: writable(''), refreshToken: writable(''),
        serverUrl: writable('http://api.test'), jsonParser: JSON,
    };
});

vi.mock('$lib/recipes', () => {
    const preview = (id: string, title: string, family_size: number) =>
        ({id, title, author: {username: 'flo'}, pictures: [], tags: [], family_id: 'f-' + id, family_size});
    const getRecipes = async (q: {family?: string}) => ({
        response: {ok: true},
        data: {
            length: 0,
            items: q.family
                ? [preview('v2', 'Lasagna v2', 2), preview('v1', 'Lasagna v1', 2)]
                : [preview('v2', 'Lasagna v2', 2), preview('s1', 'Soup', 1), preview('s2', 'Stew', 1)],
        },
    });
    return {getRecipes, getFamily: (family: string) => getRecipes({family})};
});

beforeAll(async () => {
    addMessages('en', {
        recipeCard: {familySize: '{count} versions', by: 'by'},
        edit: {ingredients: {recipePicker: {title: 'Pick', description: 'd', searchPlaceholder: 's', noResults: 'none', error: 'err', cancel: 'Cancel', addSelected: 'Add {count}', chooseVersion: 'v', chooseVariation: 'Choose a version', chooseVariationDescription: 'x', back: 'Back', backToList: 'List', alreadyAdded: 'Already'}}},
    });
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

describe('RecipePickerModal exclusions', () => {
    it('keeps a family whose shown version is excluded, drops excluded standalones, and filters the drill list', async () => {
        render(RecipePickerModal, {open: true, multiSelect: true, excludeRecipeIds: ['v2', 's1'], onClose: () => {}});
        await expect.element(page.getByText('Lasagna v2')).toBeVisible();
        await expect.element(page.getByText('Stew')).toBeVisible();
        expect(document.body.textContent).not.toContain('Soup');
        (page.getByText('Lasagna v2').element() as HTMLElement).click();
        await expect.element(page.getByText('Lasagna v1')).toBeVisible();
        expect(document.body.textContent).not.toContain('Lasagna v2');
    });
});
