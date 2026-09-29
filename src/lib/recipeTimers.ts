import {persisted} from 'svelte-persisted-store'
import {jsonParser} from '$lib/stores'

// A running (or just-expired, not yet dismissed) cooking timer: either tied to
// a recipe step (recipeId/stepIndex/recipeTitle set), or a standalone one
// started from the Toolbox's Timers tool (all three null). Purely a
// client-side convenience, like recipeProgress.ts's step-done tracking - no
// backend involvement, no cross-device sync. `endsAt` is an absolute
// timestamp rather than a countdown that gets decremented, so a backgrounded
// tab or a page reload never lets the timer drift: remaining time is always
// `endsAt - Date.now()`, recomputed fresh. `remainingMs` is set instead
// (frozen), and `endsAt` cleared, while the timer is paused.
export type ActiveTimer = {
    id: string
    recipeId: string | null
    stepIndex: number | null
    label: string
    recipeTitle: string | null
    durationMs: number
    endsAt: number | null
    remainingMs: number | null
    ringing: boolean
}

export const activeTimers = persisted<ActiveTimer[]>('activeTimers', [], {
    syncTabs: true,
    serializer: jsonParser,
})

// Starting a timer for a step that already has one running replaces it,
// rather than stacking a second timer for the same step.
export function startTimer(recipeId: string, stepIndex: number, label: string, recipeTitle: string, minutes: number) {
    const durationMs = minutes * 60_000
    const timer: ActiveTimer = {
        id: crypto.randomUUID(),
        recipeId,
        stepIndex,
        label,
        recipeTitle,
        durationMs,
        endsAt: Date.now() + durationMs,
        remainingMs: null,
        ringing: false,
    }
    activeTimers.update(timers => [...timers.filter(t => !(t.recipeId === recipeId && t.stepIndex === stepIndex)), timer])
}

export function startAdHocTimer(label: string, minutes: number) {
    const durationMs = minutes * 60_000
    const timer: ActiveTimer = {
        id: crypto.randomUUID(),
        recipeId: null,
        stepIndex: null,
        label,
        recipeTitle: null,
        durationMs,
        endsAt: Date.now() + durationMs,
        remainingMs: null,
        ringing: false,
    }
    activeTimers.update(timers => [...timers, timer])
}

export function cancelTimer(id: string) {
    activeTimers.update(timers => timers.filter(t => t.id !== id))
}

// Freezes a running timer's remaining time. No-op for one that's already
// paused, or that's finished ringing (nothing left to pause).
export function pauseTimer(id: string) {
    activeTimers.update(timers => timers.map(t => {
        if (t.id !== id || t.ringing || isPaused(t)) return t
        return {...t, endsAt: null, remainingMs: Math.max(0, t.endsAt! - Date.now())}
    }))
}

// Resumes from the frozen remaining time, computing a fresh `endsAt` so the
// countdown stays drift-free from here on.
export function resumeTimer(id: string) {
    activeTimers.update(timers => timers.map(t => {
        if (t.id !== id || !isPaused(t)) return t
        return {...t, endsAt: Date.now() + t.remainingMs!, remainingMs: null}
    }))
}

export function isPaused(timer: ActiveTimer): boolean {
    return typeof timer.remainingMs === 'number'
}

export function getTimerFor(timers: ActiveTimer[], recipeId: string, stepIndex: number): ActiveTimer | undefined {
    return timers.find(t => t.recipeId === recipeId && t.stepIndex === stepIndex)
}

export function remainingMs(timer: ActiveTimer, now: number = Date.now()): number {
    return isPaused(timer) ? timer.remainingMs! : Math.max(0, timer.endsAt! - now)
}

export function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}
