import {describe, expect, it} from 'vitest';
import {badgeTags, groupTags, impliedBy, tagClosure, tagLabel, toggleTag, type RecipeTag, type TagMap} from './tags';

function tag(slug: string, overrides: Partial<RecipeTag> = {}): RecipeTag {
    return {slug, group: 'diet', categories: ['food'], implies: [], labels: {en: slug}, source_locale: 'en', ...overrides};
}

const all: TagMap = new Map([
    tag('vegan', {implies: ['vegetarian'], labels: {en: 'Vegan', fr: 'Végan'}}),
    tag('vegetarian', {implies: ['pescatarian'], labels: {en: 'Vegetarian', fr: 'Végétarien'}}),
    tag('pescatarian', {labels: {en: 'Pescatarian'}}),
    tag('gluten-free', {labels: {en: 'Gluten-free', fr: 'Sans gluten'}}),
    tag('one-pot', {group: 'practical', categories: ['food', 'diy'], labels: {en: 'One-pot'}}),
].map(t => [t.slug, t]));

describe('tagLabel', () => {
    it('falls back from locale to base language to source label', () => {
        expect(tagLabel(all.get('vegan')!, 'fr')).toBe('Végan');
        expect(tagLabel(all.get('vegan')!, 'fr-CA')).toBe('Végan');
        expect(tagLabel(all.get('pescatarian')!, 'fi')).toBe('Pescatarian');
        expect(tagLabel(tag('x', {labels: {}}), 'en')).toBe('x');
    });
});

describe('implications', () => {
    it('expands transitively', () => {
        expect([...tagClosure(['vegan'], all)].sort()).toEqual(['pescatarian', 'vegan', 'vegetarian']);
    });

    it('reports tags implied by another selected tag', () => {
        expect([...impliedBy(['vegan', 'vegetarian', 'pescatarian'], all)].sort()).toEqual(['pescatarian', 'vegetarian']);
    });
});

describe('toggleTag', () => {
    it('ticks a tag with everything it implies', () => {
        expect(toggleTag([], 'vegan', all)).toEqual(['pescatarian', 'vegan', 'vegetarian']);
    });

    it('keeps an implied tag locked while its implying tag is ticked', () => {
        const selected = ['pescatarian', 'vegan', 'vegetarian'];
        expect(toggleTag(selected, 'vegetarian', all)).toBe(selected);
    });

    it('unticks only the tag itself', () => {
        expect(toggleTag(['pescatarian', 'vegan', 'vegetarian'], 'vegan', all)).toEqual(['pescatarian', 'vegetarian']);
    });
});

describe('badgeTags', () => {
    it('hides implied tags and orders by group then label', () => {
        const slugs = ['one-pot', 'vegetarian', 'pescatarian', 'gluten-free', 'unknown'];
        expect(badgeTags(slugs, all, 'en').map(t => t.slug)).toEqual(['gluten-free', 'vegetarian', 'one-pot']);
    });

    it('treats null as no tags', () => {
        expect(badgeTags(null, all, 'en')).toEqual([]);
    });
});

describe('groupTags', () => {
    it('groups in display order and skips empty groups', () => {
        const groups = groupTags([all.get('one-pot')!, all.get('vegan')!], 'en');
        expect(groups.map(g => g.group)).toEqual(['diet', 'practical']);
        expect(groupTags([all.get('vegan')!], 'en').map(g => g.group)).toEqual(['diet']);
    });
});
