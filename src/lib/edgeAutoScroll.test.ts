import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createEdgeAutoScroll} from './edgeAutoScroll';

describe('createEdgeAutoScroll', () => {
    let frames: FrameRequestCallback[];
    let scrollY: number;

    beforeEach(() => {
        frames = [];
        scrollY = 500;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => frames.splice(0));
        vi.stubGlobal('window', {
            innerHeight: 800,
            get scrollY() { return scrollY; },
            scrollBy: (_x: number, dy: number) => { scrollY = Math.max(0, scrollY + dy); },
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    function runFrame() {
        frames.shift()?.(0);
    }

    it('scrolls down near the bottom edge and reports the pointer', () => {
        const onScroll = vi.fn();
        const s = createEdgeAutoScroll(onScroll);
        s.move({clientX: 10, clientY: 795});
        runFrame();
        expect(scrollY).toBeGreaterThan(500);
        expect(onScroll).toHaveBeenCalledWith({clientX: 10, clientY: 795});
        expect(frames).toHaveLength(1);
    });

    it('scrolls up near the top edge, faster closer to it', () => {
        const s = createEdgeAutoScroll(() => {});
        s.move({clientX: 0, clientY: 60});
        runFrame();
        const slow = 500 - scrollY;
        scrollY = 500;
        s.move({clientX: 0, clientY: 5});
        runFrame();
        expect(500 - scrollY).toBeGreaterThan(slow);
        expect(slow).toBeGreaterThan(0);
    });

    it('does nothing in the middle, at the page top, or after stop', () => {
        const onScroll = vi.fn();
        const s = createEdgeAutoScroll(onScroll);
        s.move({clientX: 0, clientY: 400});
        runFrame();
        expect(scrollY).toBe(500);

        scrollY = 0;
        s.move({clientX: 0, clientY: 0});
        runFrame();
        expect(frames).toHaveLength(0);

        scrollY = 500;
        s.move({clientX: 0, clientY: 799});
        s.stop();
        runFrame();
        expect(scrollY).toBe(500);
        expect(onScroll).not.toHaveBeenCalled();
    });
});
