import {describe, expect, it} from 'vitest';
import {ScreenWakeLock, type WakeLockHandle} from './wakeLock.svelte';

// fakeRequest hands out sentinels the test can release, as the browser does
// when the tab is hidden.
function fakeRequest() {
    const sentinels: (WakeLockHandle & {released: boolean, fireRelease(): void})[] = [];
    const request = async () => {
        let onRelease = () => {};
        const s = {
            released: false,
            async release() { s.released = true; onRelease(); },
            addEventListener(_: 'release', fn: () => void) { onRelease = fn; },
            fireRelease() { s.released = true; onRelease(); },
        };
        sentinels.push(s);
        return s;
    };
    return {request, sentinels};
}

describe('ScreenWakeLock', () => {
    it('re-acquires the lock when the tab becomes visible again', async () => {
        const {request, sentinels} = fakeRequest();
        const lock = new ScreenWakeLock(request);
        await lock.toggle();
        expect(sentinels).toHaveLength(1);

        sentinels[0].fireRelease();
        expect(lock.wanted).toBe(true);

        await lock.onVisible();
        expect(sentinels).toHaveLength(2);
        expect(sentinels[1].released).toBe(false);
    });

    it('does not re-acquire after the user turned it off', async () => {
        const {request, sentinels} = fakeRequest();
        const lock = new ScreenWakeLock(request);
        await lock.toggle();
        await lock.toggle();
        expect(lock.wanted).toBe(false);
        expect(sentinels[0].released).toBe(true);

        await lock.onVisible();
        expect(sentinels).toHaveLength(1);
    });

    it('turns itself off when the request is refused', async () => {
        const lock = new ScreenWakeLock(async () => { throw new Error('NotAllowedError'); });
        await lock.toggle();
        expect(lock.wanted).toBe(false);
    });

    it('does not request twice while already holding the lock', async () => {
        const {request, sentinels} = fakeRequest();
        const lock = new ScreenWakeLock(request);
        await lock.toggle();
        await lock.onVisible();
        expect(sentinels).toHaveLength(1);
    });
});
