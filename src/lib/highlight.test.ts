import {describe, expect, it} from 'vitest';
import {highlightSegments, normalizeForMatch} from './highlight';

describe('normalizeForMatch', () => {
    it('lowercases', () => {
        expect(normalizeForMatch('Flour')).toBe('flour');
    });

    it('strips accents', () => {
        expect(normalizeForMatch('crème')).toBe('creme');
    });

    it('folds œ and æ ligatures to oe/ae', () => {
        expect(normalizeForMatch('Bœuf')).toBe('boeuf');
        expect(normalizeForMatch('Œuf')).toBe('oeuf');
    });
});

describe('highlightSegments', () => {
    it('returns one unmatched segment for an empty query', () => {
        expect(highlightSegments('Flan', '')).toEqual([{text: 'Flan', match: false}]);
    });

    it('splits around every case-insensitive occurrence', () => {
        expect(highlightSegments('banana', 'a')).toEqual([
            {text: 'b', match: false},
            {text: 'a', match: true},
            {text: 'n', match: false},
            {text: 'a', match: true},
            {text: 'n', match: false},
            {text: 'a', match: true},
        ]);
    });

    it('matches a plain-letter query against a ligature in the original text', () => {
        expect(highlightSegments('Bœuf', 'oeuf')).toEqual([
            {text: 'B', match: false},
            {text: 'œuf', match: true},
        ]);
    });

    it('matches a plain-letter query against an accented original', () => {
        expect(highlightSegments('crème fraîche', 'creme')).toEqual([
            {text: 'crème', match: true},
            {text: ' fraîche', match: false},
        ]);
    });

    it('returns no match when the query is not found', () => {
        expect(highlightSegments('Flour', 'xyz')).toEqual([{text: 'Flour', match: false}]);
    });
});
