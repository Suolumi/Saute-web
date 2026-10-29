import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {tick} from 'svelte';
import {addMessages, init} from 'svelte-i18n';
import TagBadges from './TagBadges.svelte';
import '../app.css';
import {loadTags, type RecipeTag} from '$lib/tags';

const slugs = ['one', 'two', 'three', 'four', 'five', 'six'];

vi.mock('$lib/api', () => ({
    apiFetchJson: async () => ({
        response: {ok: true},
        data: {
            items: slugs.map((slug): RecipeTag => ({
                slug, group: 'practical', categories: ['food'], implies: [],
                labels: {en: `Tag ${slug}`}, source_locale: 'en',
            })),
        },
    }),
}));

beforeAll(async () => {
    addMessages('en', {tags: {showMore: 'Show {count} more'}});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
    await loadTags();
});

// box mounts the badges in a flex column of a fixed size, as the card body
// gives them.
async function renderIn(width: number, height: number) {
    const target = document.createElement('div');
    target.style.cssText = `display:flex;flex-direction:column;width:${width}px;height:${height}px`;
    document.body.appendChild(target);
    const screen = render(TagBadges, {target, props: {slugs, fit: true}});
    await tick();
    await new Promise(requestAnimationFrame);
    await tick();
    return screen;
}

function visibleChips(container: HTMLElement): string[] {
    const layers = container.querySelectorAll(':scope > div > div');
    const visible = layers[layers.length - 1] as HTMLElement;
    return [...visible.querySelectorAll('span')].map(span => span.textContent!.trim());
}

describe('TagBadges fit', () => {
    it('shows one row and a +N button when there is no spare height', async () => {
        const {container} = await renderIn(300, 24);
        const chips = visibleChips(container);
        expect(chips.length).toBeGreaterThan(0);
        expect(chips.length).toBeLessThan(slugs.length);
        expect(container.querySelector('button')?.textContent?.trim()).toBe(`+${slugs.length - chips.length}`);
    });

    it('shows more badges when the card has spare height', async () => {
        const small = visibleChips((await renderIn(300, 24)).container).length;
        const tall = await renderIn(300, 200);
        expect(visibleChips(tall.container)).toHaveLength(slugs.length);
        expect(tall.container.querySelector('button')).toBeNull();
        expect(small).toBeLessThan(slugs.length);
    });

    it('puts +N on the last visible row', async () => {
        const {container} = await renderIn(300, 24);
        const chips = visibleChips(container);
        const row = container.querySelectorAll(':scope > div > div')[1] as HTMLElement;
        const button = row.querySelector('button')!;
        expect(button.offsetTop).toBe((row.firstElementChild as HTMLElement).offsetTop);
        expect(chips.length).toBeGreaterThanOrEqual(2);
    });

    it('expands every badge on +N', async () => {
        const {container} = await renderIn(300, 24);
        container.querySelector('button')!.click();
        await tick();
        expect(visibleChips(container)).toHaveLength(slugs.length);
    });
});
