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

describe('AdHocTimerModal', () => {
    it('starts a named timer from minutes and seconds, then closes', async () => {
        const screen = render(AdHocTimerModal, {open: true});
        await screen.getByLabelText('Name (optional)').fill('Pasta');
        await screen.getByLabelText('Minutes').fill('5');
        await screen.getByLabelText('Seconds').fill('30');
        await screen.getByRole('button', {name: 'Start timer'}).click();
        const timers = get(activeTimers);
        expect(timers).toHaveLength(1);
        expect(timers[0]).toMatchObject({recipeId: null, label: 'Pasta', durationMs: 330_000});
        expect(screen.container.textContent).not.toContain('Start timer');
    });

    it('starts a preset with an automatic label', async () => {
        const screen = render(AdHocTimerModal, {open: true});
        await screen.getByRole('button', {name: '10 min'}).click();
        expect(get(activeTimers)[0]).toMatchObject({label: 'Timer 1', durationMs: 600_000});
    });
});
