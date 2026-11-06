export type WakeLockHandle = {
    release(): Promise<void>;
    addEventListener(type: 'release', listener: () => void): void;
};

// ScreenWakeLock keeps the screen on while `wanted`. The browser releases the
// lock whenever the tab is hidden, so `wanted` is tracked apart from the
// handle and onVisible re-acquires it.
export class ScreenWakeLock {
    wanted = $state(false);
    #handle: WakeLockHandle | null = null;
    #request: () => Promise<WakeLockHandle>;

    constructor(request: () => Promise<WakeLockHandle>) {
        this.#request = request;
    }

    async toggle(): Promise<void> {
        this.wanted = !this.wanted;
        if (this.wanted)
            await this.#acquire();
        else
            this.release();
    }

    async onVisible(): Promise<void> {
        if (this.wanted && !this.#handle)
            await this.#acquire();
    }

    release(): void {
        const handle = this.#handle;
        this.#handle = null;
        handle?.release();
    }

    async #acquire(): Promise<void> {
        let handle: WakeLockHandle;
        try {
            handle = await this.#request();
        } catch {
            this.wanted = false;
            return;
        }
        if (!this.wanted) {
            handle.release();
            return;
        }
        this.#handle = handle;
        handle.addEventListener('release', () => {
            if (this.#handle === handle)
                this.#handle = null;
        });
    }
}
