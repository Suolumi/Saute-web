import {describe, expect, it} from 'vitest';
import {defaultRecipeListFilters, knownTags, restoreRecipeListFilters} from './recipeListFilters';

describe('restoreRecipeListFilters', () => {
    it('returns the defaults for nothing saved', () => {
        expect(restoreRecipeListFilters(undefined)).toEqual(defaultRecipeListFilters);
        expect(restoreRecipeListFilters('')).toEqual(defaultRecipeListFilters);
    });

    it('keeps valid saved fields and fills missing ones', () => {
        expect(restoreRecipeListFilters({author: 'flo', tags: ['vegan'], popular: true})).toEqual({
            ...defaultRecipeListFilters, author: 'flo', tags: ['vegan'], popular: true,
        });
    });

    it('replaces invalid fields with their default', () => {
        expect(restoreRecipeListFilters({
            selectedType: 'pizza', author: 3, ingredients: null, tags: [1],
            timeBasis: 'cook', timeTarget: '90', popular: 'yes',
        })).toEqual(defaultRecipeListFilters);
    });

    it('keeps a valid kind and time preset', () => {
        const restored = restoreRecipeListFilters({selectedType: 'dessert', timeBasis: 'prep', timeTarget: 'quick'});
        expect(restored).toMatchObject({selectedType: 'dessert', timeBasis: 'prep', timeTarget: 'quick'});
    });

    it('never shares the default arrays', () => {
        restoreRecipeListFilters({}).tags.push('vegan');
        expect(defaultRecipeListFilters.tags).toEqual([]);
    });
});

describe('knownTags', () => {
    it('drops slugs that no longer exist', () => {
        expect(knownTags(['vegan', 'gone'], new Map([['vegan', {}]]))).toEqual(['vegan']);
    });

    it('keeps everything while the tags are not loaded', () => {
        expect(knownTags(['vegan', 'gone'], new Map())).toEqual(['vegan', 'gone']);
    });
});
