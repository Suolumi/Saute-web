import {describe, expect, it} from 'vitest';
import {feedbackLinkLabel, parseFeedbackLink, recipeIdFromPath, relativeTime, similarFeedback, type Feedback} from './feedback';

const ORIGIN = 'http://localhost:5173';
const RECIPE_ID = '0123456789abcdef01234567';

describe('parseFeedbackLink', () => {
    it('accepts a full URL on the same origin and keeps only the path', () => {
        expect(parseFeedbackLink(` ${ORIGIN}/en/recipes/${RECIPE_ID}?x=1#top `, ORIGIN)).toEqual({path: `/en/recipes/${RECIPE_ID}`});
    });

    it('accepts a bare site path', () => {
        expect(parseFeedbackLink('/fr/toolbox', ORIGIN)).toEqual({path: '/fr/toolbox'});
    });

    it('refuses another site', () => {
        expect(parseFeedbackLink('https://youtube.com/watch?v=1', ORIGIN)).toEqual({error: 'external'});
        expect(parseFeedbackLink('//evil.example/en/home', ORIGIN)).toEqual({error: 'invalid'});
        expect(parseFeedbackLink('http://localhost:4173/en/home', ORIGIN)).toEqual({error: 'external'});
    });

    it('refuses what is not a web link', () => {
        expect(parseFeedbackLink('not a link', ORIGIN)).toEqual({error: 'invalid'});
        expect(parseFeedbackLink('javascript:alert(1)', ORIGIN)).toEqual({error: 'invalid'});
    });
});

describe('feedbackLinkLabel', () => {
    const t = (key: string, options?: object) => options ? `${key}:${JSON.stringify(options)}` : key;

    it('names recipe pages after the recipe', () => {
        expect(recipeIdFromPath(`/en/recipes/${RECIPE_ID}/edit`)).toBe(RECIPE_ID);
        expect(feedbackLinkLabel(`/en/recipes/${RECIPE_ID}`, 'Lemon tart', t)).toBe('feedback.link.recipe:{"values":{"title":"Lemon tart"}}');
        expect(feedbackLinkLabel(`/en/recipes/${RECIPE_ID}`, undefined, t)).toBe('feedback.link.recipeUnknown');
    });

    it('names known sections and falls back to the path', () => {
        expect(feedbackLinkLabel('/fi/toolbox', undefined, t)).toBe('header.toolbox');
        expect(feedbackLinkLabel('/en/somewhere/else', undefined, t)).toBe('/en/somewhere/else');
    });
});

describe('similarFeedback', () => {
    const item = (title: string, vote_count = 1) => ({title, vote_count}) as Feedback;

    it('matches on shared significant words, accent-insensitively', () => {
        const items = [item('Timer alarm doesn’t ring'), item('Crème brûlée is wrong'), item('Bigger text')];
        expect(similarFeedback('the TIMER never rings', items).map(i => i.title)).toEqual(['Timer alarm doesn’t ring']);
        expect(similarFeedback('creme', items).map(i => i.title)).toEqual(['Crème brûlée is wrong']);
    });

    it('ignores short words', () => {
        expect(similarFeedback('is it', [item('It is broken')])).toEqual([]);
    });
});

describe('relativeTime', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    it('picks the largest fitting unit', () => {
        expect(relativeTime('2026-10-12T12:00:00Z', 'en', now)).toBe('3 days ago');
        expect(relativeTime('2026-10-14T12:00:00Z', 'en', now)).toBe('yesterday');
        expect(relativeTime('2026-10-15T11:59:50Z', 'en', now)).toBe('now');
    });
});
