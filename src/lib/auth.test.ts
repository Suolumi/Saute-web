import {describe, expect, it} from 'vitest';
import {isPasswordValid} from './auth';

// Same cases as the API's TestIsPasswordValid.
describe('isPasswordValid', () => {
    it.each([
        ['abcdefghi1!', false],
        ['abcdefghij1!', true],
        ['abcdefghijk!', false],
        ['abcdefghijk1', false],
        ['ééééééééé1!', false],
    ])('%s -> %s', (password, want) => {
        expect(isPasswordValid(password)).toBe(want);
    });
});
