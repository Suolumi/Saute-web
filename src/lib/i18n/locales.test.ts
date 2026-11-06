import {describe, expect, it} from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';
import fi from './locales/fi.json';
import zh from './locales/zh.json';

function keys(obj: object, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

describe('locales', () => {
    it.each([['fr', fr], ['fi', fi], ['zh', zh]])('%s has the same keys as en', (_, loc) => {
        expect(keys(loc).sort()).toEqual(keys(en).sort());
    });
    it('has no cook mode strings', () => {
        for (const loc of [en, fr, fi, zh])
            expect(keys(loc).filter(k => /cookMode/.test(k))).toEqual([]);
    });
    it('has no Toolbox page strings', () => {
        for (const loc of [en, fr, fi, zh])
            expect(keys(loc).filter(k => k.startsWith('toolbox.') || k === 'about.items.toolbox.title')).toEqual([]);
    });
    it('recipeTimers copy no longer mentions cook mode', () => {
        expect(en.about.items.recipeTimers.description).not.toMatch(/cook mode/i);
        expect(fr.about.items.recipeTimers.description).not.toMatch(/mode cuisine/i);
        expect(fi.about.items.recipeTimers.description).not.toMatch(/kokkaustila/i);
        expect(zh.about.items.recipeTimers.description).not.toMatch(/烹饪模式/);
    });
});
