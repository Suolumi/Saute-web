export type PointerPoint = { clientX: number, clientY: number };

/**
 * Scrolls the window while a pointer-driven drag hovers near the top or bottom
 * edge of the viewport, faster the closer it gets. `onScroll` is called with the
 * last pointer position after each scroll, since the content moved under it.
 */
export function createEdgeAutoScroll(onScroll: (p: PointerPoint) => void, edge = 80, maxSpeed = 20) {
    let point: PointerPoint | null = null;
    let frame: number | null = null;

    function speedFor(y: number): number {
        const h = window.innerHeight;
        const zone = Math.min(edge, h / 4);
        if (y < zone) return -Math.ceil(maxSpeed * Math.min(1, (zone - y) / zone));
        if (y > h - zone) return Math.ceil(maxSpeed * Math.min(1, (y - (h - zone)) / zone));
        return 0;
    }

    function tick() {
        frame = null;
        if (!point) return;
        const dy = speedFor(point.clientY);
        if (dy === 0) return;
        const before = window.scrollY;
        window.scrollBy(0, dy);
        if (window.scrollY === before) return;
        onScroll(point);
        frame = requestAnimationFrame(tick);
    }

    return {
        move(p: PointerPoint) {
            point = {clientX: p.clientX, clientY: p.clientY};
            if (frame === null) frame = requestAnimationFrame(tick);
        },
        stop() {
            point = null;
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
        },
    };
}
