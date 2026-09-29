<script lang="ts">
    import {onMount} from 'svelte';
    import {_, locale} from 'svelte-i18n';
    import {goto} from '$app/navigation';
    import {
        activeTimers, cancelTimer, pauseTimer, resumeTimer, isPaused, remainingMs, formatRemaining,
        type ActiveTimer
    } from '$lib/recipeTimers';
    import {playAlarmBeep} from '$lib/timerAlarm';
    import {Timer, X, Pause, Play, ChevronUp, ChevronDown} from '@lucide/svelte';

    let expanded = $state(false);
    let now = $state(Date.now());
    let lastBeepAt = 0;

    const sorted = $derived([...$activeTimers].sort((a, b) => remainingMs(a, now) - remainingMs(b, now)));
    const soonest = $derived(sorted.length > 0 ? sorted[0] : null);
    const anyRinging = $derived($activeTimers.some(t => t.ringing));

    function goToRecipe(timer: ActiveTimer) {
        expanded = false;
        goto(`/${$locale}/recipes/${timer.recipeId}`);
    }

    function statusText(timer: ActiveTimer): string {
        if (timer.ringing) return $_('recipe.timerDone');
        const time = formatRemaining(remainingMs(timer, now));
        return isPaused(timer) ? $_('recipe.timerPaused', {values: {time}}) : $_('recipe.timerRemaining', {values: {time}});
    }

    // Ticks every 500ms: recomputes "now" (driving the mm:ss displays),
    // flips a running (not paused) timer to `ringing` the moment it crosses
    // its end time (an absolute timestamp, so this never drifts even if the
    // tab was backgrounded), and re-beeps periodically for as long as
    // anything is still ringing and undismissed.
    onMount(() => {
        const interval = setInterval(() => {
            now = Date.now();
            const timers = $activeTimers;
            let needsUpdate = false;
            const updated = timers.map(t => {
                if (!t.ringing && t.endsAt !== null && t.endsAt <= now) {
                    needsUpdate = true;
                    return {...t, ringing: true};
                }
                return t;
            });
            if (needsUpdate) activeTimers.set(updated);

            if (updated.some(t => t.ringing) && now - lastBeepAt > 2500) {
                playAlarmBeep();
                lastBeepAt = now;
            }
        }, 500);
        return () => clearInterval(interval);
    });
</script>

{#if $activeTimers.length > 0}
    <div class="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {#if expanded}
            <div class="w-72 max-w-[calc(100vw-2.5rem)] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                <div class="max-h-80 overflow-y-auto divide-y divide-border">
                    {#each sorted as timer (timer.id)}
                        <div class="flex items-center gap-2 p-3">
                            {#if timer.recipeId}
                                <button
                                        type="button"
                                        onclick={() => goToRecipe(timer)}
                                        class="flex-1 min-w-0 text-left hover:cursor-pointer"
                                >
                                    <div class="text-sm font-semibold text-card-foreground truncate">{$_('recipe.timerFor', {values: {recipe: timer.recipeTitle, step: timer.label}})}</div>
                                    <div class="text-sm {timer.ringing ? 'text-primary font-semibold' : 'text-muted-foreground'}">
                                        {statusText(timer)}
                                    </div>
                                </button>
                            {:else}
                                <div class="flex-1 min-w-0 text-left">
                                    <div class="text-sm font-semibold text-card-foreground truncate">{timer.label}</div>
                                    <div class="text-sm {timer.ringing ? 'text-primary font-semibold' : 'text-muted-foreground'}">
                                        {statusText(timer)}
                                    </div>
                                </div>
                            {/if}
                            {#if !timer.ringing}
                                <button
                                        type="button"
                                        onclick={() => isPaused(timer) ? resumeTimer(timer.id) : pauseTimer(timer.id)}
                                        aria-label={isPaused(timer) ? $_('recipe.resumeTimer') : $_('recipe.pauseTimer')}
                                        title={isPaused(timer) ? $_('recipe.resumeTimer') : $_('recipe.pauseTimer')}
                                        class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hover:cursor-pointer"
                                >
                                    {#if isPaused(timer)}
                                        <Play size="16" />
                                    {:else}
                                        <Pause size="16" />
                                    {/if}
                                </button>
                            {/if}
                            <button
                                    type="button"
                                    onclick={() => cancelTimer(timer.id)}
                                    aria-label={$_('recipe.dismissTimer')}
                                    title={$_('recipe.dismissTimer')}
                                    class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors hover:cursor-pointer"
                            >
                                <X size="16" />
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <button
                type="button"
                onclick={() => expanded = !expanded}
                aria-label={$_('recipe.timerWidgetLabel')}
                title={$_('recipe.timerWidgetLabel')}
                class="flex items-center gap-2 pl-3 pr-2.5 py-2.5 rounded-full shadow-lg border transition-colors hover:cursor-pointer {anyRinging ? 'bg-primary text-primary-foreground border-primary animate-pulse' : 'bg-card text-card-foreground border-border hover:bg-accent'}"
        >
            <Timer size="18" />
            <span class="text-sm font-semibold whitespace-nowrap">
                {#if anyRinging}
                    {$_('recipe.timerDone')}
                {:else if soonest}
                    {formatRemaining(remainingMs(soonest, now))}
                {/if}
                {#if $activeTimers.length > 1}
                    · {$activeTimers.length}
                {/if}
            </span>
            {#if expanded}
                <ChevronDown size="16" />
            {:else}
                <ChevronUp size="16" />
            {/if}
        </button>
    </div>
{/if}
