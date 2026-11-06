import {describe, expect, it} from 'vitest';
import {tagIcon} from './tagIcons';
import {Tag} from '@lucide/svelte';

// The API's defaultTagIcons gives each of these tags the icon named after it.
const originalTags = [
    'gluten-free-option', 'high-protein', 'pescatarian', 'vegan', 'vegetarian', 'batch-cooking', 'budget-friendly',
    'freezer-friendly', 'leftovers', 'make-ahead', 'microwave', 'no-cook', 'no-oven', 'one-pot', 'slow-cooking',
];

describe('tagIcon', () => {
    it('has a distinct drawn icon for each original tag', () => {
        const icons = originalTags.map(tagIcon);
        expect(icons).not.toContain(Tag);
        expect(new Set(icons).size).toBe(originalTags.length);
    });

    it('falls back to the plain tag icon', () => {
        expect(tagIcon('nope')).toBe(Tag);
        expect(tagIcon(undefined)).toBe(Tag);
    });
});
