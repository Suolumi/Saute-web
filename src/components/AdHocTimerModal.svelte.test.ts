import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-svelte';
import {addMessages, init} from 'svelte-i18n';
import {get} from 'svelte/store';
import AdHocTimerModal from './AdHocTimerModal.svelte';
import {activeTimers} from '$lib/recipeTimers';

vi.mock('$lib/timerAlarm', () => ({unlockAlarmAudio: vi.fn()}));
vi.mock('$lib/stores', () => ({jsonParser: JSON}));

beforeAll(async () => {
    addMessages('en', {adHocTimer: {
        title: 'New timer', nameLabel: 'Name (optional)', namePlaceholder: 'e.g. Pasta', minutesLabel: 'Minutes',
        secondsLabel: 'Seconds', start: 'Start timer', presets: 'Quick presets', presetMinutes: '{minutes} min', autoLabel: 'Timer {n}',
    }});
    await init({fallbackLocale: 'en', initialLocale: 'en'});
});

beforeEach(() => activeTimers.set([]));

// type sets a field the way bind:value reads it; DOM events stay inside this
// test's frame, unlike Playwright's pointer-driven fill.
function type(element: Element, value: string) {
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event('input', {bubbles: true}));
}

describe('AdHocTimerModal', () => {
    it('starts a named timer from minutes and seconds, then closes', async () => {
        const screen = render(AdHocTimerModal, {open: true});
        type(screen.getByLabelText('Name (optional)').element(), 'Pasta');
        type(screen.getByLabelText('Minutes').element(), '5');
        type(screen.getByLabelText('Seconds').element(), '30');
        (screen.getByRole('button', {name: 'Start timer'}).element() as HTMLElement).click();
        const timers = get(activeTimers);
        expect(timers).toHaveLength(1);
        expect(timers[0]).toMatchObject({recipeId: null, label: 'Pasta', durationMs: 330_000});
        await expect.poll(() => screen.container.textContent).not.toContain('Start timer');
    });

    it('starts a preset with an automatic label', async () => {
        const screen = render(AdHocTimerModal, {open: true});
        (screen.getByRole('button', {name: '10 min'}).element() as HTMLElement).click();
        expect(get(activeTimers)[0]).toMatchObject({label: 'Timer 1', durationMs: 600_000});
    });
});
